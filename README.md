# Tan90 Thermal Portal

Operations portal for Tan90 cold-chain logistics. It tracks cooling-panel orders from request to delivery and return, and tracks every reusable container by RFID tag or barcode.

| Part | Tech | Port |
| --- | --- | --- |
| Portal (`src/`) | Next.js 16, React 19, TypeScript, Tailwind CSS 4 | 3000 |
| API (`backend/`) | FastAPI, SQLAlchemy, SQLite | 8001 |

> **Status:** working prototype for the Ops team. The portal has no login screen yet. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for what is done, what is pending, and the plan.

## Quick start

You need **Node.js 20+** and **Python 3.12**. Python 3.12 is the tested version. Python 3.15 fails to install, and 3.13 and 3.14 are untested.

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
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `python backend/test.py` | Test every API endpoint (API must be running) |

Run `lint`, `typecheck` and `build` before every commit.

## Configuration

Both apps run without any settings in development. Set these in production.

**Portal** (environment variables, or `.env.local`)

| Variable | Default | Notes |
| --- | --- | --- |
| `BACKEND_API_URL` | `http://127.0.0.1:8001` | Where the API runs |
| `BACKEND_EMAIL` | none | **Required in production.** Service account the portal signs in with |
| `BACKEND_PASSWORD` | none | **Required in production** |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public URL, set at build time |

**API** (environment variables, or `.env.local`)

| Variable | Default | Notes |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | Set to `production` to enable the safety checks below |
| `JWT_SECRET` | dev value | **Required in production:** random, 32+ characters |
| `DATABASE_URL` | `sqlite:///./tan90.db` | |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated list |
| `JWT_TTL_SECONDS` | `86400` | Token lifetime |

With `ENVIRONMENT=production` the API refuses to start with a weak `JWT_SECRET` and never loads demo data. Template: [.env.example](.env.example). Real environment variables always win over `.env.local`. Never commit real secrets.

## Project layout

```
backend/app/      API: routers, services, models, schemas, seed data
src/app/          Portal pages and routes
src/features/     One folder per feature: orders, inventory, containers, deliveries, exceptions
src/components/   Shared UI and the app shell
src/server/       Server-only code, including the API client
docs/             Developer guide
```

## Documentation

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): how the system works, how to add features, status and plan
- [backend/API.md](backend/API.md): API reference
