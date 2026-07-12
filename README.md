# doctor-openclaw

API backend for a patient-management assistant for Indian doctors. Doctors interact
through a chat agent (Telegram); this service is the system of record.

**Stack:** Next.js (App Router, API-only) on Vercel · Supabase Postgres via Prisma · Cloudflare R2 for documents.

## Design notes

- **All authorization lives here, not in the agent.** Every request needs
  `Authorization: Bearer dct_...`; every query is scoped to the token's doctor.
  Tokens are stored as sha256 hashes only.
- **Every access is audited** — writes atomically (same transaction), reads best-effort.
  See `GET /api/audit-logs`.
- **Discharge summaries are generated from structured data** (never freehand LLM text),
  rendered to PDF in R2, and served only via short-lived signed URLs.
- Finalized summaries (`status: FINAL`) become immutable.

## Setup

1. Create a Supabase project (prefer an Indian region, e.g. `ap-south-1`) and an R2 bucket.
2. `cp .env.example .env` and fill in values.
3. `npx prisma migrate dev --name init`
4. Provision a doctor + token:
   `npm run create-doctor -- --name "Dr. A Sharma" --email a@example.com`
5. `npm run dev`

## API

All routes require `Authorization: Bearer <token>`. Dates are `YYYY-MM-DD`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/patients?q=&limit=&offset=` | Search own patients by name/phone |
| POST | `/api/patients` | Create patient |
| GET | `/api/patients/:id` | Patient details |
| PATCH | `/api/patients/:id` | Update patient |
| GET | `/api/patients/:id/discharge-summaries` | List summaries for a patient |
| POST | `/api/patients/:id/discharge-summaries` | Create summary (DRAFT) |
| GET | `/api/discharge-summaries/:id` | Summary details |
| PATCH | `/api/discharge-summaries/:id` | Update / finalize (`{"status": "FINAL"}`) |
| GET | `/api/discharge-summaries/:id/document` | Signed PDF URL (renders on demand) |
| GET/POST | `/api/patients/:id/encounters` | Visits: list / record |
| GET/PATCH | `/api/encounters/:id` | Encounter details / update |
| GET/POST | `/api/patients/:id/prescriptions` | Prescriptions: list / create |
| GET | `/api/prescriptions/:id` | Prescription details |
| GET | `/api/prescriptions/:id/document` | Signed PDF URL (renders on demand) |
| GET | `/api/audit-logs?limit=&offset=` | Own audit trail |
| POST | `/api/telegram/webhook` | Telegram bot webhook (secret-token gated) |

`POST` create endpoints accept an `Idempotency-Key` header: a retry with the same
key replays the stored response instead of creating a duplicate.

Example:

```bash
curl -s localhost:3000/api/patients \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Ramesh Kumar","dateOfBirth":"1961-03-14","sex":"MALE","phone":"+919800000000","allergies":["penicillin"]}'
```

## Telegram agent

The agent (OpenAI tool-calling loop, `src/lib/agent/`) is multi-tenant by
construction: a Telegram chat maps to one doctor via `TelegramLink`, and every
tool call runs through the same doctor-scoped services as the HTTP API.

- **Confirm-before-write is enforced server-side.** Writes go through a
  `PendingAction`: the agent proposes, the doctor sees the exact payload, and
  `confirm_action` is rejected unless the confirmation arrives in a message
  *after* the proposal (so the model can never propose and self-confirm in one turn).
- Linking: `create-doctor` prints a one-time code; the doctor sends `/link <code>` to the bot.
- Setup: set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET`, then
  `curl "https://api.telegram.org/bot<token>/setWebhook?url=<base>/api/telegram/webhook&secret_token=<secret>"`.
- Local testing without Telegram: `npm run agent -- --email <doctor> "message"`.

## Tests

- `npm test` — vitest unit tests (`tests/`) covering validation schemas, token
  hashing, error mapping, PDF rendering, and pending-action confirm gating.
- `npm run eval` — non-deterministic agent evals (`scripts/agent-eval.ts`):
  drives real conversations (Hinglish shorthand, typos, prompt injection,
  cross-tenant probes, ambiguous names, missing doses…) through the live
  OpenAI API against a throwaway doctor, then asserts on database state and
  judges reply quality with an LLM. `npm run eval -- --only <scenario>` runs one.

## Roadmap

- R2 media attachments (lab reports/scans via Telegram photos)
- Summary amendments (versioned corrections instead of edit-FINAL)
- V2: per-doctor agent config (custom prompts/tools, external system adapters)
