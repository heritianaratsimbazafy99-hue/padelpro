# PadelPro 🎾

Webapp mobile-first pour organiser des **americanos, mexicanos et tournois de padel** :
rotations équitables, équipes équilibrées, QR code pour les joueurs, scores et classement en
temps réel, comptes joueurs avec statistiques.

**Production : https://padelpro-five.vercel.app**

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4) — déployé sur **Vercel**
- **Supabase** — Postgres + RLS, Auth (email/mot de passe), Realtime
- `qrcode.react`, `lucide-react`, police Plus Jakarta Sans

## Formats de jeu

| Format | Fonctionnement |
|---|---|
| **Americano** | Deux variantes : **Individuel · remixé** génère automatiquement des cycles équitables avec partenaires variés, repos répartis et classement individuel ; **Par équipes · fixe** conserve les binômes composés manuellement, aléatoirement ou selon le niveau, puis joue un round-robin complet avec classement collectif. Une fois un cycle terminé, l'organisateur peut choisir **Ajouter un cycle** pour prolonger l'événement sans perdre les scores précédents. |
| **Mexicano** | Round 1 aléatoire ou par niveau, puis chaque round est formé d'après le classement : dans chaque groupe de 4, le 1ᵉʳ joue avec le 4ᵉ contre 2ᵉ + 3ᵉ. |
| **Tournoi** | Équipes fixes (composition aléatoire ou équilibrée par niveau), tableau à élimination directe avec placement standard des têtes de série et byes automatiques. Le vainqueur est propagé dans le bracket par la base (RPC). |

Le moteur (`src/lib/engine/`) et les contrats applicatifs sont couverts par `npm test`.

## Flux QR

1. L'organisateur crée l'événement et saisit les joueurs.
2. Il partage le QR code (ou le code à 6 caractères) → `/join/[code]`.
3. Chaque joueur sélectionne son nom, voit son prochain match, annonce les scores.
4. S'il est connecté, sa fiche est liée à son compte → statistiques persistantes.

## Sécurité

- RLS : lecture publique des données de scoreboard, écriture réservée à l'organisateur.
- Les participants (même anonymes) écrivent uniquement via les RPC `report_score` /
  `claim_player` (SECURITY DEFINER), validées par le `share_code` et les règles du format
  (total de points exact, pas d'égalité en tournoi).

## Développement

```bash
npm install
npm run dev
```

Variables dans `.env.local` (des fallbacks publics existent dans `src/lib/supabase/config.ts`) :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Le schéma SQL de référence est dans `supabase/migrations/`.

### E2E (Playwright + mock Supabase local)

```bash
node scripts/supabase-mock.mjs 4545 &
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4545 npm run build
npx next start -p 3200 &
node scripts/e2e.mjs
node scripts/e2e-team-cycles.mjs
```

### Vérifications

```bash
npm test
node --test scripts/supabase-mock.test.mjs
npm run lint
npm run build
node scripts/e2e-team-cycles.mjs
```

Les emails d'authentification Supabase sont envoyés via SMTP Resend en production.
Les templates actifs sont versionnés dans `supabase/email-templates/`.
