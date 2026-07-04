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
