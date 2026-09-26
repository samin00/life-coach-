# Audit

Audit reads your YouTube/Instagram habits (exported watch history or a manual description), maps your real interests as a tiered "brain map", asks one uncomfortable question, and turns a chosen goal into a daily / weekly / monthly plan with progress tracking. Everything is persisted server-side, so a reload resumes where you left off.

## Architecture

```
client/  Vite + React SPA (port 5173)
server/  Express 5 + Prisma 6 + SQLite API (port 3001)
```

**Request flow:** browser -> `client/src/api/client.js` -> `/api/*` (Vite dev/preview proxy) -> Express router (`server/src/routes`) -> `demoUser` middleware (attaches `req.user`) -> zod validation (`middleware/validate.js`, `validation/schemas.js`) -> controller -> service -> Prisma. Errors are normalised by `middleware/errorHandler.js` into `{ error: { code, message } }`; unexpected errors return a generic 500 without stack traces.

**AI service layer** (`server/src/services/ai`): `analyzeHabits`, `suggestGoals`, `generatePlan`, `providerInfo`. The provider is chosen by `AI_PROVIDER` (`openai` | `anthropic`) *and* the presence of its API key; with no key a fallback provider is used. Every response is JSON-parsed and zod-validated; on any failure (no key, network, bad JSON, schema mismatch) deterministic fallback data is used, then normalised onto the fixed 16-block daily skeleton and 5 weekly / 5 monthly items. Providers use plain `fetch`, no SDKs.

**Prisma models** (`server/prisma/schema.prisma`): `User`, `HabitInput`, `Analysis` (interests, patterns, question, answer, cached suggestions), `Goal`, `Plan` (daily/weekly/monthly + progress). JSON fields are stored as strings. Submitting new habits cascades a reset of analysis/goal/plan; a new goal replaces the plan.

**Where auth plugs in:** `server/src/middleware/demoUser.js` resolves a single demo user. Replace it with real session/JWT verification that sets `req.user`; all services are already scoped by user id.

## Install

```bash
npm install && npm run install:all
```

## Database setup

```bash
cd server && cp .env.example .env && npx prisma migrate dev
```

(or `npm run db:migrate` from the root once `.env` exists)

## Environment variables (`server/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | API port |
| `DATABASE_URL` | `file:./dev.db` | Prisma SQLite connection |
| `AI_PROVIDER` | `openai` | `openai` or `anthropic` |
| `OPENAI_API_KEY` | empty | OpenAI key; empty -> fallback data |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model |
| `ANTHROPIC_API_KEY` | empty | Anthropic key; empty -> fallback data |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Anthropic model |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed browser origin |

The client has no env vars.

## Development

```bash
npm run dev
```

Runs client on http://localhost:5173 and server on http://localhost:3001. `npm run build` builds the client into `client/dist`.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | `{ ok: true }` |
| GET | `/api/state` | Current step, habitInput, analysis, goal, plan, AI provider info |
| POST | `/api/habits` | Save habit input (201); resets downstream data |
| POST | `/api/analyze` | Run analysis (201; rate limited; 409 without habits) |
| PATCH | `/api/analysis` | Edit interests / answer; clears cached suggestions |
| POST | `/api/goals/suggest` | Suggest goals, cached on analysis (rate limited) |
| POST | `/api/goals` | Set goal (201); deletes existing plan |
| POST | `/api/plan` | Generate plan (201; rate limited; 409 without goal) |
| GET | `/api/plan` | Current plan or 404 |
| PATCH | `/api/plan/progress` | Update tasks / weekly / monthly progress |
| DELETE | `/api/reset` | Delete all data for the user |

Out-of-order steps return 409. Errors use `{ error: { code, message } }`.

## Security

- AI keys live only in `server/.env`; never use `VITE_` vars for secrets, and the browser never calls AI providers directly.
- AI endpoints are rate limited to 20 requests / 15 min per IP (429 with the standard error shape).
- JSON body limit 1 MB; `rawContent` capped at 200,000 chars; all input is validated with zod.
- Error responses never include stack traces or keys.
- SQLite is for local use only. Production needs a managed database (e.g. Postgres via Prisma) and real authentication in place of the demo user.

## Manual test checklist

1. `npm run dev`, open http://localhost:5173; landing page renders.
2. Start Audit -> Analyze is disabled until input exists; upload a `.json` file (text read) and a `.zip` (filename only); accuracy updates; switch source to Both.
3. Enter manual text, Analyze -> loader, then the uncomfortable question; answer or Skip.
4. Brain map: drag a node, remove a node, add a node; switch to List, change a weight.
5. Reload the page -> map step restored with your edits.
6. Set Goals -> "Audit Suggests" shows suggestions (refetched after map edits); or type your own (min 3 chars). Build My Plan.
7. Planner: tick a task, toggle weekly items, move monthly sliders.
8. Reload -> planner restored with progress.
9. Start Over -> back to landing; manual text is empty; `GET /api/state` returns step `source`.
10. Hit an AI endpoint more than 20 times in 15 min -> rate-limit banner "Too many AI requests. Wait and retry."

## Limitations

- Single demo user; no authentication.
- `.zip` exports are not parsed (only the filename is recorded); JSON/HTML text is read client-side.
- Without an AI key the app uses fixed fallback data.
