/**
 * Slice E2E du wizard Americano par équipes fixes.
 *
 * Prérequis :
 *   node scripts/supabase-mock.mjs 4545
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4545 npm run build
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4545 npm run start -- -p 3200
 */
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:3200";
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : undefined,
);
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
const eventPayloads = [];
const rosterPayloads = [];
const eventDeletes = [];
const directRosterPosts = [];

page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("request", (request) => {
  const { pathname } = new URL(request.url());
  if (request.method() === "POST" && pathname === "/rest/v1/events") {
    eventPayloads.push(request.postDataJSON());
  }
  if (
    request.method() === "POST" &&
    pathname === "/rest/v1/rpc/replace_event_roster"
  ) {
    rosterPayloads.push(request.postDataJSON());
  }
  if (request.method() === "DELETE" && pathname === "/rest/v1/events") {
    eventDeletes.push(request.url());
  }
  if (request.method() === "POST" && pathname === "/rest/v1/event_players") {
    directRosterPosts.push(request.url());
  }
});

const expectVisible = (locator, timeout = 8_000) =>
  locator.waitFor({ state: "visible", timeout });

try {
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  await page.fill("#name", "Organisateur cycles");
  await page.fill("#email", `cycles-${Date.now()}@test.fr`);
  await page.fill("#password", "MotDePasse!123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15_000 });

  await page.goto(`${BASE_URL}/events/new`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: /^Americano/ }).click();
  await page.fill("#event-name", "Americano équipes E2E");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expectVisible(page.getByRole("heading", { name: "Réglages" }));

  await page.getByRole("radio", { name: "Par équipes · fixe" }).click();
  await page.getByRole("radio", { name: "Manuelle" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expectVisible(page.getByRole("heading", { name: "Joueurs" }));

  for (const name of ["Léa", "Marco", "Sofia", "Karim", "Inès"]) {
    await page.getByRole("textbox", { name: "Nom du joueur" }).fill(name);
    await page.getByRole("button", { name: "Ajouter le joueur" }).click();
  }
  const createButton = page.getByRole("button", { name: "Créer l'événement" });
  if (await createButton.isEnabled()) {
    throw new Error("la création reste possible avec un roster fixe impair");
  }
  await page.getByRole("textbox", { name: "Nom du joueur" }).fill("Tiana");
  await page.getByRole("button", { name: "Ajouter le joueur" }).click();

  await expectVisible(
    page.getByText("6 joueurs · 3 équipes · 3 rounds · 1 repos par équipe"),
  );
  const composer = page.getByRole("group", { name: "Composition des équipes" });
  await expectVisible(composer);
  if ((await composer.getByText(/^Équipe [1-3]$/).count()) !== 3) {
    throw new Error("les trois binômes ne sont pas affichés");
  }
  if ((await composer.getByRole("button", { name: /^Sélectionner / }).count()) !== 6) {
    throw new Error("les joueurs du composer ne sont pas accessibles");
  }

  let rejectFirstRoster = true;
  await page.route("**/rest/v1/rpc/replace_event_roster", async (route) => {
    if (!rejectFirstRoster) return route.continue();
    rejectFirstRoster = false;
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ code: "P0001", message: "invalid_roster_payload" }),
    });
  });

  const rollbackRequest = page.waitForRequest((request) => {
    const { pathname } = new URL(request.url());
    return request.method() === "DELETE" && pathname === "/rest/v1/events";
  });
  await createButton.click();
  await expectVisible(page.getByRole("alert").getByText("La liste des joueurs est invalide."));
  await rollbackRequest;
  if (!(await createButton.isEnabled())) {
    throw new Error("le bouton de création reste désactivé après rollback");
  }
  const firstRosterPayload = rosterPayloads.at(-1);

  await createButton.click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  const rosterPayload = rosterPayloads.at(-1);
  if (!firstRosterPayload || !rosterPayload || rosterPayloads.length !== 2) {
    throw new Error("les deux appels replace_event_roster ne sont pas observés");
  }
  if (JSON.stringify(firstRosterPayload.p_players) !== JSON.stringify(rosterPayload.p_players)) {
    throw new Error("les identifiants ou affectations ont changé après le rollback");
  }
  if (rosterPayload.p_rounds_per_cycle !== 3) {
    throw new Error(`rounds RPC inattendus : ${rosterPayload.p_rounds_per_cycle}`);
  }
  const roster = rosterPayload.p_players ?? [];
  const ids = roster.map((player) => player.id);
  if (
    roster.length !== 6 ||
    new Set(ids).size !== 6 ||
    ids.some(
      (id) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        ),
    )
  ) {
    throw new Error("les UUID locaux du roster sont absents, invalides ou dupliqués");
  }
  if (
    roster.some(
      (player, index) => player.seed !== index + 1 || player.preferred_side !== null,
    )
  ) {
    throw new Error("seeds ou preferred_side RPC invalides");
  }
  const teamCounts = new Map();
  for (const player of roster) {
    teamCounts.set(player.team_number, (teamCounts.get(player.team_number) ?? 0) + 1);
  }
  if (
    teamCounts.size !== 3 ||
    [1, 2, 3].some((teamNumber) => teamCounts.get(teamNumber) !== 2)
  ) {
    throw new Error(`affectations RPC invalides : ${JSON.stringify([...teamCounts])}`);
  }
  if (eventPayloads.length !== 2 || eventDeletes.length !== 1) {
    throw new Error(
      `rollback incomplet : ${eventPayloads.length} créations, ${eventDeletes.length} suppression`,
    );
  }
  for (const eventPayload of eventPayloads) {
    const settings = eventPayload.settings;
    const expectedSettings = {
      points_per_match: 24,
      courts: 2,
      rounds: 3,
      pairing: "random",
      team_mode: "fixed",
      composition: "manual",
      rounds_per_cycle: 3,
    };
    if (JSON.stringify(settings) !== JSON.stringify(expectedSettings)) {
      throw new Error(`settings événement invalides : ${JSON.stringify(settings)}`);
    }
  }
  if (directRosterPosts.length > 0) {
    throw new Error("écriture POST directe interdite dans event_players");
  }
  if (pageErrors.length > 0) {
    throw new Error(`erreurs page : ${[...new Set(pageErrors)].join(" | ")}`);
  }

  console.log("✅ Wizard Americano fixe : preview accessible et payload RPC valides.");
} finally {
  await browser.close();
}
