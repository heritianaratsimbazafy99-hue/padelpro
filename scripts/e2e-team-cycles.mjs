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
const MOCK_URL = "http://127.0.0.1:4545";
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
let intentionalRpcFailure = null;

page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push({
      text: message.text(),
      url: message.location().url,
      intentionalRpcFailure,
    });
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

async function readMockRows(table, params) {
  const url = new URL(`/rest/v1/${table}`, MOCK_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `lecture REST ${table} refusée : HTTP ${response.status} ${await response.text()}`,
    );
  }
  return response.json();
}

async function waitForMockRows(table, params, predicate, label, timeout = 8_000) {
  const deadline = Date.now() + timeout;
  let rows = [];
  while (Date.now() < deadline) {
    rows = await readMockRows(table, params);
    if (predicate(rows)) return rows;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${label} n'est pas devenu observable via REST : ${JSON.stringify(rows)}`);
}

function eventIdFromUrl(url) {
  const eventId = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
    throw new Error(`identifiant d'événement invalide dans ${url}`);
  }
  return eventId.toLowerCase();
}

const MOCK_REALTIME_CONSOLE_ERROR =
  /^WebSocket connection to 'ws:\/\/127\.0\.0\.1:4545\/realtime\/v1\/websocket\?apikey=[^']+&vsn=2\.0\.0' failed: Connection closed before receiving a handshake response$/;
const INTENTIONAL_400_CONSOLE_ERROR =
  /^Failed to load resource: the server responded with a status of 400 \(Bad Request\)$/;

function isExpectedMockRealtimeError(entry) {
  if (!MOCK_REALTIME_CONSOLE_ERROR.test(entry.text)) return false;
  try {
    const location = new URL(entry.url);
    return (
      location.origin === BASE_URL &&
      location.pathname.startsWith("/_next/static/chunks/")
    );
  } catch {
    return false;
  }
}

function isExpectedIntentionalRpcFailure(entry, rpcName) {
  if (entry.intentionalRpcFailure !== rpcName) return false;
  if (!INTENTIONAL_400_CONSOLE_ERROR.test(entry.text)) return false;
  try {
    return new URL(entry.url).pathname === `/rest/v1/rpc/${rpcName}`;
  } catch {
    return false;
  }
}

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
  const fixedCaptureStart = {
    events: eventPayloads.length,
    rosters: rosterPayloads.length,
    deletes: eventDeletes.length,
    cycles: cyclePayloads.length,
    scores: scorePayloads.length,
  };
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
  intentionalRpcFailure = "replace_event_roster";
  await createButton.click();
  await expectVisible(page.getByRole("alert").getByText("La liste des joueurs est invalide."));
  await rollbackRequest;
  await page.waitForLoadState("networkidle");
  intentionalRpcFailure = null;
  if (!(await createButton.isEnabled())) {
    throw new Error("le bouton de création reste désactivé après rollback");
  }
  const firstRosterPayload = rosterPayloads.at(fixedCaptureStart.rosters);

  await createButton.click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  const eventUrl = page.url();
  const fixedEventId = eventIdFromUrl(eventUrl);

  const fixedRosterAttempts = rosterPayloads.slice(fixedCaptureStart.rosters);
  const rosterPayload = fixedRosterAttempts.at(-1);
  if (!firstRosterPayload || !rosterPayload || fixedRosterAttempts.length !== 2) {
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
  const fixedEventPayloads = eventPayloads.slice(fixedCaptureStart.events);
  const fixedEventDeletes = eventDeletes.slice(fixedCaptureStart.deletes);
  if (fixedEventPayloads.length !== 2 || fixedEventDeletes.length !== 1) {
    throw new Error(
      `rollback incomplet : ${fixedEventPayloads.length} créations, ${fixedEventDeletes.length} suppression`,
    );
  }
  for (const eventPayload of fixedEventPayloads) {
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
  if (cyclePayloads.length !== fixedCaptureStart.cycles) {
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
  if (cyclePayloads.length !== fixedCaptureStart.cycles) {
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
  const teamNumberById = new Map(
    finalRoster.map((player) => [player.id.toLowerCase(), player.team_number]),
  );
  const fixedTeamIds = new Map();
  for (const player of finalRoster) {
    fixedTeamIds.set(player.team_number, [
      ...(fixedTeamIds.get(player.team_number) ?? []),
      player.id.toLowerCase(),
    ]);
  }
  const fixedCyclePayloads = () =>
    cyclePayloads.filter(
      (payload) => String(payload.p_event_id).toLowerCase() === fixedEventId,
    );

  async function assertMatchCardContract(card, cycleNumber, roundNumber, status) {
    const cyclePayload = fixedCyclePayloads().find(
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

  const [persistedRoundOne] = await waitForMockRows(
    "matches",
    {
      event_id: `eq.${fixedEventId}`,
      cycle_number: "eq.1",
      round_number: "eq.1",
      order: "court.asc",
      select:
        "id,status,cycle_number,round_number,court,team1_p1,team1_p2,team2_p1,team2_p2",
    },
    (rows) => rows.length === 1,
    "le round 1 fixe",
  );
  if (
    !/^[0-9a-f-]{36}$/i.test(persistedRoundOne.id ?? "") ||
    persistedRoundOne.status !== "pending" ||
    persistedRoundOne.cycle_number !== 1 ||
    persistedRoundOne.round_number !== 1
  ) {
    throw new Error(`round 1 REST invalide : ${JSON.stringify(persistedRoundOne)}`);
  }
  const roundOneActiveIds = new Set(
    [
      persistedRoundOne.team1_p1,
      persistedRoundOne.team1_p2,
      persistedRoundOne.team2_p1,
      persistedRoundOne.team2_p2,
    ].map((id) => String(id).toLowerCase()),
  );
  const roundOneRestingTeams = [...fixedTeamIds.entries()]
    .filter(([, memberIds]) => memberIds.every((id) => !roundOneActiveIds.has(id)))
    .map(([teamNumber]) => teamNumber);
  if (roundOneRestingTeams.length !== 1) {
    throw new Error(
      `le round 1 REST ne désigne pas une équipe au repos : ${roundOneRestingTeams}`,
    );
  }

  function teamNumbersInText(text) {
    return [...finalTeams.entries()]
      .filter(([, members]) => members.every((name) => text.includes(name)))
      .map(([teamNumber]) => teamNumber)
      .sort((first, second) => first - second);
  }

  const cycleOnePairings = new Set();
  const cycleOneTeamsByRound = new Map();
  const firstRestingTeam = roundOneRestingTeams[0];
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
    if (round === 1 && restingTeams[0] !== firstRestingTeam) {
      throw new Error("le repos du round 1 affiché diverge de la ligne REST persistée");
    }
    const restPrefixes = page.getByText("Au repos :", { exact: true });
    if ((await restPrefixes.count()) !== 1) {
      throw new Error(
        `le round fixe ${round} affiche ${await restPrefixes.count()} libellé(s) de repos`,
      );
    }
    const restLabel = restPrefixes.locator("..");
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
  if (!restingMembers || restingMembers.length !== 2) {
    throw new Error("le binôme au repos du round 1 est introuvable");
  }
  const participantName = restingMembers[0];
  const fixedPartnerName = restingMembers[1];
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
  const participantMatchName = (await participantMatch.getAttribute("aria-label")) ?? "";
  const parsedParticipantMatch =
    /^Annoncer le score : (.+) et (.+) contre (.+) et (.+), terrain \d+$/.exec(
      participantMatchName,
    );
  const participantSides = parsedParticipantMatch
    ? [parsedParticipantMatch.slice(1, 3), parsedParticipantMatch.slice(3, 5)]
    : [];
  const participantSide = participantSides.find((side) => side.includes(participantName));
  if (!participantSide || !participantSide.includes(fixedPartnerName)) {
    throw new Error(
      `le prochain match ne conserve pas le partenaire fixe ${fixedPartnerName} : ${participantMatchName}`,
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
    const teamRow = participantTable.getByRole("row").filter({ hasText: label });
    if ((await teamRow.count()) !== 1) {
      throw new Error(`le binôme ${label} n'a pas une ligne participant unique`);
    }
    const rowText = (await teamRow.textContent()) ?? "";
    if (!names.every((name) => rowText.includes(name))) {
      throw new Error(`la ligne participant ne contient pas les deux membres de ${label}`);
    }
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
    if (round < 3) {
      await expectVisible(
        page.getByRole("button", {
          name: `Voir R${round + 1}`,
          exact: true,
        }),
      );
    }
    const expectedActions = round === 3 ? 1 : 0;
    if (
      (await addCycleButton.count()) !== expectedActions ||
      (await completeEventButton.count()) !== expectedActions
    ) {
      throw new Error(`actions de fin invalides après le score ${round} du cycle 1`);
    }
  }
  if (scorePayloads.length - fixedCaptureStart.scores !== 3) {
    throw new Error(
      `nombre de scores cycle 1 inattendu : ${scorePayloads.length - fixedCaptureStart.scores}`,
    );
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
  for (const heading of ["Équipe", "J", "V", "N", "D", "Pour", "Contre", "Diff."]) {
    await expectVisible(
      organizerTable.getByRole("columnheader", { name: heading, exact: true }),
    );
  }
  if ((await organizerTable.getByRole("row").count()) !== 4) {
    throw new Error("le classement collectif organisateur ne contient pas trois équipes");
  }
  for (const names of finalTeams.values()) {
    const label = [...names].sort((first, second) => first.localeCompare(second)).join(" & ");
    const teamRow = organizerTable.getByRole("row").filter({ hasText: label });
    if ((await teamRow.count()) !== 1) {
      throw new Error(`le binôme ${label} n'a pas une ligne organisateur unique`);
    }
    const rowText = (await teamRow.textContent()) ?? "";
    if (!names.every((name) => rowText.includes(name))) {
      throw new Error(`la ligne organisateur ne contient pas les deux membres de ${label}`);
    }
  }
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
    await expectVisible(
      page.getByRole("button", { name: new RegExp(`^Cycle 2 · R${localRound}`) }),
    );
  }

  const persistedFixedMatches = await waitForMockRows(
    "matches",
    {
      event_id: `eq.${fixedEventId}`,
      order: "cycle_number.asc,round_number.asc,court.asc",
      select:
        "id,cycle_number,round_number,court,team1_p1,team1_p2,team2_p1,team2_p2",
    },
    (rows) => rows.length === 6,
    "les six matchs fixes après ajout du cycle 2",
  );
  const persistedCycleTwo = persistedFixedMatches.filter(
    (match) => match.cycle_number === 2,
  );
  const cycleTwoRounds = persistedCycleTwo
    .map((match) => match.round_number)
    .sort((first, second) => first - second);
  if (
    persistedCycleTwo.length !== 3 ||
    JSON.stringify(cycleTwoRounds) !== JSON.stringify([4, 5, 6])
  ) {
    throw new Error(`lignes persistées du cycle 2 invalides : ${JSON.stringify(persistedCycleTwo)}`);
  }
  const persistedTuples = persistedFixedMatches.map(
    (match) => `${match.cycle_number}:${match.round_number}:${match.court}`,
  );
  if (new Set(persistedTuples).size !== persistedTuples.length) {
    throw new Error(`tuple (cycle, round, terrain) dupliqué : ${persistedTuples}`);
  }
  for (const match of persistedCycleTwo) {
    const firstTeam = [match.team1_p1, match.team1_p2].map((id) =>
      teamNumberById.get(String(id).toLowerCase()),
    );
    const secondTeam = [match.team2_p1, match.team2_p2].map((id) =>
      teamNumberById.get(String(id).toLowerCase()),
    );
    if (
      firstTeam.some((teamNumber) => teamNumber == null) ||
      secondTeam.some((teamNumber) => teamNumber == null) ||
      firstTeam[0] !== firstTeam[1] ||
      secondTeam[0] !== secondTeam[1]
    ) {
      throw new Error(`un binôme fixe a changé dans le cycle 2 : ${JSON.stringify(match)}`);
    }
  }
  const persistedFixedRoster = await readMockRows("event_players", {
    event_id: `eq.${fixedEventId}`,
    order: "seed.asc",
    select: "id,seed,team_number",
  });
  if (
    persistedFixedRoster.length !== finalRoster.length ||
    persistedFixedRoster.some(
      (player) =>
        teamNumberById.get(String(player.id).toLowerCase()) !== player.team_number,
    )
  ) {
    throw new Error("les affectations persistées ont changé après le cycle 2");
  }

  for (let localRound = 1; localRound <= 3; localRound++) {
    await completeRound(2, localRound, localRound + 3);
    if (localRound < 3) {
      await expectVisible(
        page.getByRole("button", {
          name: `Voir Cycle 2 · R${localRound + 1}`,
          exact: true,
        }),
      );
    }
    const expectedActions = localRound === 3 ? 1 : 0;
    if (
      (await addCycleButton.count()) !== expectedActions ||
      (await completeEventButton.count()) !== expectedActions
    ) {
      throw new Error(`actions de fin invalides après le score ${localRound} du cycle 2`);
    }
  }
  if (scorePayloads.length - fixedCaptureStart.scores !== 6) {
    throw new Error(
      `nombre de scores total inattendu : ${scorePayloads.length - fixedCaptureStart.scores}`,
    );
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
  for (const cyclePayload of fixedCyclePayloads()) {
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

  const capturedFixedCyclePayloads = fixedCyclePayloads();
  if (
    JSON.stringify(capturedFixedCyclePayloads.map((payload) => payload.p_expected_cycle)) !==
    JSON.stringify([1, 2])
  ) {
    throw new Error(
      `payloads de cycle fixe inattendus : ${JSON.stringify(capturedFixedCyclePayloads)}`,
    );
  }
  const fixedScorePayloads = scorePayloads.slice(fixedCaptureStart.scores);
  if (
    fixedScorePayloads.length !== 6 ||
    new Set(fixedScorePayloads.map((payload) => payload.p_match_id)).size !== 6
  ) {
    throw new Error("les six scores n'ont pas ciblé six matchs distincts");
  }

  const remixedCaptureStart = {
    events: eventPayloads.length,
    rosters: rosterPayloads.length,
    cycles: cyclePayloads.length,
    scores: scorePayloads.length,
  };
  const remixedNames = ["Ana", "Basile", "Chloé", "Dario", "Élise", "Felix"];

  await page.goto(`${BASE_URL}/events/new`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: /^Americano/ }).click();
  await page.fill("#event-name", "Americano remixé E2E");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expectVisible(page.getByRole("heading", { name: "Réglages" }));
  await page.getByRole("button", { name: "Réduire terrains" }).click();
  await waitForButtonState(page.getByRole("button", { name: "Réduire terrains" }), false);
  await page.getByRole("radio", { name: "Individuel · remixé" }).click();
  await page.getByRole("radio", { name: "Aléatoire" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expectVisible(page.getByRole("heading", { name: "Joueurs" }));

  for (const name of remixedNames) {
    await page.getByRole("textbox", { name: "Nom du joueur" }).fill(name);
    await page.getByRole("button", { name: "Ajouter le joueur" }).click();
  }
  await expectVisible(
    page.getByText("6 joueurs · 3 rounds · 2 matchs et 1 repos par joueur", {
      exact: true,
    }),
  );
  await page.getByRole("button", { name: "Créer l'événement" }).click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  const remixedEventId = eventIdFromUrl(page.url());
  if (remixedEventId === fixedEventId) {
    throw new Error("les scénarios fixe et remixé ont réutilisé le même événement");
  }

  const remixedEventPayloads = eventPayloads.slice(remixedCaptureStart.events);
  const remixedRosterPayloads = rosterPayloads.slice(remixedCaptureStart.rosters);
  if (remixedEventPayloads.length !== 1 || remixedRosterPayloads.length !== 1) {
    throw new Error(
      `captures remixées non isolées : ${remixedEventPayloads.length} événement, ${remixedRosterPayloads.length} roster`,
    );
  }
  const expectedRemixedSettings = {
    points_per_match: 24,
    courts: 1,
    rounds: 3,
    pairing: "random",
    team_mode: "remixed",
    composition: "random",
    rounds_per_cycle: 3,
  };
  if (
    JSON.stringify(remixedEventPayloads[0].settings) !==
    JSON.stringify(expectedRemixedSettings)
  ) {
    throw new Error(
      `settings de l'Americano remixé invalides : ${JSON.stringify(remixedEventPayloads[0].settings)}`,
    );
  }
  const remixedRosterPayload = remixedRosterPayloads[0];
  if (
    String(remixedRosterPayload.p_event_id).toLowerCase() !== remixedEventId ||
    remixedRosterPayload.p_rounds_per_cycle !== 3 ||
    remixedRosterPayload.p_players.length !== 6 ||
    remixedRosterPayload.p_players.some((player) => player.team_number !== null)
  ) {
    throw new Error(`roster remixé invalide : ${JSON.stringify(remixedRosterPayload)}`);
  }

  const remixedCycleResponsePromise = waitForRpcResponse("commit_americano_cycle");
  await page.getByRole("button", { name: "Lancer l'événement" }).click();
  const remixedCycleResponse = await remixedCycleResponsePromise;
  if (!remixedCycleResponse.ok()) {
    throw new Error(`lancement remixé refusé : HTTP ${remixedCycleResponse.status()}`);
  }
  await expectVisible(page.getByText("En cours", { exact: true }), 15_000);
  await expectVisible(page.getByText("Équipes remixées", { exact: true }));
  await expectVisible(page.getByText("Cycle 1", { exact: true }));

  const remixedCyclePayloads = cyclePayloads
    .slice(remixedCaptureStart.cycles)
    .filter((payload) => String(payload.p_event_id).toLowerCase() === remixedEventId);
  if (
    remixedCyclePayloads.length !== 1 ||
    remixedCyclePayloads[0].p_expected_cycle !== 1 ||
    remixedCyclePayloads[0].p_matches.length !== 3
  ) {
    throw new Error(`cycle remixé non isolé : ${JSON.stringify(remixedCyclePayloads)}`);
  }

  const appearances = new Map(remixedNames.map((name) => [name, 0]));
  const rests = new Map(remixedNames.map((name) => [name, 0]));
  const partnerPairs = [];
  for (let round = 1; round <= 3; round++) {
    await page.getByRole("button", { name: new RegExp(`^R${round}`) }).click();
    const card = page.locator(
      `button[data-match-status="pending"][data-cycle-number="1"][data-round-number="${round}"][data-court="1"]`,
    );
    await expectVisible(card);
    const accessibleName = (await card.getAttribute("aria-label")) ?? "";
    const parsed =
      /^Annoncer le score : (.+) et (.+) contre (.+) et (.+), terrain 1$/.exec(
        accessibleName,
      );
    if (!parsed) {
      throw new Error(`carte remixée illisible au round ${round} : ${accessibleName}`);
    }
    const matchNames = parsed.slice(1, 5);
    if (
      new Set(matchNames).size !== 4 ||
      matchNames.some((name) => !appearances.has(name))
    ) {
      throw new Error(`joueurs remixés invalides au round ${round} : ${matchNames}`);
    }
    for (const name of matchNames) {
      appearances.set(name, appearances.get(name) + 1);
    }
    partnerPairs.push(
      [matchNames[0], matchNames[1]].sort().join(" + "),
      [matchNames[2], matchNames[3]].sort().join(" + "),
    );

    const expectedRestNames = remixedNames.filter((name) => !matchNames.includes(name));
    const restPrefixes = page.getByText("Au repos :", { exact: true });
    if ((await restPrefixes.count()) !== 1) {
      throw new Error(
        `le round remixé ${round} affiche ${await restPrefixes.count()} libellé(s) de repos`,
      );
    }
    const restMessage = restPrefixes.locator("..");
    await expectVisible(restMessage);
    const restText = ((await restMessage.textContent()) ?? "").trim();
    const displayedRestNames = restText
      .replace(/^Au repos :\s*/, "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .sort((first, second) => first.localeCompare(second));
    const sortedExpectedRestNames = [...expectedRestNames].sort((first, second) =>
      first.localeCompare(second),
    );
    if (
      expectedRestNames.length !== 2 ||
      JSON.stringify(displayedRestNames) !== JSON.stringify(sortedExpectedRestNames)
    ) {
      throw new Error(`repos remixés invalides au round ${round} : ${restText}`);
    }
    for (const name of expectedRestNames) {
      rests.set(name, rests.get(name) + 1);
    }
  }

  for (const name of remixedNames) {
    if (appearances.get(name) !== 2) {
      throw new Error(`${name} ne joue pas exactement deux fois`);
    }
    if (rests.get(name) !== 1) {
      throw new Error(`${name} ne se repose pas exactement une fois`);
    }
  }
  if (partnerPairs.length !== 6 || new Set(partnerPairs).size !== 6) {
    throw new Error("un partenaire a été répété");
  }
  if (scorePayloads.length !== remixedCaptureStart.scores) {
    throw new Error("le scénario remixé a annoncé un score inattendu");
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
  const expectedIntentionalRosterErrors = consoleErrors.filter((entry) =>
    isExpectedIntentionalRpcFailure(entry, "replace_event_roster"),
  );
  if (expectedIntentionalRosterErrors.length !== 1) {
    throw new Error(
      `la fenêtre 400 replace_event_roster a produit ${expectedIntentionalRosterErrors.length} erreur(s) console au lieu d'une`,
    );
  }
  const unexpectedConsoleErrors = consoleErrors.filter(
    (entry) =>
      !isExpectedIntentionalRpcFailure(entry, "replace_event_roster") &&
      !isExpectedMockRealtimeError(entry),
  );
  if (unexpectedConsoleErrors.length > 0) {
    throw new Error(
      `erreurs console : ${unexpectedConsoleErrors
        .map((entry) => `${entry.text} (${entry.url})`)
        .join(" | ")}`,
    );
  }

  console.log(
    "✅ Americano fixe et remixé : cycles, repos, partenaires, classement et podium valides.",
  );
} finally {
  await browser.close();
}
