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
const consoleErrors = [];
const eventPayloads = [];
const rosterPayloads = [];
const eventDeletes = [];
const cyclePayloads = [];
const scorePayloads = [];
const directRosterMutations = [];
const directMatchMutations = [];

page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push({ text: message.text(), url: message.location().url });
  }
});
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
  if (
    ["POST", "PATCH", "DELETE"].includes(request.method()) &&
    pathname === "/rest/v1/event_players"
  ) {
    directRosterMutations.push(`${request.method()} ${request.url()}`);
  }
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
    pathname === "/rest/v1/matches"
  ) {
    directMatchMutations.push(`${request.method()} ${request.url()}`);
  }
  if (
    request.method() === "POST" &&
    pathname === "/rest/v1/rpc/commit_americano_cycle"
  ) {
    cyclePayloads.push(request.postDataJSON());
  }
  if (request.method() === "POST" && pathname === "/rest/v1/rpc/report_score") {
    scorePayloads.push(request.postDataJSON());
  }
});

const expectVisible = (locator, timeout = 8_000) =>
  locator.waitFor({ state: "visible", timeout });

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const waitForRpcResponse = (name) =>
  page.waitForResponse((response) => {
    const { pathname } = new URL(response.url());
    return (
      response.request().method() === "POST" &&
      pathname === `/rest/v1/rpc/${name}`
    );
  });

async function waitForButtonState(locator, enabled, timeout = 8_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await locator.isEnabled()) === enabled) return;
    await page.waitForTimeout(50);
  }
  throw new Error(
    `le bouton ${(await locator.textContent())?.trim() ?? "inconnu"} n'est pas devenu ${
      enabled ? "actif" : "désactivé"
    }`,
  );
}

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
  await page.waitForLoadState("networkidle");
  // Le premier 400 du RPC roster est volontaire et sera filtré précisément au bilan.

  const eventUrl = page.url();
  const draftComposer = page.getByRole("group", { name: "Composition des équipes" });
  await expectVisible(draftComposer);
  if ((await draftComposer.getByText(/^Équipe [1-3]$/).count()) !== 3) {
    throw new Error("l'aperçu des trois équipes manque dans le brouillon");
  }

  async function expectSuccessfulRosterMutation(action, label) {
    const payloadCount = rosterPayloads.length;
    const responsePromise = waitForRpcResponse("replace_event_roster");
    await action();
    const response = await responsePromise;
    if (!response.ok()) throw new Error(`${label} refusé : HTTP ${response.status()}`);
    if (rosterPayloads.length !== payloadCount + 1) {
      throw new Error(`${label} a émis ${rosterPayloads.length - payloadCount} RPC roster`);
    }
    return rosterPayloads.at(-1);
  }

  const initialIdsByName = Object.fromEntries(
    roster.map((player) => [player.display_name, player.id]),
  );
  const removePayload = await expectSuccessfulRosterMutation(
    () => page.getByRole("button", { name: "Retirer Tiana" }).click(),
    "retrait du joueur",
  );
  if (
    removePayload.p_players.length !== 5 ||
    removePayload.p_rounds_per_cycle !== null ||
    removePayload.p_players.some((player) => player.team_number !== null) ||
    removePayload.p_players.some(
      (player) => initialIdsByName[player.display_name] !== player.id,
    )
  ) {
    throw new Error(`payload de retrait invalide : ${JSON.stringify(removePayload)}`);
  }
  await page
    .getByRole("button", { name: "Retirer Tiana" })
    .waitFor({ state: "hidden" });
  const launchButton = page.getByRole("button", { name: "Lancer l'événement" });
  await waitForButtonState(launchButton, false);
  await expectVisible(
    page.getByText("Il faut un nombre pair de joueurs (minimum 4).", { exact: true }),
  );
  await expectVisible(page.getByRole("button", { name: "Recomposer les équipes" }));
  if (cyclePayloads.length !== 0) {
    throw new Error("un cycle a été envoyé pendant le brouillon fixe impair");
  }

  await page.getByRole("textbox", { name: "Ajouter un joueur" }).fill("Tiana");
  const addPayload = await expectSuccessfulRosterMutation(
    () => page.getByRole("button", { name: "Ajouter", exact: true }).click(),
    "ajout du joueur",
  );
  if (
    addPayload.p_players.length !== 6 ||
    addPayload.p_rounds_per_cycle !== null ||
    addPayload.p_players.some((player) => player.team_number !== null) ||
    addPayload.p_players
      .filter((player) => player.display_name !== "Tiana")
      .some((player) => initialIdsByName[player.display_name] !== player.id)
  ) {
    throw new Error(`payload d'ajout invalide : ${JSON.stringify(addPayload)}`);
  }
  await expectVisible(page.getByRole("button", { name: "Retirer Tiana" }));
  await waitForButtonState(launchButton, false);
  await expectVisible(page.getByText("Un joueur est sans équipe.", { exact: true }));
  if (cyclePayloads.length !== 0) {
    throw new Error("un cycle a été envoyé avant recomposition des équipes");
  }

  const recomposePayload = await expectSuccessfulRosterMutation(
    () => page.getByRole("button", { name: "Recomposer les équipes" }).click(),
    "recomposition des équipes",
  );
  const recomposeCounts = new Map();
  for (const player of recomposePayload.p_players) {
    recomposeCounts.set(
      player.team_number,
      (recomposeCounts.get(player.team_number) ?? 0) + 1,
    );
  }
  if (
    recomposePayload.p_players.length !== 6 ||
    recomposePayload.p_rounds_per_cycle !== 3 ||
    recomposeCounts.size !== 3 ||
    [...recomposeCounts.values()].some((count) => count !== 2)
  ) {
    throw new Error(`payload de recomposition invalide : ${JSON.stringify(recomposePayload)}`);
  }
  await expectVisible(draftComposer);
  await waitForButtonState(launchButton, true);

  const assignmentsBeforeSwap = Object.fromEntries(
    (rosterPayloads.at(-1)?.p_players ?? []).map((player) => [
      player.display_name,
      player.team_number,
    ]),
  );
  if (
    assignmentsBeforeSwap.Léa == null ||
    assignmentsBeforeSwap.Sofia == null ||
    assignmentsBeforeSwap.Léa === assignmentsBeforeSwap.Sofia
  ) {
    throw new Error("la précondition du swap exige deux équipes distinctes");
  }
  await draftComposer
    .getByRole("button", { name: /^Sélectionner Léa, équipe / })
    .click();
  const swapPayload = await expectSuccessfulRosterMutation(
    () =>
      draftComposer
        .getByRole("button", { name: /^Sélectionner Sofia, équipe / })
        .click(),
    "échange de joueurs",
  );
  const assignmentsAfterSwap = Object.fromEntries(
    (rosterPayloads.at(-1)?.p_players ?? []).map((player) => [
      player.display_name,
      player.team_number,
    ]),
  );
  if (
    assignmentsAfterSwap.Léa === assignmentsBeforeSwap.Léa ||
    assignmentsAfterSwap.Sofia === assignmentsBeforeSwap.Sofia ||
    assignmentsAfterSwap.Léa !== assignmentsBeforeSwap.Sofia ||
    assignmentsAfterSwap.Sofia !== assignmentsBeforeSwap.Léa ||
    swapPayload.p_rounds_per_cycle !== 3 ||
    swapPayload.p_players.some(
      (player) =>
        recomposePayload.p_players.find(
          (beforePlayer) => beforePlayer.display_name === player.display_name,
        )?.id !== player.id,
    ) ||
    swapPayload.p_players.some(
      (player) =>
        !["Léa", "Sofia"].includes(player.display_name) &&
        assignmentsAfterSwap[player.display_name] !== assignmentsBeforeSwap[player.display_name],
    )
  ) {
    throw new Error("l'échange accessible n'a pas persisté les nouvelles équipes");
  }

  const finalRosterPayload = rosterPayloads.at(-1);
  const finalRoster = finalRosterPayload?.p_players ?? [];
  if (finalRosterPayload?.p_rounds_per_cycle !== 3) {
    throw new Error("la durée automatique n'est pas repersistée après recomposition");
  }
  const finalTeams = new Map();
  for (const player of finalRoster) {
    const members = finalTeams.get(player.team_number) ?? [];
    members.push(player.display_name);
    finalTeams.set(player.team_number, members);
  }
  if (
    finalRoster.length !== 6 ||
    finalTeams.size !== 3 ||
    [...finalTeams.values()].some((members) => members.length !== 2)
  ) {
    throw new Error("le roster final ne contient pas trois binômes complets");
  }
  const nameById = new Map(
    finalRoster.map((player) => [player.id.toLowerCase(), player.display_name]),
  );

  async function assertMatchCardContract(card, cycleNumber, roundNumber, status) {
    const cyclePayload = cyclePayloads.find(
      (payload) => payload.p_expected_cycle === cycleNumber,
    );
    const plannedMatch = cyclePayload?.p_matches?.find(
      (match) => match.round_number === roundNumber,
    );
    if (!plannedMatch) {
      throw new Error(`match planifié introuvable pour C${cycleNumber}/R${roundNumber}`);
    }
    const team1 = [plannedMatch.team1_p1, plannedMatch.team1_p2].map((id) =>
      nameById.get(id.toLowerCase()),
    );
    const team2 = [plannedMatch.team2_p1, plannedMatch.team2_p2].map((id) =>
      nameById.get(id.toLowerCase()),
    );
    if ([...team1, ...team2].some((name) => !name)) {
      throw new Error("un nom de joueur planifié manque du roster final");
    }
    const expectedName =
      status === "done"
        ? `${team1.join(" et ")} contre ${team2.join(" et ")}, 13 à 11, terrain ${plannedMatch.court}`
        : `Annoncer le score : ${team1.join(" et ")} contre ${team2.join(" et ")}, terrain ${plannedMatch.court}`;
    const attributes = {
      id: await card.getAttribute("data-match-id"),
      status: await card.getAttribute("data-match-status"),
      cycle: await card.getAttribute("data-cycle-number"),
      round: await card.getAttribute("data-round-number"),
      court: await card.getAttribute("data-court"),
      name: await card.getAttribute("aria-label"),
    };
    if (
      !/^[0-9a-f-]{36}$/i.test(attributes.id ?? "") ||
      attributes.status !== status ||
      attributes.cycle !== String(cycleNumber) ||
      attributes.round !== String(roundNumber) ||
      attributes.court !== String(plannedMatch.court) ||
      attributes.name !== expectedName
    ) {
      throw new Error(`contrat MatchCard invalide : ${JSON.stringify(attributes)}`);
    }
  }

  const cycleOneResponsePromise = waitForRpcResponse("commit_americano_cycle");
  await launchButton.click();
  const cycleOneResponse = await cycleOneResponsePromise;
  if (!cycleOneResponse.ok()) {
    throw new Error(`lancement refusé : HTTP ${cycleOneResponse.status()}`);
  }
  await expectVisible(page.getByText("En cours", { exact: true }), 15_000);
  await expectVisible(page.getByText("Équipes fixes", { exact: true }));
  await expectVisible(page.getByText("Cycle 1", { exact: true }));
  const addCycleButton = page.getByRole("button", { name: "Ajouter un cycle", exact: true });
  const completeEventButton = page.getByRole("button", {
    name: "Terminer l'événement",
    exact: true,
  });
  if ((await addCycleButton.count()) !== 0 || (await completeEventButton.count()) !== 0) {
    throw new Error("les actions de cycle sont visibles avant la fin du cycle 1");
  }
  if (
    (await page.getByRole("button", { name: "Terminer l'événement maintenant" }).count()) !==
    0
  ) {
    throw new Error("l'action de clôture avec matchs pending est encore affichée");
  }

  function teamNumbersInText(text) {
    return [...finalTeams.entries()]
      .filter(([, members]) => members.every((name) => text.includes(name)))
      .map(([teamNumber]) => teamNumber)
      .sort((first, second) => first - second);
  }

  const cycleOnePairings = new Set();
  const cycleOneTeamsByRound = new Map();
  let firstRestingTeam = null;
  for (let round = 1; round <= 3; round++) {
    const roundLabel = `R${round}`;
    const roundButton = page.getByRole("button", {
      name: new RegExp(`^${escapeRegExp(roundLabel)}`),
    });
    await roundButton.click();
    const card = page.locator(
      `button[data-match-status="pending"][data-cycle-number="1"][data-round-number="${round}"]`,
    );
    await expectVisible(card);
    await assertMatchCardContract(card, 1, round, "pending");
    await expectVisible(card.getByText(new RegExp(escapeRegExp(roundLabel))));

    const matchText = (await card.textContent()) ?? "";
    const activeTeams = teamNumbersInText(matchText);
    if (activeTeams.length !== 2) {
      throw new Error(`binômes illisibles au round ${round} : ${matchText}`);
    }
    cycleOnePairings.add(activeTeams.join("-"));
    cycleOneTeamsByRound.set(round, activeTeams);
    const restingTeams = [...finalTeams.keys()].filter(
      (teamNumber) => !activeTeams.includes(teamNumber),
    );
    if (restingTeams.length !== 1) {
      throw new Error(`repos d'équipe invalide au round ${round}`);
    }
    if (round === 1) firstRestingTeam = restingTeams[0];
    const restLabel = page.getByText(/^Au repos : Équipe /).first();
    await expectVisible(restLabel);
    const restText = (await restLabel.textContent()) ?? "";
    if (
      !restText.includes(`Équipe ${restingTeams[0]}`) ||
      !finalTeams.get(restingTeams[0]).every((name) => restText.includes(name)) ||
      activeTeams.some((teamNumber) =>
        finalTeams.get(teamNumber).some((name) => restText.includes(name)),
      ) ||
      (restText.match(/Équipe/g) ?? []).length !== 1
    ) {
      throw new Error(`libellé de repos collectif invalide : ${restText}`);
    }
  }
  if (
    JSON.stringify([...cycleOnePairings].sort()) !==
    JSON.stringify(["1-2", "1-3", "2-3"])
  ) {
    throw new Error(`rencontres du cycle 1 incomplètes : ${[...cycleOnePairings]}`);
  }

  await page.getByRole("button", { name: "Partager par QR code" }).click();
  const shareDialog = page.getByRole("dialog", { name: "Partager l'événement" });
  await expectVisible(shareDialog);
  const shareCode =
    (await shareDialog.locator("p.tnum").first().textContent())?.trim() ?? "";
  if (!/^[A-F0-9]{6}$/.test(shareCode)) {
    throw new Error(`code de partage invalide : ${shareCode}`);
  }
  await page.keyboard.press("Escape");

  const restingMembers = finalTeams.get(firstRestingTeam);
  const participantName = restingMembers[0];
  await page.goto(`${BASE_URL}/join/${shareCode}`, { waitUntil: "networkidle" });
  await expectVisible(page.getByText("Qui es-tu ?"));
  await page
    .getByRole("button", { name: new RegExp(escapeRegExp(participantName)) })
    .click();
  await expectVisible(page.getByText("Équipes fixes", { exact: true }));
  await expectVisible(page.getByText("Cycle 1", { exact: true }));
  await expectVisible(page.getByText("Ton équipe est au repos ce round", { exact: true }));
  const participantMatchSection = page
    .getByRole("heading", { name: "Ton prochain match" })
    .locator("..");
  await expectVisible(participantMatchSection);
  const participantMatch = participantMatchSection.locator(
    'button[data-match-status="pending"]',
  );
  await expectVisible(participantMatch);
  if ((await participantMatch.getAttribute("data-cycle-number")) !== "1") {
    throw new Error("le prochain match participant n'expose pas son cycle");
  }
  const participantRound = Number(await participantMatch.getAttribute("data-round-number"));
  const expectedParticipantRound = [...cycleOneTeamsByRound.entries()].find(
    ([round, teams]) => round > 1 && teams.includes(firstRestingTeam),
  )?.[0];
  if (participantRound !== expectedParticipantRound) {
    throw new Error(
      `prochain round participant inattendu : ${participantRound} au lieu de ${expectedParticipantRound}`,
    );
  }
  await expectVisible(participantMatch.getByText(`R${participantRound}`, { exact: false }));

  await page.getByRole("radio", { name: "Classement" }).click();
  const participantTable = page.getByRole("table", { name: "Classement par équipe" });
  await expectVisible(participantTable);
  for (const heading of ["Équipe", "J", "V", "N", "D", "Pour", "Contre", "Diff."]) {
    await expectVisible(
      participantTable.getByRole("columnheader", { name: heading, exact: true }),
    );
  }
  if ((await participantTable.getByRole("row").count()) !== 4) {
    throw new Error("le classement collectif ne contient pas trois équipes");
  }
  for (const names of finalTeams.values()) {
    const label = [...names].sort((first, second) => first.localeCompare(second)).join(" & ");
    await expectVisible(participantTable.getByText(label, { exact: false }));
  }
  await expectVisible(participantTable.getByText("(ton équipe)", { exact: true }));

  await page.goto(eventUrl, { waitUntil: "networkidle" });

  async function completeRound(cycleNumber, localRound, globalRound) {
    const roundLabel = cycleNumber === 1 ? `R${localRound}` : `Cycle ${cycleNumber} · R${localRound}`;
    const roundButton = page.getByRole("button", {
      name: new RegExp(`^${escapeRegExp(roundLabel)}`),
    });
    await roundButton.click();
    const card = page.locator(
      `button[data-match-status="pending"][data-cycle-number="${cycleNumber}"][data-round-number="${globalRound}"]`,
    );
    await expectVisible(card);
    await assertMatchCardContract(card, cycleNumber, globalRound, "pending");
    const matchId = await card.getAttribute("data-match-id");
    if (!matchId) throw new Error(`identifiant stable absent au round ${globalRound}`);
    await card.click();
    await expectVisible(page.getByRole("dialog", { name: "Saisie du score" }));
    await page.getByRole("button", { name: /^Plus de points/ }).first().click();
    const scoreResponsePromise = waitForRpcResponse("report_score");
    await page.getByRole("button", { name: "Valider le score" }).click();
    const scoreResponse = await scoreResponsePromise;
    if (!scoreResponse.ok()) {
      throw new Error(`score refusé au round ${globalRound} : HTTP ${scoreResponse.status()}`);
    }
    const completedRoundButton = page.getByRole("button", {
      name: new RegExp(`^${escapeRegExp(roundLabel)}`),
    });
    await completedRoundButton.click();
    const doneCard = page.locator(
      `button[data-match-id="${matchId}"][data-match-status="done"]`,
    );
    await expectVisible(doneCard, 10_000);
    await assertMatchCardContract(doneCard, cycleNumber, globalRound, "done");
  }

  for (let round = 1; round <= 3; round++) {
    await completeRound(1, round, round);
    const expectedActions = round === 3 ? 1 : 0;
    if (
      (await addCycleButton.count()) !== expectedActions ||
      (await completeEventButton.count()) !== expectedActions
    ) {
      throw new Error(`actions de fin invalides après le score ${round} du cycle 1`);
    }
  }
  if (scorePayloads.length !== 3) {
    throw new Error(`nombre de scores cycle 1 inattendu : ${scorePayloads.length}`);
  }

  await page.goto(`${BASE_URL}/join/${shareCode}`, { waitUntil: "networkidle" });
  await expectVisible(
    page.getByText("Cycle terminé — en attente de l'organisateur", { exact: true }),
  );
  if (
    (await page.getByText(/au repos ce round/i).count()) !== 0 ||
    (await page.getByRole("heading", { name: "Ton prochain match" }).count()) !== 0 ||
    (await page.locator('button[data-match-status="pending"]').count()) !== 0
  ) {
    throw new Error("l'entre-cycle participant est encore décrit comme un repos ou un match");
  }
  await page.goto(eventUrl, { waitUntil: "networkidle" });

  await page.getByRole("radio", { name: "Classement" }).click();
  const organizerTable = page.getByRole("table", { name: "Classement par équipe" });
  await expectVisible(organizerTable);
  await expectVisible(organizerTable.getByText("(ton équipe)", { exact: true }));
  await page.getByRole("radio", { name: "Matchs" }).click();

  await expectVisible(addCycleButton);
  await expectVisible(completeEventButton);

  const cycleTwoResponsePromise = waitForRpcResponse("commit_americano_cycle");
  await addCycleButton.click();
  const cycleTwoResponse = await cycleTwoResponsePromise;
  if (!cycleTwoResponse.ok()) {
    throw new Error(`ajout du cycle 2 refusé : HTTP ${cycleTwoResponse.status()}`);
  }
  await expectVisible(page.getByText("Cycle 2", { exact: true }), 10_000);
  const cycleTwoFirstRound = page.getByRole("button", {
    name: /^Cycle 2 · R1/,
  });
  await expectVisible(cycleTwoFirstRound);
  if ((await cycleTwoFirstRound.getAttribute("aria-pressed")) !== "true") {
    throw new Error("le premier round pending du cycle 2 n'est pas sélectionné");
  }
  await expectVisible(
    page.locator(
      'button[data-match-status="pending"][data-cycle-number="2"][data-round-number="4"]',
    ),
  );
  if ((await addCycleButton.count()) !== 0 || (await completeEventButton.count()) !== 0) {
    throw new Error("les actions de cycle restent visibles au début du cycle 2");
  }

  for (let localRound = 1; localRound <= 3; localRound++) {
    await completeRound(2, localRound, localRound + 3);
    const expectedActions = localRound === 3 ? 1 : 0;
    if (
      (await addCycleButton.count()) !== expectedActions ||
      (await completeEventButton.count()) !== expectedActions
    ) {
      throw new Error(`actions de fin invalides après le score ${localRound} du cycle 2`);
    }
  }
  if (scorePayloads.length !== 6) {
    throw new Error(`nombre de scores total inattendu : ${scorePayloads.length}`);
  }
  await expectVisible(addCycleButton);
  await expectVisible(completeEventButton);

  await completeEventButton.click();
  const completionDialog = page.getByRole("dialog", { name: "Confirmer la clôture" });
  await expectVisible(completionDialog);
  await completionDialog.getByRole("button", { name: "Terminer", exact: true }).click();
  await expectVisible(page.getByText("Terminé", { exact: true }), 10_000);
  const podium = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Podium" }),
  });
  await expectVisible(podium);
  const teamNumberByPlayer = new Map(
    finalRoster.map((player) => [player.id.toLowerCase(), player.team_number]),
  );
  const winsByTeam = new Map([...finalTeams.keys()].map((teamNumber) => [teamNumber, 0]));
  for (const cyclePayload of cyclePayloads) {
    for (const match of cyclePayload.p_matches) {
      const winner = teamNumberByPlayer.get(match.team1_p1.toLowerCase());
      winsByTeam.set(winner, winsByTeam.get(winner) + 1);
    }
  }
  for (const [teamNumber, names] of finalTeams) {
    const label = [...names].sort((first, second) => first.localeCompare(second)).join(" & ");
    const podiumSlot = podium.getByText(label, { exact: true }).locator("..");
    await expectVisible(podiumSlot);
    const wins = winsByTeam.get(teamNumber);
    await expectVisible(
      podiumSlot.getByText(`${wins} victoire${wins === 1 ? "" : "s"}`, { exact: true }),
    );
  }

  if (
    JSON.stringify(cyclePayloads.map((payload) => payload.p_expected_cycle)) !==
    JSON.stringify([1, 2])
  ) {
    throw new Error(`payloads de cycle inattendus : ${JSON.stringify(cyclePayloads)}`);
  }
  if (
    scorePayloads.length !== 6 ||
    new Set(scorePayloads.map((payload) => payload.p_match_id)).size !== 6
  ) {
    throw new Error("les six scores n'ont pas ciblé six matchs distincts");
  }
  if (directRosterMutations.length > 0) {
    throw new Error(
      `mutations directes interdites dans event_players : ${directRosterMutations.join(" | ")}`,
    );
  }
  if (directMatchMutations.length > 0) {
    throw new Error(
      `mutation directe interdite dans matches pour un Americano : ${directMatchMutations.join(" | ")}`,
    );
  }
  if (pageErrors.length > 0) {
    throw new Error(`erreurs page : ${[...new Set(pageErrors)].join(" | ")}`);
  }
  const unexpectedConsoleErrors = consoleErrors.filter(
    (entry) => {
      const expectedRosterFailure =
        entry.url.includes("/rest/v1/rpc/replace_event_roster") &&
        entry.text.includes("400");
      const expectedMockRealtimeFailure =
        entry.text.includes("WebSocket connection to 'ws://127.0.0.1:4545/realtime/v1/websocket") &&
        entry.text.includes("Connection closed before receiving a handshake response");
      return !expectedRosterFailure && !expectedMockRealtimeFailure;
    },
  );
  if (unexpectedConsoleErrors.length > 0) {
    throw new Error(
      `erreurs console : ${unexpectedConsoleErrors
        .map((entry) => `${entry.text} (${entry.url})`)
        .join(" | ")}`,
    );
  }

  console.log(
    "✅ Americano fixe : brouillon atomique, cycles 1-2, participant, classement et podium valides.",
  );
} finally {
  await browser.close();
}
