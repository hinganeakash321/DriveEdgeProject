# DriveEdge - Project Status

_Last updated: build of the DriveEdge AI-powered automotive marketplace (India)._

## Architecture summary
- **Monorepo**: `backend/` (FastAPI + SQLAlchemy + Pydantic) and `frontend/` (Next.js App Router + TypeScript + Tailwind).
- **Database**: PostgreSQL (production/Docker) via `DATABASE_URL`; local dev defaults to SQLite so the app runs without Docker. Alembic migration generated for the full schema.
- **AI**: Anthropic Claude via a single `ClaudeService`, supporting a direct API key OR a corporate gateway (base URL + key helper + CA cert, as found in the original `.env`). Degrades gracefully when unavailable.
- **Auth**: JWT (access + refresh), bcrypt, backend-enforced RBAC on every protected resource.

## What works (verified)
- Backend boots; `GET /api/health` reports AI status.
- Seed data: **16 manufacturers, 54 models, 96 variants, 16 dealers (with lat/lng), 3 demo users**.
- Auth: register/login/me, RBAC, data isolation. **57 backend tests pass** (`pytest`).
- Catalogue APIs: list/filters/detail/variants/specifications/similar/compare/compare-variants with pagination + validated filters.
- Dealers API: search + city/manufacturer filters + haversine distance.
- Enquiry + multi-dealer fan-out + quotation submission (backend `Decimal` math) + comparison + mark-preferred, all ownership-checked.
- Dealer portal API: assigned enquiries, quotation create/update, inventory CRUD, analytics, profile (GET/PATCH).
- Admin API: overview, analytics, users, dealer approval, catalogue CRUD (manufacturers/models/variants, model PATCH, model list), audit log.
- Customer personalization API: favourites (add/list/remove), saved searches (CRUD), recently viewed — all ownership-isolated and tested.
- **Multi-agent AI**: LangGraph `StateGraph` supervisor classifies intent (vehicle_search / comparison / buying_advice / dealer_search / quote_review / unclear) and routes to specialist handlers. Controlled tool layer (search/details/variants/compare/dealers/quotations/running-cost/enquiry) keeps all filtering, money math, authorization and side effects deterministic in Python. Side-effecting `create_vehicle_enquiry` requires explicit `confirm=True`; `calculate_running_cost` returns `insufficient_inputs` rather than inventing prices; quotation comparison enforces ownership. Unified `POST /api/ai/chat` with structured response contract + optional conversation memory.
- Role assistants: `POST /api/ai/dealer-assistant` (dealer-scoped metrics + narrative) and `POST /api/ai/admin-insights` (platform aggregates only) with deterministic fallbacks.
- **Common landing + role entry**: `/` is a neutral "About DriveEdge" landing (`[frontend/src/components/landing.tsx](frontend/src/components/landing.tsx)`) with two entry cards ("For Customers" / "For Dealers") that both route to one login; the account's role governs access. The customer marketplace moved to `/browse` (still public to guests). After login the role workspace loads automatically (customer -> `/browse`, dealer -> `/dealer`, admin -> `/admin`), and a signed-in visitor to `/` is redirected to their workspace. Header logo/Home is auth-aware (guest -> `/`, customer -> `/browse`).
- **Role-aware experience**: header navigation + portal tabs + AI assistant switch by role. Customers/guests see the marketplace; dealers and admins get a dedicated workspace (consumer browsing hidden). Dealer/admin layouts are a single `RoleGuard` + container (header carries the role tabs).
- **Dealer conversational agent** (`backend/app/ai/dealer_agent.py` + `dealer_tools.py`): `POST /api/ai/dealer-chat` (dealer + linked dealership) classifies into `performance | enquiries | quotation_help | pricing_help | general`. Every tool is scoped by `dealer.id`; a dealer can never read another dealership's enquiries/quotations/customers. Pricing guidance uses catalogue ex-showroom prices + the dealer's own quote history only (competitor quotes never exposed). Tests assert cross-dealer isolation.
- **Admin conversational agent** (`backend/app/ai/admin_agent.py`): `POST /api/ai/admin-chat` (admin only) classifies into `insights | lookup | general` and operates on platform-wide aggregates only (no customer PII sent to the model). Endpoint authz tested (customer→dealer-chat 403, dealer→admin-chat 403).
- AI Car Finder + Buying Assistant retained for back-compat.
- Images: model lead photos resolved from openly-licensed Wikipedia/Wikimedia (`upload/thumb.wikimedia.org`), with branded placeholder fallback; a handful of models deliberately fall back to the placeholder rather than show a wrong/platform-twin car.
- Light/dark theme: CSS-variable tokens flip between `:root`/`.dark`, no-FOUC init script, header toggle; fixed `hero` token for dark branded surfaces.
- Dealer finder map: Leaflet + OpenStreetMap plotting seeded dealers (list/map toggle + per-dealer mini-map).
- Frontend: **production build passes (34 routes)**; **8 frontend tests pass** (Vitest); `tsc --noEmit` and `next lint` clean. New: common landing page at `/` + customer marketplace at `/browse`; role-aware AI chat UI (single floating assistant that reconfigures by role — "Ask AI" / "Dealer AI" / "Admin AI" — plus role-aware full-page `/ai-assistant`), multi-page dealer portal (`/dealer/{enquiries,quotations,inventory,profile}`), multi-page admin portal (`/admin/{vehicles,users,dealers,enquiries,quotations,audit}`), customer detail pages (`/dashboard/enquiries/[id]`, `/dashboard/quotations/[id]`), favourites/recently-viewed (`/dashboard/favourites` + heart toggle on cards/detail).

## Claude integration status
- The original environment uses a corporate Anthropic gateway (`ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY_HELPER` + `ANTHROPIC_CA_CERT`). `GET /api/health` reported `ai.available: true` (credentials resolved).
- Live model calls require network egress to that gateway. In the restricted build sandbox the gateway was unreachable, so AI responses fell back to deterministic logic (`ai_generated: false`). This is expected graceful degradation; on a machine with gateway access the AI narrative is produced by Claude. **Live Claude generation was not asserted in automated tests** (AI tests use mocked/disabled Claude per the spec).

## Known limitations / remaining work
- Local dev defaults to SQLite; for Postgres/PostGIS run Docker Compose and set `DATABASE_URL`. PostGIS spatial queries are approximated with haversine so the app is DB-agnostic.
- **Live Claude generation verified** against the corporate gateway (key helper + CA cert resolve; raw invoke, structured intent classification, and the full multi-agent graph all returned `ai_generated: true`). Note: this gateway's `claude-opus-4-8` only accepts `temperature=1`, so `CLAUDE_TEMPERATURE` defaults to `1.0` (determinism is enforced in Python, not via temperature). The **automated test suite still runs with Claude disabled** (per spec), so CI asserts deterministic behavior only; the live LLM path is verified manually.
- Vehicle images come from openly-licensed Wikimedia sources resolved at build time; some models intentionally fall back to the branded placeholder when no confidently-correct open photo exists. No CarDekho/CarWale assets are scraped or hotlinked.
- Saved searches are stored but alerting/notification on new matches is not yet implemented.
- Mailpit notifications fail soft when SMTP is not running (logged, non-blocking).
- Catalogue is clearly-labeled **sample data** (`specification_source` + `last_verified_at`), not verified live-market data (~50 models / ~100 variants).
- Catalogue filters and AI-extracted preferences tolerate unknown enum values (e.g. a hallucinated `<UNKNOWN>` fuel type) by ignoring them rather than erroring.
- Public self-registration is restricted to `customer`/`dealer` roles; admin accounts are provisioned server-side (no privilege escalation).

## Phase tracker
- [x] Phase 1 - Scaffold, docker-compose, env, status docs
- [x] Phase 2 - Design system (tokens, components)
- [x] Phase 3 - Public marketplace (models, migrations, seed, auth, catalogue APIs, public UI)
- [x] Phase 4 - Customer portal
- [x] Phase 5 - Dealer portal (core)
- [x] Phase 6 - Admin portal (core)
- [x] Phase 7 - Claude integration (service, tools, Car Finder, Buying Assistant, guardrails)
- [x] Phase 8 - Notification service + frontend/backend wiring
- [x] Phase 9 - Tests (backend 41, frontend 8), lint, typecheck, production build
- [x] Phase 10 - Documentation
- [x] Phase 11 - Expanded catalogue + Wikimedia images; light/dark theme; Leaflet dealer map
- [x] Phase 12 - Multi-agent AI (LangGraph supervisor + specialist agents + controlled tools + guardrails) + polished chat UI
- [x] Phase 13 - Dealer & admin multi-page portals; role assistants; customer detail pages + favourites/recently-viewed
