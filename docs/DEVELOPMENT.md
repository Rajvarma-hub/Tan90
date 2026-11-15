# Developer Guide

Everything a new developer needs: what the product does, how the code fits together, how to work on it, and what is done and pending.

Contents: [1. The product](#1-the-product) · [2. Architecture](#2-architecture) · [3. Set up](#3-set-up-from-zero) · [4. Code map](#4-code-map) · [5. Order lifecycle](#5-order-lifecycle) · [6. How a click becomes data](#6-how-a-click-becomes-data) · [7. Add a feature](#7-add-a-feature) · [8. Test and verify](#8-test-and-verify) · [9. Production checklist](#9-production-checklist) · [10. Status and plan](#10-status-and-plan) · [11. Troubleshooting](#11-troubleshooting)

---

## 1. The product

Tan90 rents **cooling panels** (PCM panels) to customers who ship temperature-sensitive goods such as vaccines and food. The panels are frozen at a **freezing station**, packed into reusable **containers**, delivered, used, and returned.

The portal lets the Ops team run that cycle and always know where every container is. Station staff, drivers and customers use the same portal and see only what their role needs.

| Term | Meaning |
| --- | --- |
| **PCM panel / asset** | The product being rented. Each type (SKU) has a temperature setpoint, such as -24 °C |
| **Container** | A reusable box or bag that carries panels. Each has a code (`CON-000016`) and an RFID tag or barcode |
| **Freezing station (FS)** | A site that freezes panels, packs and dispatches orders. Stock is counted per station |
| **Warehouse (WH)** | A storage location that holds stock but does not pack orders |
| **Order** | A customer request for panels. It moves through a fixed lifecycle (section 5) |
| **Packing session** | The step where containers are scanned onto an order and filled with panels |
| **Movement** | One stock change: inward (stock added) or outward (stock removed). Dispatching an order records an outward Sales movement |
| **Exception** | Something wrong: an unknown scan, or a container reported missing or damaged |
| **Scan** | A barcode or RFID reader typing a code and pressing Enter. A scan can be the tag ID or the label code |

Roles in the backend: Super Admin, Operations Admin, Freezing Station Manager, Warehouse, Packing Worker, Driver, Customer, Supply Chain Manager.

---

## 2. Architecture

```mermaid
flowchart LR
    B[Browser] -->|HTML and server actions| P[Portal<br/>Next.js :3000]
    P -->|REST + JWT, server side only| A[API<br/>FastAPI :8001]
    A --> D[(PostgreSQL<br/>SQLite in development)]
```

- The **browser never talks to the API**. The portal's server calls it. The token stays on the server side of the cookie boundary: it is kept in an `httpOnly` cookie that scripts cannot read.
- **Sign-in:** everyone signs in at `/login` with their own API account. The portal stores the API's token in that cookie and sends it on every call, so the API decides what each person may do. `src/proxy.ts` sends visitors without a fresh token to `/login`.
- **Sessions:** a token lasts one hour. `src/proxy.ts` swaps it for a fresh one once a quarter of its life has passed, so people who keep working stay signed in and an idle session ends after an hour. Signing out, changing a password, changing a role or deactivating someone raises the user's `token_version` in the API, which makes every older token stop working at once. Five wrong passwords in a row lock the account for 15 minutes; an admin can unlock it from **Users**.
- **Roles:** `src/lib/permissions.ts` mirrors the API's role checks and decides which buttons, menu items and pages a user sees. It only shapes the screen. The API is the real check, so when you change a role rule in `backend/app/routers`, change it there too and in the permissions test.
- **What each role sees:** staff see the operation. A **driver** sees only the orders assigned to them (delivery or return pickup). A **customer** sees only their own company's orders and containers. The API enforces this: `require_staff` in `backend/app/core/deps.py` blocks the operation-wide endpoints (all containers, stock, customers, exceptions) for customers and drivers, and the order endpoints filter by owner or assignment.
- All business rules (state machine, stock math, scan checks) live in the **API**. The portal only shows data and sends actions.
- The database is created and filled with demo data on first start in development. In production it is never seeded.

---

## 3. Set up from zero

**Install:** Node.js 20+, Python 3.12 or newer, Git. The API is tested on Python 3.12 and 3.14, and installs on 3.15.

```bash
git clone <repo-url> tan90 && cd tan90

# Terminal 1: API
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

# Terminal 2: Portal (from the repo root)
npm install
npm run dev
```

Open http://localhost:3000 and sign in with a demo user, for example `ops@tan90.local` / `password123` (all demo users share that password; see [backend/guide.txt](backend/guide.txt)). Try `driver1@tan90.local` or `blinkit@tan90.local` to see the driver and customer screens. API docs: http://localhost:8001/docs.

**Settings:** copy `.env.example` to `.env.local` in the repo root. Both apps read this one file (it is git-ignored). Without it, safe development defaults apply. Start the API from the `backend` folder, because the SQLite path in `DATABASE_URL` is relative.

Demo data: 6 locations, 6 customers, 26 users, 11 products, 63 containers and 20 orders, with every order and container state present at least once. Users and their roles are in [backend/guide.txt](backend/guide.txt) (password for all: `password123`).

To reset the data: stop the API, delete `backend/tan90.db`, start it again.

**Database:** development uses SQLite and migrates itself on start. To use PostgreSQL, set `DATABASE_URL=postgresql://user:password@host:5432/tan90`. Whenever you change a model, create a migration from `backend/` and commit it:

```bash
alembic revision --autogenerate -m "what changed"
alembic upgrade head
```

A test fails if a model and the migrations disagree. Read the generated file before committing it. In production the API does not migrate on start; run `alembic upgrade head` as part of the deploy.

**Full stack in Docker:** `docker-compose.yml` runs PostgreSQL, the API and the portal. See the README for the three commands, and `.env.docker.example` for the secrets it needs. A `migrate` step runs `alembic upgrade head` before the API starts, and each service has a health check. Create the first admin with `docker compose exec api python -m app.cli create-admin`.

---

## 4. Code map

```
backend/
  app/main.py          App start-up, CORS, router registration
  app/core/            Settings, auth checks, order and container state rules
  app/models/          Database tables (SQLAlchemy)
  app/schemas/         Request and response shapes (Pydantic)
  app/routers/         HTTP endpoints, one file per area
  app/services/        Business logic: order_flow, inventory, scan, container_view
  app/db/              Engine, session, demo data (seed.py)
  app/cli.py           Operator commands: `python -m app.cli create-admin`
  alembic/             Database migrations
  tests/               API tests (pytest)
  API.md               Endpoint reference

src/
  app/(portal)/        Pages: orders, inventory, assets, asset-management, deliveries, exceptions, users, notifications, my-containers, account
  features/<name>/     One folder per feature (below)
  components/ui/       Page template, stat cards, tables, buttons, forms, dialogs, badges, scan input
  components/layout/   Sidebar, header, app shell
  server/              backend.ts (API client), action.ts (server-action wrapper), logger
  config/              Validated env, navigation, site info
  lib/                 Errors, formatting, helpers
```

A feature folder holds: `queries.ts` (read data), `actions.ts` (write data, server actions), `schemas.ts` (input rules), `types.ts`, and `components/`.

| Feature | Screens |
| --- | --- |
| `orders` | Order list with stat-card filters, new order, order page with every lifecycle step |
| `inventory` | Overview, products and stock per location, stock movements, locations |
| `containers` | Containers: all, by location, customers, drivers, needs attention. Container page, register, tag replacement |
| `assets` | Asset Management: registry (edit, unregister, restore) and by-station health |
| `deliveries` | Deliveries table: one row per run with the next step (load, depart, arrive, deliver, collect) |
| `exceptions` | Open and resolved exceptions with filters, resolve |
| `notifications` | Bell with unread count, inbox page, mark read. Read state is kept per person |
| `users` | Add, edit, deactivate, unlock and reset passwords for staff, drivers and customer users |
| `auth` | Sign-in, sign-out, account page and change password |

---

## 5. Order lifecycle

The API owns these rules. An illegal step returns HTTP 409. Each step is its own endpoint; the client never sends a status.

```mermaid
stateDiagram-v2
    [*] --> PENDING_OPS_APPROVAL
    PENDING_OPS_APPROVAL --> APPROVED: approve + pick station
    PENDING_OPS_APPROVAL --> CANCELLED: cancel
    APPROVED --> CANCELLED: cancel
    APPROVED --> PACKING: start packing
    PACKING --> PACKED: complete packing
    PACKED --> DISPATCHED: dispatch (driver, vehicle)
    DISPATCHED --> IN_TRANSIT: depart
    IN_TRANSIT --> ARRIVED: arrive
    ARRIVED --> DELIVERED: deliver
    DELIVERED --> CUSTOMER_CONFIRMED: confirm receipt
    DELIVERED --> DISPUTED: dispute (missing or damaged)
    CUSTOMER_CONFIRMED --> RETURN_REQUESTED: request return
    DISPUTED --> RETURN_REQUESTED: request return
    RETURN_REQUESTED --> RETURN_COLLECTED: assign driver, collect
    RETURN_COLLECTED --> RETURN_RECEIVED: receive at station
    RETURN_RECEIVED --> CLOSED: inspect, all OK
```

Rules worth knowing:

- **Cancel** is allowed only before packing starts (pending or approved).
- **Packing** links containers to the order by scan. One order can use many containers, and each container records what it holds.
- **Dispatch** needs every container scanned, plus a driver and a vehicle number. It removes the stock from the station and writes a Sales movement.
- **Delivery code**: when the driver marks the order arrived, the API makes a one-time code for it (valid 24 hours). The driver's order page shows it as a QR code and as text; scanning the QR opens the order on the customer's phone with the code filled in. The code is not stored, only its hash; it is derived from the token id and `JWT_SECRET`, so changing the secret invalidates unused codes.
- **Verify, then confirm**: a customer must verify the delivery code before confirming receipt. Ops can confirm for a customer (for example from a signed paper receipt) without it.
- **Confirm receipt**: if any container is marked missing or damaged, the order becomes disputed and an exception is raised.
- **Inspect**: containers that pass go back to stock. Damaged or contaminated ones keep the order open.

---

## 6. How a click becomes data

Example: Ops clicks **Approve** on an order.

```mermaid
sequenceDiagram
    participant U as Browser
    participant P as Portal server
    participant A as API
    U->>P: Server action runOrderAction({approve})
    P->>P: Check input with zod
    P->>A: POST /api/orders/{id}/approve (Bearer token)
    A->>A: Check role, check state rule, update DB, log event
    A-->>P: Updated order
    P-->>U: Result, page refreshes
```

- Reads: a page calls a function in `features/<name>/queries.ts`, which calls `backend("/api/...")`.
- Writes: a button calls a server action built with `createAction(schema, handler)`. It returns `{ ok: true, data }` or `{ ok: false, error }`. It does not throw.
- Errors: throw `AppError(code, message)` for expected failures. The message is shown to the user. Anything else is logged and shown as a generic error.
- The API client is `src/server/backend.ts`. It sends the signed-in person's token, sends them to the sign-in page on a 401, and turns API errors into readable messages. Do not use 401 for anything but a bad or ended session.

---

## 7. Add a feature

Example: show a new list from the API.

1. **API first.** Add or find the endpoint in `backend/app/routers/` and document it in `backend/API.md`. Put business rules in `services/`, not in the router.
2. **Types and read.** Add the response type to `src/features/<name>/types.ts` and a function in `queries.ts` that calls `backend<Type>("/api/...")`.
3. **Page.** Add `src/app/(portal)/<route>/page.tsx`. Wrap the data component in `<Suspense fallback={<PageSkeleton />}>`. Keep the page thin.
4. **Navigation.** Add the route to `src/config/navigation.ts`.
5. **Write actions.** Add a zod schema in `schemas.ts` and an action in `actions.ts` using `createAction`. Call it from a client component with `useServerAction`.
6. **Check.** Run `npm run lint`, `npm run typecheck`, `npm run build`. Click through the screen with the API running.

House rules:

- `app/` holds routing only. Logic belongs in `features/`.
- Code that touches secrets or the API starts with `import "server-only"`.
- File names use kebab-case. Imports use `@/` for `src/`.
- Never add default passwords or secrets to source code. Use environment variables.
- Next.js 16 differs from older versions. Read the guide in `node_modules/next/dist/docs/` before using a Next.js feature you do not know.

### UI standards

Every screen follows one template, built from the parts in `src/components/ui`. Reuse them; do not restyle per page.

| Part | Rule |
| --- | --- |
| Page | `Page` > `PageHeader` (title, one-line description, main action) > `StatGrid` > one `Card` holding `CardHeader`, `Toolbar`, a table and `Pagination` |
| Stat card | `Stat` with an icon. Blue is the one accent. Amber and red are the only colours that change a card, and only for a number that needs attention. Give it `onClick` to filter the table below or `href` to link elsewhere |
| Tables | `Table`, `Th`, `Td`. First column is the thing itself (left, link, `Cell` with one main line and muted lines). Status, counts, dates and quantities are centred. Action columns are labelled "Action", centred, with equal-width buttons. `BadgeCell` puts a short note under a badge, `Dash` is the placeholder for no value, `rowAccent` marks a row that needs attention, `OpenRow` makes a whole row click-to-open |
| Paging | `paginate(items, page)` and `Pagination`, 10 rows a page. Reset to page 1 whenever a filter changes |
| Badges | `Badge` with one of five tones: gray (neutral or closed), blue (normal or in progress), green (done or healthy), amber (waiting for someone), red (a problem). The pill is neutral and only the dot carries the colour. Do not add other colours |
| Buttons | `md` for header actions, forms and dialog footers. `sm` for actions inside table rows. `primary` for the one main action, `outline` for secondary, `danger` for a destructive row action, `ghost` for quiet ones such as Clear filters |
| Status wording | Put the label and tone for a status in one place (`features/orders/status.ts`, `features/containers/status.ts`, `features/assets/health.ts`) and use it everywhere |

---

## 8. Test and verify

| Check | Command | Needs |
| --- | --- | --- |
| Code style | `npm run lint` | |
| Types | `npm run typecheck` | |
| Portal logic | `npm test` | |
| Production build | `npm run build` | |
| API behaviour | `cd backend && pytest` | `pip install -r requirements-dev.txt` |
| Order flow in a browser | `npm run test:e2e` | API on 8001 and portal on 3000 running, `npx playwright install chromium` once |

`pytest` runs the API in-process against a temporary seeded database, so it needs no server and leaves no data behind. It covers every endpoint with the roles that matter, state-machine conflicts and input limits, and fails if the migrations do not match the models. To run it against PostgreSQL, point `TEST_DATABASE_URL` at an empty database.

`npm test` unit-tests the portal's pure logic: formatting, order and container status rules, input schemas, navigation and paging. Put new tests next to the code as `*.test.ts`.

`npm run test:e2e` drives the real portal: sign-in, lockout, sign-out revoking a session, password change, role limits for every kind of user, the delivery code flow from driver to customer, notifications, user management and catalogue edits. It signs in as the demo users and creates users, orders, products and locations, so run it only against demo data. Locally it reuses the servers you already run. Reset by deleting `backend/tan90.db`.

CI (`.github/workflows/ci.yml`) runs all of these on every pull request: API tests on Python 3.12 and 3.14 with SQLite and on 3.12 with PostgreSQL, portal lint, types, tests and build, a Docker job that brings up the whole compose stack, creates an admin and signs in, then the Playwright tests against a production build.

---

## 9. Production checklist

Do all of these before real users touch it. The Docker setup in the README covers the first six.

- [x] Real login: everyone signs in with their own account.
- [x] First admin: `python -m app.cli create-admin` (production loads no demo users).
- [x] Full stack: `docker-compose.yml` with PostgreSQL, migrations on deploy and health checks.
- [ ] Set `ENVIRONMENT=production` on the API (compose does). It then refuses weak secrets and never loads demo data.
- [ ] Set a random `JWT_SECRET` (32+ characters). Keep it stable: changing it signs everyone out and invalidates unused delivery codes.
- [ ] Set `CORS_ORIGINS` to the real portal address (compose uses `NEXT_PUBLIC_APP_URL`).
- [ ] Serve the portal over HTTPS (a reverse proxy such as Caddy or nginx in front of port 3000). The session cookie is `Secure` in production, so sign-in fails over plain HTTP except on `localhost`.
- [ ] Back up the PostgreSQL volume on a schedule and test a restore.
- [ ] Add error monitoring and log collection.
- [ ] Change the first admin's password from the Account page, and give each person their own account.

Already done: no default credentials in production code paths, restricted CORS, JWT secret check, no demo seeding in production, security headers on the portal, non-root Docker images, sign-in lockout, revocable sessions.

---

## 10. Status and plan

### Done

| Area | What works |
| --- | --- |
| Orders | List with search, filters, stat-card filters and pages. Create order (Ops, or a customer for their own company). Full lifecycle in the UI: approve, cancel, pack, dispatch, depart, arrive, deliver, verify, confirm receipt, return, assign driver, collect, receive, inspect, close |
| Customers | Own orders only. Place an order, verify a delivery by scanning the driver's QR or typing the code, confirm what arrived (missing or damaged marks it disputed), request a return, see containers in their custody |
| Drivers | Own deliveries and return pickups only. Depart, arrive and show the delivery QR, mark delivered, collect returned containers by scan |
| Notifications | Bell with unread count, inbox with filter, per-person read state. Customers hear when an order is approved, on its way, arrived, or closed |
| Users | Add, edit, deactivate, unlock, reset password. Only a super admin can create or change admin accounts. Nobody can deactivate or demote themselves |
| Inventory | Overview, products, stock per location, stock movements table with filters, record inward, damage, adjustment and transfer movements, add and edit products and locations. Each product has a reorder level: it is flagged on the Products page, and Ops get a notification once when total stock first falls to it. A location with open orders, stock or containers cannot be switched off |
| Export | Export CSV on Orders, Products, Stock, Stock Movements, Containers and Users. It saves exactly what the table shows after search and filters. Cells that start with `=`, `+`, `-` or `@` are marked as text so a spreadsheet does not run them |
| Delivery tracking | A driver can switch on Share my location on a delivery that is on the road; the phone sends a position every 20 seconds while the page is open. Ops, the customer and the driver see the last position on the order page, with an OpenStreetMap map and link |
| Live updates | Every open page refreshes its data and the bell every 30 seconds. It pauses while the tab is hidden, a dialog is open or someone is typing |
| Containers | Tracking by status, location, customer and driver. Register by scan, container page with order and movement history, tag replacement |
| Asset Management | Registry with health and status, edit, unregister, restore, by-station health cards |
| Scanning | Barcode or RFID reader input, typed codes, picker when no scanner, unknown code handling that raises an exception |
| Deliveries | Table of every open run with the next step for each: load and depart, arrive, deliver, collect |
| Exceptions | Open and resolved tables with search and filters, resolve |
| Sign-in | Per-user sign-in, one-hour sliding session, sign out that revokes the token, lockout after five wrong passwords, change password, admin password reset, unlock |
| Interface | One page template, one table style, five-tone colour palette, search, filters and paging on every list |
| API | 80 routes. Customers and drivers are limited to their own data |
| Database | Alembic migrations (4), PostgreSQL support (tested on PostgreSQL 17 locally and in CI), SQLite for development |
| Deployment | Docker images for the API and portal, compose file with PostgreSQL, migrate step, health checks, first-admin command, smoke-tested in CI |
| Tests | 60 API tests (pytest), 106 portal unit tests (Vitest), 28 browser tests (Playwright), all run by CI on every pull request |

### Possible next steps

| Item | Notes |
| --- | --- |
| Reports | Export CSV covers the raw tables. Charts, scheduled reports and per-customer statements need a decision on what the business wants to see |
| Route map and history | The order page shows the last position. A trail of past positions, ETA and geofenced arrival need the position history the API already stores |
| Faster live updates | Pages refresh every 30 seconds. Push updates (server-sent events) would make them instant |
| Self-service password reset | Needs a mail or SMS service. Until then an admin resets it from **Users** |

### Known issues

- Opening an unknown order or container ID shows the not-found page but the HTTP status is 200 in development.
- The dispatch driver list is not limited to the order's station (a Chennai order lists Bangalore drivers). Confirm whether that is intended.
- The movements list loads the latest 500 only.
- A role rule exists twice: in the API (the real check) and in `src/lib/permissions.ts` (what the screen shows). They can drift. Edit both together.
- There is no self-service "forgot password". An admin resets it from **Users** and hands the new password over. Email needs a mail service, which is not set up. Admins who set a first password know it, so ask people to change it on the Account page.
- The lockout is per account. It does not limit guesses across many accounts from one address; do that at the reverse proxy.
- Location sharing works only while the driver's page is open on the phone; a phone that locks its screen may pause it. A native app would not have that limit.
- Switching off a product only stops new orders for it; existing orders and stock stay as they are.
- A customer's notifications go to every user of that customer, so everyone from that company sees them.
- `backend/API.md` documents every route. When you add a route, add it there too; Swagger at `/docs` is always correct.
- The root `AGENTS.md` is generated by Next.js tooling. Leave it alone.

### Recommended order of work

1. Run the pilot: deploy with the Docker setup, put HTTPS in front, create the first admin, and add real users.
2. Collect feedback on drivers' phone use, location sharing and the customer flow.
3. Then pick from the possible next steps above.

---

## 11. Troubleshooting

| Problem | Fix |
| --- | --- |
| Portal shows "Backend is not reachable" | Start the API on port 8001, or set `BACKEND_API_URL` |
| "Address already in use" or `[Errno 10048]` | A server is already running on that port. Stop it, or use another port |
| Cannot delete `tan90.db` ("in use") | A stray `python`/`uvicorn` process still holds it (common after `--reload`). Stop all of them, then delete |
| `pip install` fails building a package | Use Python 3.12 or newer. Check `python --version` inside the venv |
| Type errors about missing routes after deleting a page | Delete the `.next` folder and run `npm run typecheck` again |
| Portal keeps sending you to the sign-in page | Your session ended: it was idle for an hour, you signed out somewhere else, your password or role changed, or the account was switched off. Sign in again. If it loops, clear the `tan90_session` cookie |
| "Too many failed attempts" at sign-in | The account is locked for 15 minutes after five wrong passwords. An admin can unlock it from **Users** |
| A customer cannot confirm receipt | They must verify the delivery code first (the driver's QR or its text). Ops can confirm on their behalf |
| `docker compose up` says a variable is not set | Copy `.env.docker.example` to `.env` and fill in `POSTGRES_PASSWORD` and `JWT_SECRET` |
| API refuses to start with `JWT_SECRET must be a random string` | Set a 32+ character `JWT_SECRET`, or run with `ENVIRONMENT=development` |
| API refuses to start with `Database is at revision ... expected ...` | Production only. Run `alembic upgrade head` from `backend/` |
| `alembic check` or `test_models_match_migrations` fails | A model changed without a migration. Run `alembic revision --autogenerate -m "..."` and review it |
| API stops answering after `pip install` while running with `--reload` | The reloader saw the package files change. Restart the API |
