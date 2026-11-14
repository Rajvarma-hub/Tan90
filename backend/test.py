#!/usr/bin/env python3
"""Comprehensive endpoint test — every endpoint, every role, every limit."""
import sys
import time
import requests

BASE = "http://127.0.0.1:8000"
PASSWORD = "password123"

GREEN, RED, YELLOW, CYAN, RESET = "\033[92m", "\033[91m", "\033[93m", "\033[96m", "\033[0m"
passed = 0
failed = 0
failures: list[str] = []


def call(method, path, *, token=None, body=None, expect=200, name=""):
    global passed, failed
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    label = name or f"{method} {path}"
    try:
        r = requests.request(method, f"{BASE}{path}", headers=headers,
                             json=body, timeout=30)
    except requests.RequestException as e:
        failed += 1
        failures.append(f"{label} — {e}")
        print(f"    {RED}FAIL{RESET} {label} — connection error")
        return None
    if r.status_code != expect:
        failed += 1
        failures.append(f"{label} — {r.status_code} (expect {expect}): {r.text[:200]}")
        print(f"    {RED}FAIL{RESET} {label} — {r.status_code} (expect {expect})")
        return None
    passed += 1
    print(f"    {GREEN}OK  {RESET} {label}")
    try:
        return r.json()
    except ValueError:
        return {}


def login(email, password=PASSWORD):
    r = call("POST", "/api/auth/login",
             body={"email": email, "password": password},
             name=f"login {email}")
    return r["access_token"] if r else None


def section(t):
    print(f"\n{CYAN}{'═' * 72}{RESET}")
    print(f"{CYAN}  {t}{RESET}")
    print(f"{CYAN}{'═' * 72}{RESET}")


# ═══════════════════════════════════════════════════════════════════════
#  SETUP
# ═══════════════════════════════════════════════════════════════════════

section("SETUP")

admin   = login("admin@tan90.local")
ops     = login("ops@tan90.local")
fsblr   = login("fsblr@tan90.local")
fschn   = login("fschn@tan90.local")
packer  = login("packer1@tan90.local")
driver  = login("driver1@tan90.local")
blinkit = login("blinkit@tan90.local")
hyperpure = login("hyperpure@tan90.local")

if not all([admin, ops, fsblr, fschn, packer, driver, blinkit, hyperpure]):
    print(f"\n{RED}[ABORT] API not reachable{RESET}")
    sys.exit(1)

ts = int(time.time())
ts_ms = int(ts * 1000)


# ═══════════════════════════════════════════════════════════════════════
#  1-3  AUTH
# ═══════════════════════════════════════════════════════════════════════

section("AUTH")

call("POST", "/api/auth/login",
     body={"email": "admin@tan90.local", "password": "wrong"},
     expect=401, name="#1 wrong password")
call("POST", "/api/auth/login", body={}, expect=422, name="#1 empty body")
call("GET", "/api/auth/me", token=admin, name="#3 admin /me")
call("GET", "/api/auth/me", expect=401, name="#3 no auth")

new_email = f"cust{ts}@tan90.local"
nu = call("POST", "/api/auth/register", body={
    "email": new_email, "password": PASSWORD, "full_name": "TC",
    "role": "CUSTOMER", "customer_name": f"TC {ts}",
}, expect=201, name="#2 register customer")
tc_id = nu["customer_id"] if nu else None

call("POST", "/api/auth/register", body={
    "email": new_email, "password": PASSWORD, "full_name": "Dupe",
    "role": "CUSTOMER", "customer_name": "Dupe",
}, expect=409, name="#2 duplicate → 409")
call("POST", "/api/auth/register", body={
    "email": f"bad{ts}@t.local", "password": PASSWORD,
    "full_name": "X", "role": "DRIVER",
}, expect=401, name="#2 internal no token → 401")
call("POST", "/api/auth/register", body={
    "email": f"bad2{ts}@t.local", "password": PASSWORD,
    "full_name": "X", "role": "CUSTOMER",
}, expect=400, name="#2 customer no name/id → 400")
call("POST", "/api/auth/register", body={
    "email": f"short{ts}@t.local", "password": "1234567",
    "full_name": "X", "role": "CUSTOMER", "customer_name": "X",
}, expect=422, name="#2 password 7 chars → 422")

tc = login(new_email)


# ═══════════════════════════════════════════════════════════════════════
#  4-5  NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════

section("NOTIFICATIONS")

call("GET", "/api/notifications", token=ops, name="#4 as ops")
call("GET", "/api/notifications?unread_only=true", token=admin, name="#4 unread")
notes = call("GET", "/api/notifications", token=ops)
if notes:
    call("POST", f"/api/notifications/{notes[0]['id']}/read", token=ops, name="#5 mark read")


# ═══════════════════════════════════════════════════════════════════════
#  6-10  STATIONS
# ═══════════════════════════════════════════════════════════════════════

section("STATIONS")

s = call("GET", "/api/stations", token=admin, name="#6 all")
if s:
    assert len(s) >= 6
call("GET", "/api/stations?kind=FREEZING_STATION", token=admin, name="#6 filter FS")
call("GET", "/api/stations?kind=BAD", token=admin, expect=400, name="#6 bad kind")
call("GET", "/api/stations/loc-fs-blr", token=admin, name="#7 detail")
call("GET", "/api/stations/nope", token=admin, expect=404, name="#7 not found")

new_code = f"FS-T{ts % 10000}"
loc = call("POST", "/api/stations", token=admin, body={
    "code": new_code, "name": "Test FS", "kind": "FREEZING_STATION",
}, expect=201, name="#8 create")
loc_id = loc["id"] if loc else None
call("POST", "/api/stations", token=blinkit, body={
    "code": "X", "name": "X", "kind": "WAREHOUSE",
}, expect=403, name="#8 customer → 403")
call("POST", "/api/stations", token=admin, body={
    "code": new_code, "name": "D", "kind": "WAREHOUSE",
}, expect=409, name="#8 duplicate → 409")

if loc_id:
    call("PATCH", f"/api/stations/{loc_id}", token=admin,
         body={"name": "Upd"}, name="#9 update")

call("GET", "/api/stations/loc-fs-blr/work-queue", token=fsblr, name="#10 own queue")
call("GET", "/api/stations/loc-fs-chn/work-queue", token=fsblr,
     expect=403, name="#10 wrong station → 403")


# ═══════════════════════════════════════════════════════════════════════
#  11-15  PRODUCTS + TYPES
# ═══════════════════════════════════════════════════════════════════════

section("PRODUCTS + TYPES")

call("GET", "/api/products", token=admin, name="#11 list")
call("GET", "/api/products/prd-pcm-pos5", token=admin, name="#12 detail")

new_sku = f"PCM-T{ts % 10000}"
call("POST", "/api/products", token=admin, body={
    "sku": new_sku, "name": "Test", "setpoint_c": -5.0,
}, expect=201, name="#13 create")
call("POST", "/api/products", token=admin, body={
    "sku": new_sku, "name": "D", "setpoint_c": 0.0,
}, expect=409, name="#13 duplicate → 409")
call("POST", "/api/products", token=blinkit, body={
    "sku": "X", "name": "X", "setpoint_c": 0.0,
}, expect=403, name="#13 customer → 403")

types = call("GET", "/api/containers/types", token=packer, name="#15 types")
if types:
    assert len(types) == 8


# ═══════════════════════════════════════════════════════════════════════
#  16  CONTAINER REGISTRATION
# ═══════════════════════════════════════════════════════════════════════

section("CONTAINER REGISTRATION")

epc1 = f"E280A1{ts_ms:018d}"
epc2 = f"E280A1{ts_ms + 1:018d}"

c1 = call("POST", "/api/containers", token=packer, body={
    "epc": epc1, "container_type_code": "SHIP-20",
    "location_id": "loc-fs-blr",
}, expect=201, name="#16 packer SHIP-20")
if c1:
    assert c1["container_type"] == "20L Shipper Box"
    assert c1["capacity_litres"] == 20.0

c2 = call("POST", "/api/containers", token=fsblr, body={
    "epc": epc2, "container_type_code": "SHIP-40",
    "location_id": "loc-fs-blr",
}, expect=201, name="#16 fsm SHIP-40")
c1_id, c2_id = (c1["id"] if c1 else None, c2["id"] if c2 else None)

call("POST", "/api/containers", token=blinkit, body={
    "epc": "X", "container_type_code": "SHIP-20",
    "location_id": "loc-fs-blr",
}, expect=403, name="#16 customer → 403")
call("POST", "/api/containers", token=driver, body={
    "epc": "Y", "container_type_code": "SHIP-20",
    "location_id": "loc-fs-blr",
}, expect=403, name="#16 driver → 403")
call("POST", "/api/containers", token=packer, body={
    "epc": epc1, "container_type_code": "SHIP-20",
    "location_id": "loc-fs-blr",
}, expect=409, name="#16 dup EPC → 409")
call("POST", "/api/containers", token=packer, body={
    "epc": "Z", "container_type_code": "BAD",
    "location_id": "loc-fs-blr",
}, expect=400, name="#16 bad type → 400")
call("POST", "/api/containers", token=packer, body={
    "epc": "W", "container_type_code": "SHIP-20",
    "location_id": "loc-fs-chn",
}, expect=403, name="#16 wrong station → 403")


# ═══════════════════════════════════════════════════════════════════════
#  17-21  CONTAINERS
# ═══════════════════════════════════════════════════════════════════════

section("CONTAINERS")

call("GET", "/api/containers", token=admin, name="#17 all")
call("GET", "/api/containers?status=AVAILABLE", token=admin, name="#17 filter")
call("GET", f"/api/containers/{c1_id}", token=admin, name="#18 detail")
call("GET", "/api/containers/me", token=blinkit, name="#19 customer")
call("GET", "/api/containers/me", token=admin, expect=403, name="#19 admin → 403")
call("GET", f"/api/containers/{c1_id}/history", token=admin, name="#20 history")

new_epc = f"E280A1{ts_ms + 100:018d}"
call("POST", f"/api/containers/{c1_id}/replace-tag", token=fsblr, body={
    "new_epc": new_epc, "reason": "Test",
}, name="#21 replace")
epc1 = new_epc


# ═══════════════════════════════════════════════════════════════════════
#  22-42  ORDER LIFECYCLE
# ═══════════════════════════════════════════════════════════════════════

section("ORDER LIFECYCLE")

order = call("POST", "/api/orders", token=tc, body={
    "customer_id": tc_id, "station_id": "loc-fs-blr",
    "destination": "Test", "items": [
        {"product_id": "prd-pcm-pos5", "quantity": 2},
    ],
}, name="#22 create order")
order_id = order["id"] if order else None
if not order_id:
    print(f"\n{RED}[ABORT] Order failed{RESET}")
    sys.exit(1)

call("POST", "/api/orders", token=tc, body={
    "customer_id": "cust-hyperpure", "station_id": "loc-fs-blr",
    "items": [{"product_id": "prd-pcm-pos5", "quantity": 1}],
}, expect=403, name="#22 customer for another → 403")
call("POST", "/api/orders", token=admin, body={
    "customer_id": "cust-hyperpure", "station_id": "loc-fs-blr",
    "items": [],
}, expect=422, name="#22 empty items → 422")
call("POST", "/api/orders", token=admin, body={
    "customer_id": "cust-hyperpure", "station_id": "loc-fs-blr",
    "items": [{"product_id": "prd-pcm-pos5", "quantity": 0}],
}, expect=422, name="#22 qty=0 → 422")

call("GET", "/api/orders", token=tc, name="#23 own")
call("GET", f"/api/orders/{order_id}", token=tc, name="#24 owner")
call("GET", f"/api/orders/{order_id}/history", token=tc, name="#25 history")
call("GET", f"/api/orders/{order_id}/manifest", token=tc, name="#26 manifest (empty)")

call("POST", f"/api/orders/{order_id}/approve", token=blinkit,
     body={"station_id": "loc-fs-blr"}, expect=403, name="#27 customer → 403")
call("POST", f"/api/orders/{order_id}/approve", token=ops,
     body={"station_id": "loc-fs-blr"}, name="#27 ops approve")
call("POST", f"/api/orders/{order_id}/approve", token=ops,
     body={"station_id": "loc-fs-blr"}, expect=409, name="#27 again → 409")

sess = call("POST", f"/api/orders/{order_id}/packing-sessions",
            token=packer, name="#28 start session")
sid = sess["id"] if sess else None
call("POST", f"/api/orders/{order_id}/packing-sessions", token=packer,
     expect=409, name="#28 dup session → 409")

call("POST", f"/api/packing-sessions/{sid}/scans", token=packer,
     body={"epcs": [epc1, epc2]}, name="#29 scan 2")
call("POST", f"/api/packing-sessions/{sid}/scans", token=packer,
     body={"epcs": []}, expect=422, name="#29 empty → 422")

call("PATCH", f"/api/packing-sessions/{sid}/items/{c1_id}", token=packer,
     body={"contents": [{"sku": "PCM-POS5", "qty": 2}]}, name="#30 contents c1")
call("PATCH", f"/api/packing-sessions/{sid}/items/{c2_id}", token=packer,
     body={"contents": [{"sku": "PCM-POS5", "qty": 1}]}, name="#30 contents c2")
call("PATCH", f"/api/packing-sessions/{sid}/items/nope", token=packer,
     body={"contents": []}, expect=404, name="#30 bad container → 404")

call("POST", f"/api/packing-sessions/{sid}/complete", token=packer,
     name="#31 complete")
call("POST", f"/api/packing-sessions/{sid}/complete", token=packer,
     expect=409, name="#31 again → 409")

call("POST", f"/api/orders/{order_id}/dispatch", token=packer, body={
    "driver_id": "usr-driver1", "vehicle_ref": "KA-X",
    "epcs": [epc1],  # missing epc2
}, expect=400, name="#32 missing EPC → 400")
call("POST", f"/api/orders/{order_id}/dispatch", token=packer, body={
    "driver_id": "usr-invalid", "vehicle_ref": "KA-X",
    "epcs": [epc1, epc2],
}, expect=400, name="#32 bad driver → 400")
call("POST", f"/api/orders/{order_id}/dispatch", token=packer, body={
    "driver_id": "usr-driver1", "vehicle_ref": "KA-X",
    "epcs": [epc1, epc2],
}, name="#32 dispatch")
call("POST", f"/api/orders/{order_id}/dispatch", token=packer, body={
    "driver_id": "usr-driver1", "vehicle_ref": "KA-X",
    "epcs": [epc1, epc2],
}, expect=409, name="#32 again → 409")

call("POST", f"/api/orders/{order_id}/depart", token=driver, name="#33 depart")
call("POST", f"/api/orders/{order_id}/depart", token=driver,
     expect=409, name="#33 again → 409")
call("POST", f"/api/orders/{order_id}/arrive", token=driver, name="#34 arrive")
call("POST", f"/api/orders/{order_id}/deliver", token=driver, name="#35 deliver")

# Confirm receipt
call("POST", f"/api/orders/{order_id}/confirm-receipt", token=tc,
     body={"received": [c1_id]},  # missing c2_id
     expect=400, name="#37 missing container → 400")
call("POST", f"/api/orders/{order_id}/confirm-receipt", token=tc,
     body={"received": [c1_id, c2_id], "missing": [], "damaged": []},
     name="#37 confirm all")

call("GET", "/api/containers/me", token=tc, name="#19 customer custody")

call("POST", f"/api/orders/{order_id}/returns", token=tc,
     body={"container_ids": [c1_id, c2_id]}, name="#38 request return")
call("POST", f"/api/orders/{order_id}/returns", token=tc,
     body={"container_ids": [c1_id, c2_id]}, expect=409,
     name="#38 again → 409")

call("POST", f"/api/orders/{order_id}/returns/assign-driver", token=ops,
     body={"driver_id": "usr-driver1"}, name="#39 assign driver")
call("POST", f"/api/orders/{order_id}/returns/collect", token=driver,
     body={"epcs": [epc1]},  # missing one
     expect=400, name="#40 missing → 400")
call("POST", f"/api/orders/{order_id}/returns/collect", token=driver,
     body={"epcs": [epc1, epc2]}, name="#40 collect")
call("POST", f"/api/orders/{order_id}/returns/receive", token=fsblr,
     name="#41 receive")
call("POST", f"/api/orders/{order_id}/returns/inspect", token=fsblr,
     body={"results": [
         {"container_id": c1_id, "condition": "OK"},
         {"container_id": c2_id, "condition": "OK"},
     ]}, name="#42 inspect all OK → CLOSED")

hist = call("GET", f"/api/orders/{order_id}/history", token=ops, name="#25 history")
if hist:
    for a in ["create", "approve", "start_packing", "complete_packing",
              "dispatch", "depart", "arrive", "deliver", "confirm",
              "request_return", "collect_return", "receive_return", "close"]:
        if a not in [h["action"] for h in hist]:
            print(f"    {YELLOW}WARN{RESET} action '{a}' missing")


# ═══════════════════════════════════════════════════════════════════════
#  43-46  DELIVERIES + RETURNS list
# ═══════════════════════════════════════════════════════════════════════

section("DELIVERIES + RETURNS list")

tasks = call("GET", "/api/deliveries", token=driver, name="#43 driver tasks")
if tasks:
    task_id = next((t["id"] for t in tasks if t.get("driver_id") == "usr-driver1"), None)
    if task_id:
        call("POST", f"/api/deliveries/{task_id}/gps", token=driver, body={
            "latitude": 12.9716, "longitude": 77.5946, "accuracy_m": 8.5,
        }, name="#44 gps")
        call("POST", f"/api/deliveries/{task_id}/gps", token=driver, body={
            "latitude": 999, "longitude": 999,
        }, expect=422, name="#44 bad lat → 422")
        call("POST", f"/api/deliveries/{task_id}/scans", token=driver, body={
            "epcs": [epc1, epc2],
        }, name="#45 delivery scan")

call("GET", "/api/returns", token=ops, name="#46 returns (ops)")
call("GET", "/api/returns", token=tc, name="#46 returns (customer)")


# ═══════════════════════════════════════════════════════════════════════
#  47-51  ADMIN + EXCEPTIONS
# ═══════════════════════════════════════════════════════════════════════

section("ADMIN + EXCEPTIONS")

call("GET", "/api/admin/overview", token=admin, name="#47 overview")
call("GET", "/api/admin/overview", token=blinkit, expect=403, name="#47 customer → 403")
call("GET", "/api/admin/pending-approvals", token=ops, name="#48 pending")
call("GET", "/api/admin/activity", token=admin, name="#49 activity")
call("GET", "/api/admin/activity?limit=10", token=admin, name="#49 limit 10")
call("GET", "/api/admin/activity?limit=501", token=admin, expect=422,
     name="#49 limit 501 → 422")
call("GET", "/api/admin/activity?limit=0", token=admin, expect=422,
     name="#49 limit 0 → 422")

call("GET", "/api/exceptions", token=ops, name="#50 exceptions")
call("GET", "/api/exceptions?status=OPEN", token=ops, name="#50 open")
call("POST", "/api/exceptions/exc-demo-1/resolve", token=ops, name="#51 resolve")
call("GET", "/health", name="#52 health")


# ═══════════════════════════════════════════════════════════════════════
#  LIMITS
# ═══════════════════════════════════════════════════════════════════════

section("LIMITS")

# Create fresh order + session to test scan/epcs limits
fo = call("POST", "/api/orders", token=admin, body={
    "customer_id": "cust-hyperpure", "station_id": "loc-fs-blr",
    "items": [{"product_id": "prd-pcm-pos5", "quantity": 1}],
}, name="LIMIT setup order")
if fo:
    call("POST", f"/api/orders/{fo['id']}/approve", token=ops,
         body={"station_id": "loc-fs-blr"}, name="LIMIT approve")
    fs = call("POST", f"/api/orders/{fo['id']}/packing-sessions",
              token=packer, name="LIMIT session")
    if fs:
        # epcs list max=500 → 501 fails
        call("POST", f"/api/packing-sessions/{fs['id']}/scans", token=packer,
             body={"epcs": ["E280A1" + "0" * 12 + f"{i:06d}" for i in range(501)]},
             expect=422, name="LIMIT scan 501 epcs → 422")

# items max=100 → 101 fails
call("POST", "/api/orders", token=admin, body={
    "customer_id": "cust-hyperpure", "station_id": "loc-fs-blr",
    "items": [{"product_id": "prd-pcm-pos5", "quantity": 1}] * 101,
}, expect=422, name="LIMIT 101 items → 422")

# quantity max=10000
call("POST", "/api/orders", token=admin, body={
    "customer_id": "cust-hyperpure", "station_id": "loc-fs-blr",
    "items": [{"product_id": "prd-pcm-pos5", "quantity": 10001}],
}, expect=422, name="LIMIT qty 10001 → 422")

# GPS lat/lng bounds
call("POST", "/api/deliveries/any/gps", token=driver, body={
    "latitude": 91, "longitude": 0,
}, expect=422, name="LIMIT lat 91 → 422")


# ═══════════════════════════════════════════════════════════════════════
#  SUMMARY
# ═══════════════════════════════════════════════════════════════════════

print(f"\n{CYAN}{'═' * 72}{RESET}")
print(f"{CYAN}  SUMMARY{RESET}")
print(f"{CYAN}{'═' * 72}{RESET}")
print(f"  {GREEN}PASSED{RESET}: {passed}")
print(f"  {RED}FAILED{RESET}: {failed}")
if failures:
    print(f"\n{RED}Failures:{RESET}")
    for f in failures:
        print(f"  - {f}")
print()

sys.exit(0 if failed == 0 else 1)