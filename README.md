# Sounding Board

Bounce any personal question off a whole cast of advisors and hear it answered from very different places: **Family** (Mom, Dad, Grandma, Grandpa), **Fresh perspectives** (a Random Stranger, a ten-year-old Kid, an alien Visitor), **Voices from history** (Julius Caesar, Napoleon, George Washington, Abraham Lincoln, and an Elder who marched in the civil rights movement), and **Faith** (Biblical Counsel). Every advisor is an AI character, honest about it, and puts your safety first. Historical advisors are openly-labeled dramatizations that speak in the person's spirit, never invent quotations, and own the real person's failures.

Formerly "Hearth" (working title).

**Live web beta:** https://sdesgrosellier.github.io/sounding-board/ — deployed by GitHub Actions on every push to `main`.

**Status:** Phase 1 (Foundation) complete and live. See `docs/ARCHITECTURE.md` for the stack decision, cost model, diagram, and risks, and `docs/PHASE-1-TEST-CHECKLIST.md` for how to verify this phase.

```
sounding-board/
├── app/                      Expo (React Native + TypeScript) mobile app
│   ├── app/                  expo-router screens
│   │   └── src/screens       sign-in (email + password) and onboarding, rendered by the auth gate
│   │   └── (app)/            home, chat/[advisorId], settings
│   └── src/                  components, lib (supabase, auth, streaming), theme, config
├── supabase/
│   ├── migrations/           schema + Row-Level Security (all Section 13 tables)
│   ├── seed.sql              persona rows
│   └── functions/
│       ├── chat/             streaming single-advisor chat (SSE)
│       └── _shared/          safety layer, prompt assembler, Claude client,
│                             persona JSON (13 advisors + 14 stranger archetypes)
├── scripts/                  bundle-function.mjs (single-file Edge Function build), decorate-web-shell.mjs
├── .github/workflows/        deploy-web.yml → GitHub Pages
└── docs/
```

---

## Adding an advisor

1. Add `supabase/functions/_shared/personas/<id>.json` (copy an existing one; set `category` to `family`, `fresh`, `history`, or `faith`, and `"historical": true` for a real person).
2. Register it in `supabase/functions/_shared/personas/index.ts` and add the same id to `app/src/config/advisors.ts` (name, emoji, accent, tagline, presence, optional `disclosure`).
3. `node scripts/bundle-function.mjs`, redeploy the `chat` function, push to `main`.

---

## What you (the product owner) need to do

1. **Supabase project** — create one at supabase.com (free tier is fine for development). From Project Settings → API, copy the **Project URL**, **anon key**, and **service_role key**.
2. **Anthropic API key** — create one at platform.claude.com and add a small prepaid balance.
3. **Install tooling** on your computer:
   - Node.js 22+ and npm
   - Supabase CLI: `npm install -g supabase` (or `brew install supabase/tap/supabase`)
   - Expo Go on your phone (App Store / Play Store) for Phase 1–3 testing. Phase 4 (voice) needs a dev build.
4. **Sign-in email** — the beta uses email + password with "Confirm email" turned off. Before a public launch, add a custom SMTP provider in Authentication → SMTP Settings and turn confirmation back on.

Nothing else is needed for Phase 1. ElevenLabs/Deepgram accounts come in Phase 4.

---

## Setup

### 1. Database

```bash
cd sounding-board
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push                 # applies supabase/migrations/*
psql "$(supabase db url)" -f supabase/seed.sql   # optional: persona rows for admin browsing
```

Or run everything locally: `supabase start` (Docker), which applies migrations + seed automatically and prints local keys. Auth emails for local dev show up in Inbucket at http://localhost:54324.

### 2. Edge Function

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# Optional overrides (defaults shown):
# supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5-5 ANTHROPIC_FAST_MODEL=claude-haiku-5-5
supabase functions deploy chat
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected into Edge Functions automatically.

Local: `supabase functions serve --env-file supabase/.env.local` with `ANTHROPIC_API_KEY=...` in that file.

### 3. App

```bash
cd app
cp .env.example .env            # fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run typecheck               # should print nothing
npx expo start                  # scan the QR code with Expo Go, or press i / a for simulators
```

For a physical phone against a *local* Supabase, use your machine's LAN IP in `EXPO_PUBLIC_SUPABASE_URL` (e.g. `http://192.168.1.10:54321`), not `localhost`.

### Environment variables

| Where | Variable | Purpose |
|---|---|---|
| App (`app/.env`) | `EXPO_PUBLIC_SUPABASE_URL` | Project URL |
| App (`app/.env`) | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe to ship; RLS protects data) |
| Edge Functions (secrets) | `ANTHROPIC_API_KEY` | Claude API |
| Edge Functions (secrets) | `ANTHROPIC_MODEL` | Advisor model (default `claude-sonnet-5-5`) |
| Edge Functions (secrets) | `ANTHROPIC_FAST_MODEL` | Summaries/classification (default `claude-haiku-5-5`) |

Never put the Anthropic key or the service-role key in the app.

---

## How it works (Phase 1)

1. The app signs in with email + password and reads its `profiles` row (created by a DB trigger).
2. Home lets the user pick one advisor and type a question; Chat opens and calls `POST /functions/v1/chat` with the user's JWT.
3. The `chat` function verifies the user, loads or creates a `sessions` row, pulls the last 20 turns, and assembles the prompt from nine blocks: global safety layer → app context → persona JSON → mode → profile/preferences → memory (empty until Phase 3) → date → history → message.
4. Claude Sonnet 5.5 streams the reply. The function forwards text as SSE `delta` events and withholds the trailing `<<<META>>>` JSON (headline, tone, follow-up, scripture refs, candidate facts, safety flag).
5. The advisor message is saved, usage is metered, and a `done` event closes the stream. A `crisis` safety flag opens the in-app resources card.

The Random Stranger gets one of 14 archetypes per session (stored in `sessions.meta`) and introduces themself on the first turn.

---

## Phase roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, auth, schema + RLS, 13 personas, prompt assembler, text chat, web deploy | ✅ |
| 2 | Advice Panel: parallel advisors, streaming cards, synthesis, feedback, history | next |
| 3 | Memory: summaries, fact extraction, embeddings, retrieval, My Story, follow-ups | |
| 4 | Voice: per-persona TTS, streaming STT, barge-in, call screen | |
| 5 | Scripture verification (bundled WEB/KJV) | |
| 6 | Safety classifier, crisis flow, eval suite, export/delete | |
| 7 | Onboarding polish, accessibility, notifications, monetization, store submission | |
