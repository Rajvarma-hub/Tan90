# tan90

Tan90Thermal operations portal: a Next.js 16 frontend (App Router, Cache Components, Tailwind CSS v4, TypeScript) on a FastAPI + SQLite backend.

## Getting started

Run the backend and the portal in two terminals.

**1. Backend API** (Python 3.10+, port 8001)

```bash
cd backend
python3 -m venv .venv            # or: uv venv --python 3.12 .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8001 --reload
```

The database (`backend/tan90.db`) is created and seeded on first start. To reset the demo data, stop the server, delete that file and start again. Swagger UI is at http://127.0.0.1:8001/docs; [backend/API.md](backend/API.md) documents every endpoint and [backend/guide.txt](backend/guide.txt) lists the seeded users and data.

**2. Portal** (Node 20+)

```bash
npm install
npm run dev

npm run dev -- -p 3001           # if port 3000 is taken
```

If you don't have a `.env.local` yet, create one from [.env.example](.env.example). Don't copy over an existing one, or your local values will be lost. `BACKEND_API_URL` must point at the backend (default `http://127.0.0.1:8001`).

| Command                       | Purpose                                     |
| ----------------------------- | ------------------------------------------- |
| `npm run dev`                 | Start the dev server                        |
| `npm run build`               | Production build                            |
| `npm run start`               | Serve the production build                  |
| `npm run lint`                | ESLint                                      |
| `npm run typecheck`           | Generate route types and run `tsc --noEmit` |
| `docker compose up --build`   | Build and run the portal image on :3000     |

## What works

- **Orders** (`/orders`): searchable, filterable list; create an order; order page with customer, station, items, containers and activity, plus the next step for the order's status: approve or cancel, start packing, pack containers, dispatch with driver and vehicle, depart, arrive, deliver, confirm receipt, request return, assign return driver, collect, receive, inspect and close.
- **Inventory** (`/inventory`): asset list with stock totals and add-asset; stock per station; movements timeline with inward/outward, type, station and asset filters; record new inventory, damage, adjustments and station-to-station transfers; freezing stations with stock, free containers and open orders.
- Dispatching an order takes its panels out of the station's stock and records a Sales movement.

## Project structure

```
backend/                 # FastAPI + SQLite API (Python)
├── app/
│   ├── core/            # Config, auth dependencies, order and container state machines
│   ├── db/              # Engine, session, seed data
│   ├── models/          # SQLAlchemy models
│   ├── routers/         # One file per API area (orders, inventory, stations, ...)
│   ├── schemas/         # Pydantic request/response shapes
│   └── services/        # order_flow (order lifecycle), inventory (stock ledger)
├── API.md               # Endpoint-by-endpoint API reference
├── guide.txt            # Seeded users, stations, products and sample payloads
└── test.py              # End-to-end endpoint test (expects the API on :8000)

src/                     # Next.js portal
├── app/                 # Routing only: layouts, pages, route handlers, special files
│   ├── (portal)/        # App shell + /orders, /orders/[id], /inventory/{assets,movements,stations}
│   ├── api/             # Route handlers (e.g. /api/health)
│   └── layout.tsx       # Root layout: <html>, fonts, metadata
├── components/
│   ├── layout/          # App shell: sidebar, header
│   └── ui/              # Primitives: button, form controls, dialog, card, table, badge, tabs
├── config/              # Validated env, site config, sidebar navigation
├── features/            # Domain modules, one folder per feature
│   ├── orders/          # List, new order, detail page and every lifecycle action
│   └── inventory/       # Assets, stock per station, movements, freezing stations
├── hooks/               # Shared client hooks (useServerAction)
├── lib/                 # Isomorphic utilities: AppError, ActionResult, formatting
└── server/              # Server-only: backend.ts (API client), createAction, logger
```

### Conventions

- **`app/` stays thin.** Pages compose components and call into `features/` or `server/`. Route-specific, non-shared code may be colocated in `_components/` or `_lib/` private folders.
- **Feature modules** (`src/features/<feature>/`) own a vertical slice: `components/`, `actions.ts` (`"use server"`), `queries.ts` (server-only reads), `service.ts` (business logic shared by actions and route handlers), `schemas.ts` (zod), `types.ts`. Features import from `components/`, `lib/`, `server/`, but not from other features' internals.
- **Server boundary.** Anything touching secrets, the database, or `process.env` starts with `import "server-only"`. Queries perform authorization and return minimal DTOs to the UI ([Data Access Layer](https://nextjs.org/docs/app/guides/data-security#data-access-layer)).
- **Errors.** Throw `AppError(code, message)` for expected failures; its message is shown to clients. Any other error is logged and returned as a generic `INTERNAL_ERROR`.
- **Server Actions** are built with `createAction(schema, handler)` and return `ActionResult<T>` (`{ ok: true, data }` or `{ ok: false, error }`) instead of throwing.
- **Route Handlers** (for webhooks and external clients) wrap the handler in `withErrorHandling()` and read bodies with `parseJson(request, schema)`. Errors come back as `{ error: { code, message, fieldErrors? } }` with the matching HTTP status.
- **Backend calls.** Pages and Server Actions reach the FastAPI backend only through `backend()` in [src/server/backend.ts](src/server/backend.ts). It signs in as the service user from `BACKEND_EMAIL` / `BACKEND_PASSWORD` (the seeded Ops account by default), so the prototype has no login screen.
- **Environment variables** are validated with zod at startup. Server vars go in [src/config/env.server.ts](src/config/env.server.ts); browser-safe `NEXT_PUBLIC_*` vars go in [src/config/env.public.ts](src/config/env.public.ts). Document every var in `.env.example`.
- **Route groups** like `(marketing)`, `(auth)`, `(dashboard)` give each area its own layout without affecting URLs.
- **Caching.** Cache Components is enabled: cache with `"use cache"` + `cacheLife`/`cacheTag`, and wrap request-time data (`cookies()`, `headers()`, uncached fetches) in `<Suspense>`.
- **Imports** use the `@/*` alias (maps to `src/*`). Typed routes are enabled, so `<Link href>` is checked at build time.
- **Naming:** kebab-case file names, PascalCase components, named exports outside of Next.js special files.
- **Deployment.** The [Dockerfile](Dockerfile) builds with `NEXT_OUTPUT=standalone`, runs as a non-root user and checks `/api/health`. Pass `NEXT_PUBLIC_*` values as build args, because they are inlined at build time. Provide server secrets as runtime environment variables. Security headers are set in [next.config.ts](next.config.ts).
