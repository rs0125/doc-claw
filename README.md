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
| GET | `/api/audit-logs?limit=&offset=` | Own audit trail |

Example:

```bash
curl -s localhost:3000/api/patients \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Ramesh Kumar","dateOfBirth":"1961-03-14","sex":"MALE","phone":"+919800000000","allergies":["penicillin"]}'
```

## Roadmap

- Telegram webhook + Claude agent loop (`/api/telegram/webhook`) with confirm-before-write flow
- V2: per-doctor agent config (custom prompts/tools, external system adapters)
