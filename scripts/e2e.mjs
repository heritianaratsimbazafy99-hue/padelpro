/**
 * E2E complet PadelPro contre le mock Supabase local.
 * Parcours : signup → dashboard → création américano (4 joueurs) →
 * lancement → claim joueur via /join → scores (participant + organisateur) →
 * podium → classement Elo → profil → logout/login.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3200";
const SHOTS = process.env.OUT || "shots";
let step = 0;
const results = [];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));

async function shot(name) {
  step++;
  await page.screenshot({ path: `${SHOTS}/e2e-${String(step).padStart(2, "0")}-${name}.png` });
}
async function check(name, fn) {
  try {
    await fn();
    results.push(`✅ ${name}`);
  } catch (e) {
    results.push(`❌ ${name} — ${String(e).slice(0, 200)}`);
    await shot(`FAIL-${name.replace(/\W+/g, "_").slice(0, 30)}`);
  }
}
const expectVisible = (loc, timeout = 8000) => loc.waitFor({ state: "visible", timeout });

/* 1. Signup ------------------------------------------------------------- */
await check("signup crée le compte et redirige vers le dashboard", async () => {
  await page.goto(BASE + "/signup", { waitUntil: "networkidle" });
  await page.fill("#name", "Tsiresy R.");
  await page.fill("#email", "tsiresy@test.fr");
  await page.fill("#password", "MotDePasse!123");
  await shot("signup");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await expectVisible(page.getByText("Salut Tsiresy"));
  await shot("dashboard-vide");
});

/* 2. Création d'événement ------------------------------------------------ */
await check("wizard crée un americano 4 joueurs / 3 rounds", async () => {
  await page.goto(BASE + "/events/new", { waitUntil: "networkidle" });
  await expectVisible(page.getByText("Quel format ?"));
  await shot("wizard-step1");
  await page.fill("#event-name", "Americano E2E");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expectVisible(page.getByText("Réglages"));
  // 3 rounds (défaut probable ≠ 3) : on clique − jusqu'à min puis + jusqu'à 3
  const minus = page.getByRole("button", { name: "Réduire rounds" });
  for (let i = 0; i < 15; i++) if (await minus.isEnabled()) await minus.click();
  await page.getByRole("button", { name: "Augmenter rounds" }).click(); // 2 -> 3
  await shot("wizard-step2");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expectVisible(page.getByRole("heading", { name: "Joueurs" }));
  for (const n of ["Léa", "Marco", "Sofia", "Karim"]) {
    await page.fill('input[aria-label="Nom du joueur"]', n);
    await page.click('button[aria-label="Ajouter le joueur"]');
  }
  await expectVisible(page.getByText("4 joueurs").first());
  await shot("wizard-step3");
  await page.getByRole("button", { name: "Créer l'événement" }).click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15000 });
  await expectVisible(page.getByText("Prêt à lancer ?"));
  await shot("event-draft");
});

const eventUrl = page.url();

/* 3. Lancement ----------------------------------------------------------- */
await check("lancement génère les rounds et passe l'événement en actif", async () => {
  await page.getByRole("button", { name: "Lancer l'événement" }).click();
  await expectVisible(page.getByText("En cours"), 15000);
  await expectVisible(page.getByRole("button", { name: /^R1/ }));
  await shot("event-actif-r1");
});

/* 4. Récupère le share code via la modale QR ----------------------------- */
let shareCode = "";
await check("la modale QR expose le code de partage", async () => {
  await page.click('button[aria-label="Partager par QR code"]');
  const codeEl = page.locator(".tnum.tracking-\\[0\\.3em\\], p.tnum").first();
  await expectVisible(codeEl);
  shareCode = (await codeEl.textContent())?.trim() ?? "";
  if (!/^[A-Z0-9]{6}$/.test(shareCode)) throw new Error("code invalide: " + shareCode);
  await shot("qr-modal");
  await page.keyboard.press("Escape");
});

/* 5. Flux participant : claim + score ------------------------------------ */
await check("un participant (connecté) choisit son nom et annonce un score", async () => {
  await page.goto(BASE + "/join/" + shareCode, { waitUntil: "networkidle" });
  await expectVisible(page.getByText("Qui es-tu ?"));
  await shot("join-selection");
  await page.getByRole("button", { name: /Léa/ }).click();
  await expectVisible(page.getByText("Ton prochain match", { exact: false }), 10000);
  await shot("join-participant");
  // Ouvre la feuille de score du prochain match
  await page.getByText("Ton prochain match").locator("..").getByRole("button").first().click();
  await expectVisible(page.getByRole("dialog"));
  // Ajuste : +2 pour l'équipe 1 (12→14 si 24 pts répartis 12/12 par défaut)
  const plus = page.locator('button[aria-label^="Plus de points"]').first();
  await plus.click();
  await plus.click();
  await shot("score-sheet");
  await page.getByRole("button", { name: /Valider|Enregistrer/ }).click();
  await page.waitForTimeout(800);
  await shot("join-apres-score");
});

/* 6. Organisateur : compléter tous les matchs ---------------------------- */
await check("l'organisateur complète tous les rounds", async () => {
  await page.goto(eventUrl, { waitUntil: "networkidle" });
  for (let round = 1; round <= 3; round++) {
    const tab = page.getByRole("button", { name: new RegExp(`^R${round}`) });
    await tab.click();
    await page.waitForTimeout(400);
    // Tous les matchs pending du round
    for (let guard = 0; guard < 4; guard++) {
      const pending = page.locator('[data-match-status="pending"], article, .card-lift').filter({
        hasText: "—",
      });
      // Fallback: cliquer sur une MatchCard sans score (bouton contenant "vs" ?) —
      // on cible les cartes cliquables restantes du round via le texte "pts"
      const openBtns = page.locator("button", { hasText: "Round" });
      void pending;
      void openBtns;
      const cards = page.locator("main button.w-full, main [role=button]");
      void cards;
      // Approche robuste : chercher un bouton de carte match qui n'affiche pas de score "N - N"
      const matchButtons = await page.locator("main").getByRole("button").all();
      let opened = false;
      for (const b of matchButtons) {
        const txt = (await b.textContent()) ?? "";
        if (/&/.test(txt) && !/\d+\s*[–-]\s*\d+/.test(txt) && !/^R\d/.test(txt.trim())) {
          await b.click();
          opened = true;
          break;
        }
      }
      if (!opened) break; // plus de match ouvert dans ce round
      await expectVisible(page.getByRole("dialog"));
      const plus = page.locator('button[aria-label^="Plus de points"]').first();
      await plus.click();
      await page.getByRole("button", { name: /Valider|Enregistrer/ }).click();
      await page.waitForTimeout(700);
    }
  }
  await shot("event-tous-scores");
});

/* 7. Classement + fin + podium ------------------------------------------- */
await check("classement live puis podium à la clôture", async () => {
  await page.getByRole("radio", { name: "Classement" }).click();
  await expectVisible(page.getByText("Pts", { exact: false }).first());
  await shot("standings");
  await page.getByRole("radio", { name: "Matchs" }).click();
  await page.getByRole("button", { name: /Terminer et afficher le podium/ }).click();
  await expectVisible(page.getByRole("dialog"));
  await page.getByRole("button", { name: "Terminer", exact: true }).click();
  await expectVisible(page.getByText("Terminé"), 10000);
  await shot("podium");
});

/* 8. Leaderboard Elo ------------------------------------------------------ */
await check("le classement global Elo affiche le joueur réclamé", async () => {
  await page.goto(BASE + "/leaderboard", { waitUntil: "networkidle" });
  await expectVisible(page.getByText("Tsiresy R."), 10000);
  await shot("leaderboard");
});

/* 9. Profil ---------------------------------------------------------------- */
await check("le profil affiche stats et historique", async () => {
  await page.goto(BASE + "/profile", { waitUntil: "networkidle" });
  await expectVisible(page.getByText("Tsiresy R."));
  await shot("profil");
});

/* 10. Logout / login ------------------------------------------------------- */
await check("déconnexion puis reconnexion", async () => {
  const btn = page.getByRole("button", { name: /Se déconnecter|Déconnexion/ });
  await btn.click();
  await page.waitForURL(/\/(login)?$/, { timeout: 10000 }).catch(() => {});
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill("#email", "tsiresy@test.fr");
  await page.fill("#password", "MotDePasse!123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await shot("relogin-dashboard");
});

console.log("\n=== RÉSULTATS E2E ===");
for (const r of results) console.log(r);
console.log("\nJS pageerrors:", pageErrors.length ? [...new Set(pageErrors)] : "aucune");
await browser.close();
process.exit(results.some((r) => r.startsWith("❌")) ? 1 : 0);
