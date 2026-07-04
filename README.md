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
| **Americano** | Tournoi individuel. Tous les rounds sont générés au lancement avec une rotation optimisée : aucun partenaire répété tant qu'une alternative existe, adversaires variés, repos répartis (écart max 1). Score individuel = points cumulés. |
| **Mexicano** | Round 1 aléatoire ou par niveau, puis chaque round est formé d'après le classement : dans chaque groupe de 4, le 1ᵉʳ joue avec le 4ᵉ contre 2ᵉ + 3ᵉ. |
| **Tournoi** | Équipes fixes (composition aléatoire ou équilibrée par niveau), tableau à élimination directe avec placement standard des têtes de série et byes automatiques. Le vainqueur est propagé dans le bracket par la base (RPC). |

Le moteur (`src/lib/engine/`) est couvert par des tests : `node --test src/lib/engine/engine.test.ts`.

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

> Note : la confirmation d'email est activée par défaut sur Supabase. Pour des inscriptions
> instantanées : Dashboard Supabase → Authentication → Sign In / Up → Email → désactiver
> « Confirm email ».
