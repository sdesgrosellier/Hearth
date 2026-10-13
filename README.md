# Hearth

Advice from the voices you trust: Mom, Dad, Grandma or Grandpa, a Random Stranger, or Biblical Counsel. Every advisor is an AI character, honest about it, and puts your safety first.

**Status:** Phase 1 (Foundation) complete. See `docs/ARCHITECTURE.md` for the stack decision, cost model, diagram, and risks, and `docs/PHASE-1-TEST-CHECKLIST.md` for how to verify this phase.

```
hearth/
├── app/                      Expo (React Native + TypeScript) mobile app
│   ├── app/                  expo-router screens
│   │   ├── (auth)/sign-in    email one-time-code sign-in
│   │   ├── onboarding        AI disclosure, name, grandparent, 18+, memory
│   │   └── (app)/            home, chat/[advisorId], settings
│   └── src/                  components, lib (supabase, auth, streaming), theme, config
├── supabase/
│   ├── migrations/           schema + Row-Level Security (all Section 13 tables)
│   ├── seed.sql              persona rows
│   └── functions/
│       ├── chat/             streaming single-advisor chat (SSE)
│       └── _shared/          safety layer, prompt assembler, Claude client,
│                             persona JSON (6 advisors + 14 stranger archetypes)
└── docs/
```

---

## What you (the product owner) need to do

1. **Supabase project** — create one at supabase.com (free tier is fine for development). From Project Settings → API, copy the **Project URL**, **anon key**, and **service_role key**.
2. **Anthropic API key** — create one at platform.claude.com and add a small prepaid balance.
3. **Install tooling** on your computer:
   - Node.js 22+ and npm
   - Supabase CLI: `npm install -g supabase` (or `brew install supabase/tap/supabase`)
   - Expo Go on your phone (App Store / Play Store) for Phase 1–3 testing. Phase 4 (voice) needs a dev build.
4. **Email for sign-in codes** — the Supabase project sends one-time codes with its built-in SMTP for low volume. For a real beta, add a custom SMTP provider in Authentication → SMTP Settings.

Nothing else is needed for Phase 1. ElevenLabs/Deepgram accounts come in Phase 4.

---

## Setup

### 1. Database

```bash
cd hearth
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push                 # applies supabase/migrations/*
psql "$(supabase db url)" -f supabase/seed.sql   # optional: persona rows for admin browsing
```

Or run everything locally: `supabase start` (Docker), which applies migrations + seed automatically and prints local keys. Sign-in codes for local dev show up in Inbucket at http://localhost:54324.

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

1. The app signs in with an email one-time code and reads its `profiles` row (created by a DB trigger).
2. Home lets the user pick one advisor and type a question; Chat opens and calls `POST /functions/v1/chat` with the user's JWT.
3. The `chat` function verifies the user, loads or creates a `sessions` row, pulls the last 20 turns, and assembles the prompt from nine blocks: global safety layer → app context → persona JSON → mode → profile/preferences → memory (empty until Phase 3) → date → history → message.
4. Claude Sonnet 5.5 streams the reply. The function forwards text as SSE `delta` events and withholds the trailing `<<<META>>>` JSON (headline, tone, follow-up, scripture refs, candidate facts, safety flag).
5. The advisor message is saved, usage is metered, and a `done` event closes the stream. A `crisis` safety flag opens the in-app resources card.

The Random Stranger gets one of 14 archetypes per session (stored in `sessions.meta`) and introduces themself on the first turn.

---

## Phase roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, auth, schema + RLS, personas, prompt assembler, text chat | ✅ |
| 2 | Advice Panel: parallel advisors, streaming cards, synthesis, feedback, history | next |
| 3 | Memory: summaries, fact extraction, embeddings, retrieval, My Story, follow-ups | |
| 4 | Voice: per-persona TTS, streaming STT, barge-in, call screen | |
| 5 | Scripture verification (bundled WEB/KJV) | |
| 6 | Safety classifier, crisis flow, eval suite, export/delete | |
| 7 | Onboarding polish, accessibility, notifications, monetization, store submission | |
