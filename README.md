# DriveEdge

**Find Your Car. Compare Dealers. Buy with Confidence.**

DriveEdge is an AI-powered automotive marketplace for the Indian market: browse a vehicle
catalogue, compare cars and variants, discover dealerships, request multi-dealer quotations, and
get AI-assisted guidance powered by Anthropic Claude.

Tech: **Next.js (App Router) + TypeScript + Tailwind** frontend, **FastAPI + SQLAlchemy + Pydantic**
backend, **PostgreSQL** (SQLite for zero-config local dev), **Claude** via LangChain with deterministic
backend guardrails.

---

## 1. Prerequisites
- Python 3.11+
- Node.js 20+
- (Optional) Docker Desktop for PostgreSQL + Mailpit
- (Optional) Anthropic API key or corporate gateway access for AI features

## 2. Environment
```bash
cp .env.example .env
```
Key variables (see `.env.example` for the full list):
- `DATABASE_URL` - defaults to SQLite (`sqlite:///./driveedge.db`). For Postgres use
  `postgresql+psycopg://driveedge:driveedge@localhost:5432/driveedge`.
- Claude: either `ANTHROPIC_API_KEY`, **or** `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY_HELPER`
  (+ `ANTHROPIC_CA_CERT`) for a corporate gateway. If neither is set, AI features degrade gracefully.
- `AUTH_SECRET` - set a strong random secret.

## 3. Backend
```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m app.seed.seed          # seed sample catalogue + demo users
uvicorn app.main:app --reload    # http://localhost:8000  (docs at /docs)
```

### Database migrations (Postgres)
The app auto-creates tables for SQLite dev. For Postgres, use Alembic:
```bash
alembic upgrade head
```

## 4. Frontend
```bash
cd frontend
npm install
npm run dev                      # http://localhost:3000
```
The frontend proxies `/api/*` to `BACKEND_URL` (default `http://localhost:8000`).

> Note: On macOS you may hit `EMFILE: too many open files` with `next dev`. Either raise the limit
> (`ulimit -n 10240`) or run the production server: `npm run build && npm run start`.

## 5. Docker (Postgres + Mailpit)
```bash
docker compose up -d             # Postgres (5432, PostGIS) + Mailpit (SMTP 1025 / UI 8025)
```
Then set `DATABASE_URL` to the Postgres URL and run `alembic upgrade head` + the seed.

## 6. Demo logins (password: `Password123`)
- Customers: `customer@driveedge.in`, `priya@driveedge.in`, `rohan@driveedge.in`
- Dealers: `dealer@driveedge.in` (Pune), `dealer2@driveedge.in` (Mumbai), `dealer3@driveedge.in` (Delhi) — each owns a verified dealership workspace
- Admin: `admin@driveedge.in`

A full multi-user end-to-end scenario (logins, enquiry fan-out, per-dealer isolation,
quotation comparison, role-aware AI authz/scope) can be replayed with
`python -m scripts.scenario_multi_user` from `backend/`.

## 7. Tests
```bash
# Backend
cd backend && source .venv/bin/activate && pytest -q

# Frontend
cd frontend && npm test            # Vitest
npm run lint && npm run typecheck && npm run build
```

## 8. Mailpit
Start via Docker Compose; emails (enquiry confirmations, dealer notifications, quotation received,
dealer approval) appear at http://localhost:8025. Without Mailpit, notifications are logged and skipped.

## 9. AI features
DriveEdge runs a **multi-agent assistant** on LangGraph. A supervisor classifies each message
(vehicle search / comparison / buying advice / dealer search / quote review) and routes it to a
specialist handler, which calls a controlled tool layer (`backend/app/ai/tools.py`). All filtering,
pricing, money math, authorization, and side effects are enforced deterministically in Python —
Claude (via `backend/app/ai/claude_service.py`) only classifies intent and writes explanations from
verified data. Guardrails: side-effecting actions (e.g. creating an enquiry) require explicit
confirmation; running-cost estimates ask for inputs rather than inventing prices; quotation
comparison enforces record ownership; tool-call/recursion limits are configurable via env.

- Unified consumer endpoint: `POST /api/ai/chat` (structured response + optional conversation memory).
- **Common landing + role entry**: `/` is a neutral "About DriveEdge" landing with two entry cards
  ("For Customers" / "For Dealers"); both lead to one login (the account's role is authoritative).
  The customer marketplace lives at `/browse`, and guests can still browse it (and `/cars`,
  `/dealers`, compare, AI finder) without an account. After login the role workspace loads
  automatically (customer -> `/browse`, dealer -> `/dealer`, admin -> `/admin`), and a signed-in user
  visiting `/` is redirected to their workspace.
- **Role-aware experience**: the header navigation, portal tabs, and the AI assistant all switch by
  role. Customers/guests get the car-shopping marketplace; dealers and admins get a dedicated
  workspace (header shows only their tabs, consumer browsing is hidden).
- **Dealer conversational agent**: `POST /api/ai/dealer-chat` (requires a dealer account + linked
  dealership). Classifies into `performance | enquiries | quotation_help | pricing_help | general`
  and answers from the dealer's **own** data only. Pricing guidance uses catalogue ex-showroom prices
  plus the dealer's own quote history — competitor quotations are never read or exposed.
- **Admin conversational agent**: `POST /api/ai/admin-chat` (admin only). Classifies into
  `insights | lookup | general` and operates on **platform-wide aggregates only** (no customer PII).
- One-shot role summaries remain: `POST /api/ai/dealer-assistant` and `POST /api/ai/admin-insights`.
- Chat UI: a single role-aware floating assistant app-wide (launcher labelled "Ask AI" / "Dealer AI" /
  "Admin AI"), plus a role-aware full page at `/ai-assistant`.

If Claude is unreachable the entire stack falls back to deterministic/heuristic behavior and labels
responses as rule-based (`ai_generated: false`). **Live Claude generation is not asserted in tests.**

### Other highlights
- ~50 models / ~100 variants across 16 manufacturers (clearly-labelled sample data).
- Vehicle lead photos resolved from openly-licensed Wikimedia sources, with a branded fallback.
- Light/dark theme toggle (CSS-variable tokens, no flash of unstyled content).
- Dealer finder map (Leaflet + OpenStreetMap) plotting seeded dealers.
- Customer favourites + recently-viewed; multi-page dealer and admin portals.

## 10. Troubleshooting
- **`EMFILE` in `next dev`**: raise `ulimit -n` or use `npm run build && npm run start`.
- **bcrypt/passlib error**: ensure `bcrypt==4.0.1` (pinned in `requirements.txt`).
- **Postgres auth failed**: a different Postgres may be on :5432 — use SQLite or adjust `DATABASE_URL`.
- **AI shows "rule-based (AI unavailable)"**: Claude credentials/gateway not reachable; non-AI
  features still work.

## Project structure
```
backend/   FastAPI app (app/models, app/api, app/services, app/ai, alembic, tests)
frontend/  Next.js App Router (src/app, src/components, src/lib)
docker-compose.yml, .env.example, PROJECT_STATUS.md
```

> Disclaimer: Catalogue prices and specifications are indicative sample data and may change. Confirm
> current details with the manufacturer or an authorized dealership before purchasing.
