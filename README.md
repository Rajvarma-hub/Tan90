# tan90

Full-stack Next.js 16 application (App Router, Cache Components, Tailwind CSS v4, TypeScript).

## Getting started

```bash
npm install
npm run dev
```

If you don't have a `.env.local` yet, create one from [.env.example](.env.example). Don't copy over an existing one, or your local values will be lost.

| Command                       | Purpose                                     |
| ----------------------------- | ------------------------------------------- |
| `npm run dev`                 | Start the dev server                        |
| `npm run build`               | Production build (standalone output)        |
| `npm run start`               | Serve the production build                  |
| `npm run lint`                | ESLint                                      |
| `npm run typecheck`           | Generate route types and run `tsc --noEmit` |
| `docker compose up --build`   | Build and run the production image on :3000 |

## Project structure

```
src/
├── app/                 # Routing only: layouts, pages, route handlers, special files
│   ├── (marketing)/     # Public pages sharing the marketing shell
│   ├── api/             # Route handlers (e.g. /api/health)
│   ├── error.tsx        # Segment error boundary
│   ├── global-error.tsx # Root error boundary
│   ├── not-found.tsx    # 404 UI
│   └── layout.tsx       # Root layout: <html>, fonts, metadata
├── components/
│   ├── layout/          # App shell pieces (header, footer, nav)
│   └── ui/              # Design-system primitives (button, input, ...)
├── config/              # Validated env + static app config
├── features/            # Domain modules, one folder per feature
├── hooks/               # Shared client hooks
├── lib/                 # Isomorphic utilities: AppError, ActionResult, validation
├── server/              # Server-only infrastructure shared across features
│   ├── db/              # Database client + schema (ORM not chosen yet)
│   ├── action.ts        # createAction(): validated Server Actions returning ActionResult
│   ├── route.ts         # withErrorHandling() + parseJson() for Route Handlers
│   ├── errors.ts        # toAppError(): maps unknown errors, rethrows redirect/notFound
│   └── logger.ts        # Structured logger (JSON lines in production)
└── types/               # Shared TypeScript types
```

### Conventions

- **`app/` stays thin.** Pages compose components and call into `features/` or `server/`. Route-specific, non-shared code may be colocated in `_components/` or `_lib/` private folders.
- **Feature modules** (`src/features/<feature>/`) own a vertical slice: `components/`, `actions.ts` (`"use server"`), `queries.ts` (server-only reads), `service.ts` (business logic shared by actions and route handlers), `schemas.ts` (zod), `types.ts`. Features import from `components/`, `lib/`, `server/`, but not from other features' internals.
- **Server boundary.** Anything touching secrets, the database, or `process.env` starts with `import "server-only"`. Queries perform authorization and return minimal DTOs to the UI ([Data Access Layer](https://nextjs.org/docs/app/guides/data-security#data-access-layer)).
- **Errors.** Throw `AppError(code, message)` for expected failures; its message is shown to clients. Any other error is logged and returned as a generic `INTERNAL_ERROR`.
- **Server Actions** are built with `createAction(schema, handler)` and return `ActionResult<T>` (`{ ok: true, data }` or `{ ok: false, error }`) instead of throwing.
- **Route Handlers** (for webhooks and external clients) wrap the handler in `withErrorHandling()` and read bodies with `parseJson(request, schema)`. Errors come back as `{ error: { code, message, fieldErrors? } }` with the matching HTTP status.
- **Environment variables** are validated with zod at startup. Server vars go in [src/config/env.server.ts](src/config/env.server.ts); browser-safe `NEXT_PUBLIC_*` vars go in [src/config/env.public.ts](src/config/env.public.ts). Document every var in `.env.example`.
- **Route groups** like `(marketing)`, `(auth)`, `(dashboard)` give each area its own layout without affecting URLs.
- **Caching.** Cache Components is enabled: cache with `"use cache"` + `cacheLife`/`cacheTag`, and wrap request-time data (`cookies()`, `headers()`, uncached fetches) in `<Suspense>`.
- **Imports** use the `@/*` alias (maps to `src/*`). Typed routes are enabled, so `<Link href>` is checked at build time.
- **Naming:** kebab-case file names, PascalCase components, named exports outside of Next.js special files.
- **Deployment.** Builds use `output: "standalone"`. The [Dockerfile](Dockerfile) runs as a non-root user and checks `/api/health`. Pass `NEXT_PUBLIC_*` values as build args, because they are inlined at build time. Provide server secrets as runtime environment variables. Security headers are set in [next.config.ts](next.config.ts).
