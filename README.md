# Tan90 Thermal Portal

Operations portal for Tan90 cold-chain logistics. It tracks cooling-panel orders from request to delivery and return, and tracks every reusable container by RFID tag or barcode.

| Part | Tech | Port |
| --- | --- | --- |
| Portal (`src/`) | Next.js 16, React 19, TypeScript, Tailwind CSS 4 | 3000 |
| API (`backend/`) | FastAPI, SQLAlchemy, SQLite or PostgreSQL | 8001 |

> **Status:** ready for a pilot. Ops, station staff, drivers and customers each sign in with their own account and see their own screens. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for what is done, what is deferred until pilot feedback, and the plan.

## Quick start

You need **Node.js 20+** and **Python 3.12 or newer**. The API is tested on 3.12 and 3.14, and installs on 3.15.

Open two terminals. Start the API first.

**Terminal 1: API**

```bash
cd backend
# Windows PowerShell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8001 --reload

# macOS/Linux
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --port 8001 --reload
```

**Terminal 2: Portal**

```bash
npm install
npm run dev
```

Open http://localhost:3000. Settings come from `.env.local` in the repo root, which both apps read. Without it, safe development defaults apply. To create it, copy [.env.example](.env.example).

The first API start creates `backend/tan90.db` and fills it with demo data. To reset the data, stop the API, delete that file, and start it again.

## Run the whole stack with Docker

PostgreSQL, the API and the portal in one command. You need Docker with Compose.

```bash
cp .env.docker.example .env        # then set POSTGRES_PASSWORD and JWT_SECRET (instructions inside)
docker compose up -d --build
docker compose exec api python -m app.cli create-admin --email you@example.com --name "Your Name"
```

Open http://localhost:3000 and sign in with the admin you just created. Add everyone else from **Users** in the portal. Production never loads demo data, so there is nobody to sign in as until you create the first admin. The command refuses to run once a super admin exists.

Migrations run on every `up`, before the API starts. Only the portal is published to the network; the API listens on this machine only. Put the portal behind HTTPS before real people use it, because its session cookie is `Secure`.

## Useful links

| What | Where |
| --- | --- |
| Portal | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8001/docs |
| API health | http://localhost:8001/health |
| Demo users (password `password123`) | [backend/guide.txt](backend/guide.txt) |
| Every endpoint | [backend/API.md](backend/API.md) |

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Start the portal in development |
| `npm run lint` | Check code style |
| `npm run typecheck` | Check types |
| `npm test` | Portal unit tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright). Needs the API and portal running, and adds an order to the dev data |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `cd backend && pytest` | API tests. They use their own temporary database, so no server is needed |
| `cd backend && alembic upgrade head` | Apply database migrations |

Run `lint`, `typecheck`, `test` and `build` before every commit. CI runs all of them, plus the API tests on SQLite and PostgreSQL, on every pull request.

## Configuration

Both apps run without any settings in development. Set these in production.

**Portal** (environment variables, or `.env.local`)

| Variable | Default | Notes |
| --- | --- | --- |
| `BACKEND_API_URL` | `http://127.0.0.1:8001` | Where the API runs |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public URL, set at build time |

The portal has no login settings: people sign in with their own API accounts, and the session cookie is `Secure` in production, so serve it over HTTPS.

**API** (environment variables, or `.env.local`)

| Variable | Default | Notes |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | Set to `production` to enable the safety checks below |
| `JWT_SECRET` | dev value | **Required in production:** random, 32+ characters |
| `DATABASE_URL` | `sqlite:///./tan90.db` | PostgreSQL: `postgresql://user:password@host:5432/tan90` |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated list |
| `JWT_TTL_SECONDS` | `3600` | Token lifetime. The portal renews it while someone is active, so a session ends after this much idle time |
| `LOGIN_MAX_FAILURES` | `5` | Wrong passwords in a row before an account is locked |
| `LOGIN_LOCKOUT_SECONDS` | `900` | How long a locked account stays locked. An admin can unlock it sooner |

With `ENVIRONMENT=production` the API refuses to start with a weak `JWT_SECRET`, never loads demo data, and does not change the schema on start. Run `alembic upgrade head` from `backend/` on every deploy. The API refuses to start if the database is behind. Template: [.env.example](.env.example). Real environment variables always win over `.env.local`. Never commit real secrets.

## Project layout

```
backend/app/      API: routers, services, models, schemas, seed data
backend/alembic/  Database migrations
backend/tests/    API tests (pytest)
e2e/              Browser tests (Playwright)
src/app/          Portal pages and routes
src/features/     One folder per feature: orders, inventory, containers, assets, deliveries, exceptions, notifications, users, auth
src/components/   Shared UI (one page template, table style and colour palette) and the app shell
src/server/       Server-only code, including the API client
docs/             Developer guide, including the UI standards
```

## Documentation

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): how the system works, how to add features, status and plan
- [backend/API.md](backend/API.md): API reference
