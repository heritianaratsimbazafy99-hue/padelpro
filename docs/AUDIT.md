# Audit UX/UI — PadelPro

Audit réalisé dans le cadre de la refonte visuelle (hero immersif GSAP, design system animé).
Chaque point est classé : ✅ corrigé dans cette refonte · 💡 recommandation future.

## 1. Première impression & landing

| Constat | Statut |
| --- | --- |
| Hero statique, peu différenciant, aucun mouvement | ✅ Hero plein écran : timeline GSAP (SplitText masqué par lignes), sol de terrain en perspective 3D, balles flottantes en parallaxe souris, carte de match live avec tilt 3D et score qui évolue tout seul |
| Aucune preuve visuelle du produit au-dessus de la ligne de flottaison | ✅ Carte « match live » animée directement dans le hero |
| CTA sans hiérarchie émotionnelle | ✅ Boutons magnétiques (GSAP quickTo), balayage lumineux `btn-shine`, halo lime |
| Sections défilantes sans rythme | ✅ Reveals ScrollTrigger, bandeau marquee incliné, chiffres clés en compteurs animés, bento grid avec spotlight curseur, CTA final géant en dégradé |
| Header générique | ✅ Nav flottante en pilule qui s'opacifie au scroll |

## 2. Design system

- ✅ Typographie display **Space Grotesk** (`--font-display`) pour les titres, Jakarta Sans pour le corps.
- ✅ Nouveaux utilitaires : `.text-gradient`, `.gradient-border`, `.card-lift`, `.spotlight`, `.btn-shine`, `.noise`, `.glow-scene`.
- ✅ Bibliothèque d'animations CSS : `fade-up`, `scale-in`, `sheet-up`, `backdrop-in`, `score-pop`, `ball-bounce` (loader), `shimmer` (squelettes), `marquee`, `float`, cascade `.stagger-i` pilotée par `--i`.
- ✅ `prefers-reduced-motion` respecté partout (CSS global + `gsap.matchMedia`).
- ✅ Scrollbar personnalisée discrète sur desktop.

## 3. Intuitivité (app authentifiée)

| Constat | Statut |
| --- | --- |
| Navigation basse sans indication forte de l'onglet actif | ✅ Pilule lumineuse qui glisse entre les onglets + icône qui se soulève |
| Chargements = spinner générique (layout shift) | ✅ Squelettes shimmer à la forme du contenu (dashboard, événements, classement, historique) ; loader global = balle de padel qui rebondit |
| Aucune transition entre les pages | ✅ `template.tsx` : fondu + translation à chaque navigation |
| Statistiques affichées brutes | ✅ Compteurs animés (`CountUp`) au dashboard et au profil |
| Événement « en cours » peu visible dans les listes | ✅ Point orange pulsant sur le badge |
| Champ code (rejoindre) : majuscules à la charge de l'utilisateur | ✅ `autoCapitalize` + `autoCorrect off` + `spellCheck false` + uppercase auto |
| Wizard de création : barre d'étapes binaire | ✅ Barre de progression fluide animée par étape |
| Saisie de score : pas de feedback à l'appui | ✅ Pop du chiffre à chaque changement (`score-pop`) |
| « Ton prochain match » (participant) noyé dans la page | ✅ Titre avec point lime pulsant + apparition animée |

## 4. Interactivité des modales

- ✅ Fermeture **Échap** sur toutes les surfaces : feuille de score, QR share, confirmations (hook `useEscapeClose`).
- ✅ Bottom sheet de score : vraie animation `sheet-up` + backdrop en fondu.
- ✅ Modales QR/confirmation : `scale-in` + backdrop en fondu.
- ✅ Clic sur l'arrière-plan ferme déjà (conservé).
- 💡 Piéger le focus dans les modales (focus-trap) et restaurer le focus à la fermeture.

## 5. Responsive

- ✅ Hero : typo fluide `clamp(2.6rem → 5.2rem)`, colonne unique < lg, carte match sous le texte, CTA pleine largeur sur mobile.
- ✅ `overflow-x: clip` global — le marquee incliné et les orbes ne créent jamais de scroll horizontal.
- ✅ Grilles bento : 1 col → 2 cols (sm) → 5 cols (lg).
- ✅ Effets survol conditionnés à `(hover: hover)` — pas de hover fantôme au tap mobile ; parallaxe souris et magnétisme désactivés sur écrans tactiles.
- ✅ Zones tactiles ≥ 44 px conservées (boutons score 48 px, nav basse), `pb-safe` pour l'encoche iOS.
- ✅ `font-size: 16px` sur les inputs (pas de zoom iOS).

## 6. Accessibilité

- ✅ `prefers-reduced-motion` : toutes les animations (CSS et GSAP) neutralisées.
- ✅ Décors `aria-hidden`, dialogues `role="dialog"` + `aria-modal`, loaders `role="status"`.
- ✅ Focus visibles (outline lime) conservés sur les boutons.
- 💡 Annoncer les mises à jour de score temps réel via `aria-live="polite"`.
- 💡 Contraste : vérifier `--ink-faint` (#5c6b87) sur `--surface` pour les très petits textes.

## 7. Recommandations futures (non bloquantes)

1. **Focus-trap** dans les modales (ou migration vers `<dialog>` natif).
2. **Optimistic UI** sur la saisie de score (mise à jour locale avant confirmation serveur).
3. **Vue TV / plein écran** du classement live pour le club (QR en overlay).
4. **Confettis** sur le podium en fin d'événement (canvas léger, respectant reduced-motion).
5. **PWA offline** : cacher le dernier état de l'événement pour les zones sans réseau.
6. **Swipe entre rounds** sur mobile (gestes horizontaux sur le sélecteur de rounds).

## 8. Refonte landing V2 — « Club Éditorial » (thème clair)

Direction artistique : papier crème (#f3f0e6), vert court profond (#14351f), lime signature, terracotta ; Space Grotesk (display) + Instrument Serif italique (accents éditoriaux).

- ✅ **ScrollSmoother** (inertie + parallaxe `data-speed`) sur desktop pointeur fin ; scroll natif sur mobile/tactile.
- ✅ Rideau d'intro CSS pur (2 panneaux), timeline hero SplitText par caractères, surligneur lime animé, badge circulaire tournant, balles flottantes (souris + scroll).
- ✅ **Deck de cartes empilées** (étapes 01→03) : pins ScrollTrigger + scale/fondu de la carte recouverte.
- ✅ **Manifeste scrub** : paragraphe géant révélé mot à mot au scroll (section vert court).
- ✅ **Rail horizontal épinglé** (fonctionnalités) avec barre de progression ; pile verticale en fallback mobile.
- ✅ Marquees inclinés réactifs à la vitesse de scroll (skew), sens inversés (vert / terracotta).
- ✅ Podium animé (elastic), classement live en cascade, stickers en parallaxe.
- ✅ CTA final poster lime avec mot fantôme en parallaxe, footer vert au logotype géant en contour.
- ✅ Curseur custom point + anneau (desktop uniquement), barre de progression de lecture.
- ✅ `prefers-reduced-motion` : tout est neutralisé (rideau masqué, aucun pin/scrub, contenu accessible d'emblée).

### Piège corrigé (important pour la suite)
`template.tsx` : l'animation d'entrée (`animate-page-in`, transform avec `fill: both`) faisait de son div le *containing block* de tous les descendants `position: fixed` (header flottant, wrapper ScrollSmoother) → double défilement et pins hors écran. La classe est désormais retirée en `onAnimationEnd`. Par ailleurs, ScrollSmoother doit être créé **avant** les ScrollTriggers épinglés (composant `GlobalMotion` monté en premier enfant), et les refs React d'un parent ne sont pas encore attachées pendant les effets de ses enfants (d'où un contexte GSAP global, sans scope).

## 9. Alignement de l'app sur la DA « Club Éditorial »

- ✅ La palette claire est désormais **globale** (`:root`) : landing et app authentifiée partagent les mêmes tokens (`.landing-light` n'est plus qu'un alias).
- ✅ Boutons en pilules : primaire vert court/crème (btn-shine), secondaire papier, focus ring vert court.
- ✅ Accents texte `text-lime` → `text-court` partout (contraste sur papier) ; éyebrows en terracotta ; statuts (success/danger/warning/info) réétalonnés pour fond clair.
- ✅ Nav basse : pilule active **lime pleine** + libellé vert court ; cartes avec ombre papier `shadow-club` ; rayons élargis (cartes 1.5rem, champs 1rem).
- ✅ Titres h1/h2 en Space Grotesk globalement ; médailles podium/classement recolorées (or ambre foncé, argent papier) ; backdrops de modales en voile vert (`bg-court/60` + blur).
- ✅ Utilitaires re-calibrés pour le clair : `court-grid`, `glow-scene`, `noise`, `gradient-border`, `text-gradient`, `card-lift` ; `theme_color`/`background_color` du manifest en crème.

## 10. Audit fonctionnel complet (E2E) & corrections

### Vérification
- ✅ **Moteur de jeu : 13/13 tests** (`node --test` sur `engine.test.ts`) — rotations americano, mexicano, brackets, équilibrage, stress 20 joueurs/10 rounds.
- ✅ **Base Supabase** : RLS actif sur les 4 tables ; les warnings « SECURITY DEFINER exécutable par anon » sur `report_score`/`claim_player`/`global_leaderboard` sont **voulus** (flux invités par QR code, validés par share_code).
- ✅ **E2E réel 10/10** via `scripts/supabase-mock.mjs` (mock GoTrue + PostgREST + RPC local) et `scripts/e2e.mjs` (Playwright) : signup → dashboard → wizard americano (4 joueurs/3 rounds) → lancement → QR/share code → claim joueur connecté → score participant → scores organisateur → classement live → clôture + podium → Elo global → profil/historique → logout/login. Zéro erreur JS.
  - Rejouer : `node scripts/supabase-mock.mjs 4545` + build avec `NEXT_PUBLIC_SUPABASE_URL=http://localhost:4545` + `node scripts/e2e.mjs`.

### Bugs corrigés
- `ScoreSheet` : sous-composant `ScoreRow` défini dans le rendu (DOM remonté à chaque frappe → perte de focus/animations) — extrait au niveau module.
- `use-event` : chargement initial annoté (les setState suivent des `await`) ; `bracket.ts` : `prefer-const` ; imports morts purgés (join, match-card, score-sheet). **Lint : 0 erreur, 0 warning.**

### Améliorations UI/UX
- 🏆 **Podium en estrade** : trois colonnes 2ᵉ·1ᵉʳ·3ᵉ qui montent en cascade (`podium-rise`), couronne terracotta flottante, points affichés, **confettis** aux couleurs du club (canvas léger sans dépendance, respecte reduced-motion) — reco n°4 de l'audit initial.
- Pop de score en terracotta (lisible sur papier), tampon E2E sur tout le parcours mobile.

## 11. Hero « L'Americano vivant », focus-trap, optimistic UI & passe d'animations

### Hero — refonte complète de l'animation (pièce maîtresse)
Trois concepts évalués : ① terrain de padel pseudo-3D qui joue un americano en
boucle, ② bracket qui se remplit tout seul, ③ mockup téléphone + flux QR.
Retenu : **① « L'Americano vivant »** (`src/components/landing/court-scene.tsx`),
le seul qui raconte TOUT le produit d'un coup d'œil — le padel, les rotations,
le score live, le classement.

- **Terrain pseudo-3D** en CSS pur (`rotateX(55°) rotateZ(-33°)`, `preserve-3d`) :
  surface vert court, marquages SVG crème, filet et vitre de fond « debout »
  (rotateX 90°), joueurs et balle **billboardés** (contre-rotation `rotateZ(33°)
  rotateX(-55°)`) pour rester face caméra.
- **Une timeline GSAP maîtresse déterministe** (scénario scripté, boucle ~30 s) :
  3 rounds d'americano avec **rotation des paires** (les pucks glissent vers
  leurs nouveaux slots, la couleur d'équipe des maillots change), échanges de
  balle avec vraie physique (arc via translateY billboardé, squash à la frappe,
  ombre qui se détache pendant le vol), score qui pope point par point, flash
  lime côté vainqueur, **classement live qui se réordonne** après chaque round,
  couronne du vainqueur au dernier round (Marco renverse Léa — il y a une
  histoire), puis reset chorégraphié.
- **Chips UI en espace écran** (scoreboard live, classement, sticker QR) en
  parallaxe souris, tilt 3D de toute la scène au survol (desktop pointeur fin).
- **Perf** : uniquement des transforms/opacity (compositeur GPU), ~20 éléments,
  zéro dépendance ajoutée, `ResizeObserver → invalidate()` pour le responsive.
- **Reduced-motion** : aucune timeline créée — la scène statique reste une
  illustration complète et lisible (joueurs placés, score 14–10, classement
  rempli). Conteneur `role="img"` + `aria-label` descriptif, tout le décor
  `aria-hidden`.

### Focus-trap (reco n°1 de l'audit initial) — ✅ fait
- Nouveau hook **`useFocusTrap`** (`motion.tsx`) : Tab/Shift+Tab bouclent dans
  le dialogue, focus initial sur `[data-autofocus]` ou le conteneur,
  **restauration au déclencheur** à la fermeture.
- Appliqué aux trois surfaces : `ScoreSheet`, `QRShare`, confirmation
  d'événement (`events/[id]`). Les backdrops passent en `tabIndex={-1}`
  (fermeture clavier = Échap ou bouton X, plus de tab-stop invisible).
- Couvert par l'E2E : cycle de 8 Tab dans la modale QR + restauration du focus,
  et cycle dans la feuille de score.

### Optimistic UI sur la saisie de score (reco n°2) — ✅ fait
- **`useEvent.reportScore()`** : le match passe `done` avec ses scores
  **localement, avant le RPC** → carte de match et classement bougent
  instantanément, la feuille se ferme sans attendre.
- **Anti-clignotement** : les patchs optimistes en attente sont réappliqués
  par-dessus tout rechargement concurrent (Realtime compris) via une map de
  matchs « pending », purgée à la confirmation ; la réconciliation `load()`
  ramène silencieusement la vérité serveur (mêmes valeurs → aucun flash).
- **Rollback propre** : en cas d'erreur RPC, le match d'origine est restauré,
  un `load()` resynchronise, et un **toast** d'erreur (nouveau composant
  `Toast`, `role="alert"`) explique — toast de succès sinon.
- Couvert par l'E2E : RPC volontairement **retardé de 1,2 s** (le score doit
  apparaître avant la réponse) et RPC **en échec simulé** (toast rouge + match
  restauré à « À jouer »).

### Passe d'animations sur la plateforme authentifiée
- **`Segmented`** : pilule lime **coulissante** entre les onglets (même langage
  que la nav basse), pression `active:scale`.
- **`Standings`** : réordonnancement **FLIP** (WAAPI, sans lib) — les lignes
  glissent vers leur nouveau rang quand un score tombe (optimiste ou Realtime).
- **`PopValue`** (kit UI) : pop terracotta d'un chiffre **uniquement quand la
  valeur change après montage** (aucun clignotement au chargement des listes) —
  appliqué aux scores des cartes de match, aux points du classement et au
  stepper du wizard.
- **`EmptyState`** : entrée `scale-in` (+ icône flottante existante) ;
  **`Toast`** réutilisable pour le feedback des actions clés.
- Déjà en place et conservés : transitions de pages (`template.tsx`), cascades
  `stagger-i` des listes, squelettes shimmer, pilule de nav basse, compteurs.
- `prefers-reduced-motion` : FLIP gardé par `matchMedia`, le reste neutralisé
  par la règle CSS globale.

### Vérification
- **E2E 12/12** (10 étapes historiques + 2 nouvelles : focus-trap, optimistic
  UI avec rollback), **zéro erreur JS** ; captures desktop/mobile + états
  intermédiaires de l'animation hero.
- **Moteur 13/13** (`node --test`), **lint 0 erreur / 0 warning**, build prod OK.

## 12. Itération 2 — americano à 8 joueurs, manifeste rebondissant, célébrations

### Hero : « Rotation des joueurs » (americano à 8)
- La scène passe de 4 à **8 joueurs** : Heritiana, Salman, Dera, Tsiresy sur le
  court ; Johary, Sanda, Frédérique, Teddy **au banc** (colonne « Au repos » le
  long du terrain). Scoreboard renommé « **Americano du lundi** ».
- Nouvelle transition « **Rotation des joueurs** » : le quatuor du court glisse
  vers le banc pendant que le banc entre en jeu (chip terracotta dédié, maillots
  qui changent de couleur : lime/terracotta sur le court, neutre au repos).
  Le round 3 mixe les deux groupes (« Rotation des paires » : les 4 meneurs se
  retrouvent) — libellés « Round n/7 » cohérents avec un americano à 8.
- **Classement à fenêtre top-4** : les 8 joueurs vivent dans la chip, seuls les
  4 premiers sont visibles ; aux changements de rang, les lignes glissent
  dedans/dehors (masquage + fondu). Scénario : Salman arrache la couronne.
- **Boost au scroll** (scrub) : la perspective du terrain se redresse légèrement
  (`rotationX/Z + scale` sur un wrapper dédié) pendant que le hero défile.
- Les noms du Showcase (« Pendant que tu joues ») et des podiums de la landing
  reprennent les 4 premiers : Heritiana, Salman, Dera, Tsiresy.

### Manifeste : la balle qui écrit la phrase
- Texte raccourci et percutant : « **Zéro papier. Zéro calcul.** *Juste du
  padel.* » (serif italique lime en chute).
- Une **balle de padel rebondit de mot en mot au scroll** (scrub GSAP +
  SplitText) : chaque impact « allume » le mot (opacité), l'enfonce brièvement
  et squashe la balle ; sortie de scène en fin de phrase. Positions
  fonctionnelles (`invalidateOnRefresh`) → responsive. Reduced-motion : texte
  plein, balle masquée.

### Annonce de score : célébrations aléatoires (victoire / défaite)
- Nouveau composant **`Celebration`** (`celebration.tsx`) : à chaque score
  annoncé sur un de MES matchs (côté participant), une célébration plein écran
  se joue — **3 variantes de victoire** (confettis + tampon « Victoire ! »,
  pluie de balles « Quel match ! », smash + onde de choc) et **3 variantes de
  défaite** (tampon terracotta + vignette, balle qui perd son énergie « Ça se
  rejouera. », balle dans le filet), tirées au hasard.
- Déclenchement via la transition `pending → done` des matchs : fonctionne pour
  **l'annonceur (optimistic)** comme pour **les 3 autres joueurs (Realtime)** ;
  anti-doublon par match, réarmé en cas de rollback. Overlay
  `pointer-events-none`, annonce `sr-only role=status`, keyframes neutralisées
  en reduced-motion. Le podium confettis existant est conservé.

### Un seul joueur annonce (vérifié + rendu explicite)
- Vérifié côté SQL : `report_score` valide par share_code, **aucune
  confirmation croisée requise** — n'importe quel joueur de la paire (ou
  l'organisateur) annonce, tout le monde reçoit en Realtime.
- Rendu visible : mention « *Un seul joueur annonce : le score se met à jour
  pour tout le monde, en direct.* » dans la feuille de score, et « Score
  annoncé par X » sur les cartes de match terminées.

### Swipe entre rounds (mobile)
- Sur la page organisateur, **glisser horizontalement** sur la liste des matchs
  change de round (seuil 56 px, geste franchement horizontal pour ne pas gêner
  le scroll) ; le contenu glisse dans le sens du geste (`slide-l/r`), pastilles
  et bouton « Voir le round suivant » alignés sur la même transition.

### Vérification (itération 2)
- **E2E 12/12** (dont célébration affichée à l'annonce participant), zéro
  erreur JS ; moteur **13/13** ; lint **0/0** ; build prod OK ; captures
  desktop + mobile (rotation des joueurs, banc, manifeste à 3 positions de
  scroll).
