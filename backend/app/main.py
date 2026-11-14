from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.core.config import settings
from app.db.base import init_schema
from app.routers import (
    admin, auth, containers, deliveries, dispatches,
    exceptions_router, notifications, orders, packing, products,
    returns, stations, inventory, directory,
)

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_schema()
    # Demo data is for development only; it never runs in production.
    if not settings.is_production:
        try:
            from app.db.seed import seed
            seed()  # idempotent: no-op if data exists
        except Exception as e:
            print(f"[startup] seed skipped: {e}")
    yield


app = FastAPI(title="Tan90 Logistics API", version=__version__, lifespan=lifespan)

# Auth is a bearer token in a header, not a cookie, so credentials are not needed.
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origin_list,
    allow_methods=["*"], allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "version": __version__}


for r in (
    auth, orders, packing, dispatches, deliveries, returns,
    admin, stations, containers, exceptions_router, products, notifications,
    inventory, directory,
):
    app.include_router(r.router)
