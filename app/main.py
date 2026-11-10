from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.db.base import init_schema
from app.routers import (
    admin, auth, containers, deliveries, dispatches,
    exceptions_router, notifications, orders, packing, products,
    returns, stations,
)

app = FastAPI(title="Tan90 Logistics API", version=__version__)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_schema()
    # Auto-seed on first boot — idempotent, no-op if data exists
    try:
        from app.db.seed import seed
        seed()
    except Exception as e:
        print(f"[startup] seed skipped: {e}")


@app.get("/health")
def health():
    return {"status": "ok", "version": __version__}


for r in (
    auth, orders, packing, dispatches, deliveries, returns,
    admin, stations, containers, exceptions_router, products, notifications,
):
    app.include_router(r.router)
