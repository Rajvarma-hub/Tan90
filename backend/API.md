# Tan90 API — Frontend Integration Guide

Base URL: `http://localhost:8001` (the port you start uvicorn on)
Swagger UI: `http://localhost:8001/docs`

Every endpoint follows the same template:
- **What** — one-line description
- **Roles** — which logged-in roles can call it
- **Request** — body / query params
- **Response** — JSON shape
- **Errors** — HTTP codes you must handle

---

## Conventions

| Item | Value |
|---|---|
| Auth header | `Authorization: Bearer <access_token>` |
| Content-Type | `application/json` |
| Timestamps | ISO 8601 UTC (`2026-11-10T14:00:00Z`) |
| IDs | strings (`ord-abc123`, `con-000001`, `usr-admin1`) |
| **Never send `status`** | Every state change is its own endpoint |
| Error shape | `{ "detail": "message" }` or `{ "detail": { "message": "...", ... } }` |

## Error codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Bad request / mismatch |
| 401 | Missing / invalid token |
| 403 | Wrong role / wrong scope |
| 404 | Not found |
| 409 | State machine violation |
| 422 | Schema validation error (bad field, missing, too short/long) |

## TypeScript types

```ts
export type Role =
  | 'SUPER_ADMIN' | 'OPERATIONS_ADMIN' | 'FREEZING_STATION_MANAGER'
  | 'WAREHOUSE' | 'PACKING_WORKER' | 'DRIVER' | 'CUSTOMER'
  | 'SUPPLY_CHAIN_MANAGER';

export type OrderStatus =
  | 'PENDING_OPS_APPROVAL' | 'APPROVED' | 'PACKING' | 'PACKED'
  | 'DISPATCHED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED'
  | 'CUSTOMER_CONFIRMED' | 'DISPUTED' | 'CANCELLED'
  | 'RETURN_REQUESTED' | 'RETURN_COLLECTED' | 'RETURN_RECEIVED' | 'CLOSED';

export type ContainerStatus =
  | 'AVAILABLE' | 'PACKING' | 'PACKED' | 'IN_TRANSIT_TO_CUSTOMER'
  | 'WITH_CUSTOMER' | 'RETURN_REQUESTED' | 'IN_TRANSIT_TO_STATION'
  | 'UNDER_INSPECTION' | 'DAMAGED' | 'QUARANTINED' | 'MISSING';

export interface User {
  id: string; email: string; full_name: string; role: Role;
  location_id: string | null; customer_id: string | null;
}

export interface Location {
  id: string; code: string; name: string;
  kind: 'WAREHOUSE' | 'FREEZING_STATION';
  address: string | null; is_active: boolean;
}

export interface Product {
  id: string; sku: string; name: string;
  setpoint_c: number | null; unit: string; is_active: boolean;
}

export interface ContainerType {
  code: string; name: string; capacity_litres: number;
}

export interface Container {
  id: string; container_code: string; container_type: string;
  capacity_litres: number; status: ContainerStatus;
  current_location_id: string | null;
  current_customer_id: string | null;
  epc: string | null;
}

export interface OrderItem {
  id: string; product_id: string; quantity: number;
}

export interface Order {
  id: string; order_number: string;
  customer_id: string; station_id: string | null;
  destination: string | null; status: OrderStatus;
  expected_delivery_at: string | null;
  created_at: string; items: OrderItem[];
}

export interface Notification {
  id: string; kind: string; title: string; body: string;
  reference_type: string | null; reference_id: string | null;
  read_at: string | null; created_at: string;
}

export interface OrderEvent {
  id: string; action: string;
  from: OrderStatus; to: OrderStatus;
  actor_id: string | null; notes: string | null; occurred_at: string;
}

export interface AdminOverview {
  containers_by_status: Record<string, number>;
  orders_by_status: Record<string, number>;
  containers_held_by_customers: Array<{
    customer_id: string; customer_name: string; count: number;
  }>;
  total_containers: number;
  total_orders: number;
}
```

---

# AUTH (3 endpoints)

## 1. `POST /api/auth/login` — Get an access token

Exchange email + password for a JWT.

**Roles** — public
**Request**
```json
{ "email": "admin@tan90.local", "password": "password123" }
```
**Response 200**
```json
{ "access_token": "eyJhbGci...", "token_type": "bearer" }
```
**Errors**
- `401` wrong credentials
- `422` missing body field

---

## 2. `POST /api/auth/register` — Create a user

Public for CUSTOMER self-signup. Admin-only for internal roles (needs Bearer).

**Roles** — public (CUSTOMER) / `SUPER_ADMIN`, `OPERATIONS_ADMIN` (internal)

**Request — customer with new company**
```json
{
  "email": "tan90@gmail.com",
  "password": "rajkumar123",
  "full_name": "Rajkumar",
  "role": "CUSTOMER",
  "customer_name": "Raj Cold Chain"
}
```

**Request — customer for existing company**
```json
{
  "email": "raj2@tan90.local",
  "password": "rajkumar123",
  "full_name": "Raj Kumar",
  "role": "CUSTOMER",
  "customer_id": "cust-hyperpure"
}
```

**Request — internal user (admin Bearer required)**
```json
{
  "email": "driver9@tan90.local",
  "password": "driverpass123",
  "full_name": "Vikram",
  "role": "DRIVER"
}
```

**Response 201** — the new `User`
```json
{
  "id": "usr-abc123",
  "email": "tan90@gmail.com",
  "full_name": "Rajkumar",
  "role": "CUSTOMER",
  "location_id": null,
  "customer_id": "cust-xyz"
}
```

**Errors**
- `400` customer signup missing `customer_name`/`customer_id`; unknown role
- `401` internal role attempted without token
- `403` non-admin attempted internal role
- `404` `customer_id` doesn't exist
- `409` email already registered
- `422` password < 8 chars, empty full_name

**Side effects** — creates `User`; creates `Customer` if `customer_name` given

---

## 3. `GET /api/auth/me` — Get the current user

Returns the logged-in user's profile.

**Roles** — any authenticated
**Request** — no body
**Response 200** — `User`
```json
{
  "id": "usr-admin1",
  "email": "admin@tan90.local",
  "full_name": "Soumalya Mukherjee",
  "role": "SUPER_ADMIN",
  "location_id": null,
  "customer_id": null
}
```
**Errors** — `401` missing/invalid token

---

# NOTIFICATIONS (2 endpoints)

## 4. `GET /api/notifications` — My inbox

Returns notifications for the current user (direct + role-scoped).

**Roles** — any authenticated
**Request** — `?unread_only=true` (optional)
**Response 200** — `Notification[]`
```json
[
  {
    "id": "ntf-abc",
    "kind": "ORDER_CREATED",
    "title": "Order ORD-0005 needs approval",
    "body": "Customer cust-hyperpure created an order",
    "reference_type": "order",
    "reference_id": "ord-xyz",
    "read_at": null,
    "created_at": "2026-11-07T09:30:00.000Z"
  }
]
```
**Errors** — `401`

**`kind` values for UI styling:** `ORDER_CREATED`, `ORDER_APPROVED`, `ORDER_PACKED`, `ORDER_DISPATCHED`, `DRIVER_ASSIGNED`, `DELIVERY_ARRIVED`, `DELIVERY_CONFIRMED`, `DELIVERY_DISPUTED`, `RETURN_REQUESTED`, `RETURN_ASSIGNED`, `RETURN_INBOUND`, `ORDER_CLOSED`

---

## 5. `POST /api/notifications/{id}/read` — Mark as read

Sets `read_at` on one notification.

**Roles** — any authenticated
**Request** — no body
**Response 200**
```json
{ "ok": true }
```
**Errors** — `401`

---

# STATIONS (5 endpoints)

## 6. `GET /api/stations` — List all locations

**Roles** — any authenticated
**Request** — `?kind=FREEZING_STATION` or `?kind=WAREHOUSE` (optional)
**Response 200** — `Location[]`
```json
[
  {
    "id": "loc-fs-blr",
    "code": "FS-BLR",
    "name": "Freezing Station Bangalore",
    "kind": "FREEZING_STATION",
    "address": "Kannamangala, Bengaluru East 560049",
    "is_active": true
  }
]
```
**Errors**
- `400` invalid `kind`
- `401` no token

---

## 7. `GET /api/stations/{id}` — One station

**Roles** — any authenticated
**Request** — no body
**Response 200** — `Location`
**Errors** — `404` not found

---

## 8. `POST /api/stations` — Create a station or warehouse

**Roles** — `SUPER_ADMIN`, `OPERATIONS_ADMIN`
**Request**
```json
{
  "code": "FS-MYS",
  "name": "Freezing Station Mysore",
  "kind": "FREEZING_STATION",
  "address": "Hebbal, Mysore 570016"
}
```
**Response 201** — `Location`
**Errors**
- `403` wrong role
- `409` code exists
- `422` invalid `kind` (must be `FREEZING_STATION` or `WAREHOUSE`); empty name; code too short

**Side effects** — creates `Location` + `AuditLog`

---

## 9. `PATCH /api/stations/{id}` — Update a station

**Roles** — `SUPER_ADMIN`, `OPERATIONS_ADMIN`
**Request** — any subset
```json
{ "name": "FS Mysore Main", "address": "...", "is_active": false }
```
**Response 200** — `Location`
**Errors** — `403` wrong role, `404` not found

---

## 10. `GET /api/stations/{id}/work-queue` — Orders pending at this station

Returns `APPROVED` and `PACKING` orders at that freezing station.

**Roles** — `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `FREEZING_STATION_MANAGER`, `PACKING_WORKER`
**Request** — no body
**Response 200**
```json
[
  {
    "id": "ord-2",
    "order_number": "ORD-0002",
    "status": "APPROVED",
    "customer_id": "cust-instamart"
  }
]
```
**Errors**
- `400` location is not a `FREEZING_STATION`
- `403` FSM/Packer calling for a station that isn't theirs
- `404` station not found

---

# PRODUCTS (4 endpoints)

## 11. `GET /api/products` — List PCM SKUs

**Roles** — any authenticated
**Request** — `?active_only=false` (optional, default true)
**Response 200** — `Product[]`
```json
[
  {
    "id": "prd-pcm-pos5",
    "sku": "PCM-POS5",
    "name": "PCM Panel +5 C (Pharma 2-8 C)",
    "setpoint_c": 5.0,
    "unit": "panel",
    "is_active": true
  }
]
```
**Errors** — `401`

---

## 12. `GET /api/products/{id}` — One product

**Roles** — any authenticated
**Request** — no body
**Response 200** — `Product`
**Errors** — `404`

---

## 13. `POST /api/products` — Create a product

**Roles** — `SUPER_ADMIN`, `OPERATIONS_ADMIN`
**Request**
```json
{
  "sku": "PCM-NEG30",
  "name": "PCM Panel -30 C",
  "setpoint_c": -30.0,
  "unit": "panel"
}
```
**Response 201** — `Product`
**Errors**
- `403` wrong role
- `409` SKU exists
- `422` SKU too short

---

## 14. `PATCH /api/products/{id}` — Update a product

**Roles** — `SUPER_ADMIN`, `OPERATIONS_ADMIN`
**Request** — any subset
```json
{ "name": "Renamed", "setpoint_c": 4.5, "is_active": false }
```
**Response 200** — `Product`
**Errors** — `403`, `404`

---

# CONTAINER TYPES (1 endpoint)

## 15. `GET /api/containers/types` — Reference list for the picker

Populate the container-type dropdown from this. Never let the user type capacity — it's derived from `code`.

**Roles** — any authenticated
**Request** — no body
**Response 200** — `ContainerType[]`
```json
[
  { "code": "SHIP-15",  "name": "15L Shipper Box",        "capacity_litres": 15 },
  { "code": "SHIP-20",  "name": "20L Shipper Box",        "capacity_litres": 20 },
  { "code": "SHIP-40",  "name": "40L Shipper Box",        "capacity_litres": 40 },
  { "code": "SHIP-60",  "name": "60L Shipper Box",        "capacity_litres": 60 },
  { "code": "SHIP-100", "name": "100L Shipper Box",       "capacity_litres": 100 },
  { "code": "ICE-50",   "name": "50L Blowmolded Ice Box", "capacity_litres": 50 },
  { "code": "ICE-100",  "name": "100L Rotomolded Icebox", "capacity_litres": 100 },
  { "code": "BAG-20",   "name": "20L Insulation Bag",     "capacity_litres": 20 }
]
```
**Errors** — `401`

---

# CONTAINERS (6 endpoints)

## 16. `POST /api/containers` — Register a new physical container

Packer scans EPC → picks type → backend generates code, derives capacity, links EPC.

**Roles** — `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `FREEZING_STATION_MANAGER`, `WAREHOUSE`, `PACKING_WORKER`
**Request**
```json
{
  "epc": "E280A1000000000000000100",
  "container_type_code": "SHIP-20",
  "location_id": "loc-fs-blr"
}
```
**Response 201** — `Container`
```json
{
  "id": "con-000061",
  "container_code": "CON-000061",
  "container_type": "20L Shipper Box",
  "capacity_litres": 20.0,
  "status": "AVAILABLE",
  "current_location_id": "loc-fs-blr",
  "current_customer_id": null,
  "epc": "E280A1000000000000000100"
}
```
**Errors**
- `400` unknown `container_type_code`
- `403` FSM/Packer/Warehouse used a location that isn't theirs; role not permitted
- `404` location not found
- `409` EPC already linked
- `422` EPC < 4 chars

**Side effects** — creates `Container`, `RFIDTag`, `ContainerMovement`, `AuditLog`

---

## 17. `GET /api/containers` — List containers

**Roles** — any authenticated
**Request** — `?status=`, `?location_id=`, `?type_code=` (all optional)
**Response 200** — `Container[]`
**Errors**
- `400` bad `type_code`
- `401`

FSM/Packer/Warehouse see only their own location unless `?location_id=` is given.

---

## 18. `GET /api/containers/{id}` — One container

**Roles** — any authenticated
**Request** — no body
**Response 200** — `Container`
**Errors** — `404`

---

## 19. `GET /api/containers/me` — My containers (customer custody)

**Roles** — `CUSTOMER` only
**Request** — no body
**Response 200** — `Container[]` (all `WITH_CUSTOMER` for this customer)
**Errors**
- `403` not a customer
- `401`

---

## 20. `GET /api/containers/{id}/history` — Movement log

Every state change for a container, newest first.

**Roles** — any authenticated
**Request** — no body
**Response 200**
```json
[
  {
    "id": "mov-abc",
    "from_status": "AVAILABLE",
    "to_status": "PACKING",
    "reason": "PACKING_STARTED",
    "reference_type": "PACKING_SESSION",
    "reference_id": "ps-xyz",
    "actor_id": "usr-packer1",
    "occurred_at": "2026-11-07T09:30:00.000Z"
  }
]
```
**Errors** — `404`

---

## 21. `POST /api/containers/{id}/replace-tag` — Swap an RFID tag

Old tag → inactive. New tag → active. Container code unchanged.

**Roles** — `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `FREEZING_STATION_MANAGER`
**Request**
```json
{ "new_epc": "E280A1999999999999999999", "reason": "Tag damaged" }
```
**Response 200** — updated `Container`
**Errors**
- `403` wrong role
- `404` container not found
- `409` new EPC already active

---

# ORDERS — READ (5 endpoints)

## 22. `POST /api/orders` — Create an order

Order starts at `PENDING_OPS_APPROVAL`. Ops gets a notification.

**Roles** — `CUSTOMER` (own), `OPERATIONS_ADMIN`, `SUPER_ADMIN`
**Request**
```json
{
  "customer_id": "cust-hyperpure",
  "station_id": "loc-fs-blr",
  "destination": "Hyperpure DC, Whitefield",
  "expected_delivery_at": "2026-11-10T14:00:00Z",
  "items": [
    { "product_id": "prd-pcm-pos5", "quantity": 4 },
    { "product_id": "prd-pcm-neg10", "quantity": 2 }
  ]
}
```
**Response 200** — `Order` with `status: "PENDING_OPS_APPROVAL"`
**Errors**
- `403` customer creating for another customer
- `404` customer or product not found
- `422` empty items; qty <= 0; > 100 items; qty > 10000

**Side effects** — creates `Order`, `OrderItem[]`, `OrderEvent`, notification to Ops

---

## 23. `GET /api/orders` — List orders (scoped)

**Roles** — any authenticated
**Request** — `?status=` (optional)
**Response 200** — `Order[]`
**Errors** — `401`

**Scope** — customer sees own, FSM/Packer see own station, ops/admin/sc see all

---

## 24. `GET /api/orders/{id}` — One order

**Roles** — any authenticated (scoped)
**Request** — no body
**Response 200** — `Order`
**Errors** — `403` customer accessing another's, `404`

---

## 25. `GET /api/orders/{id}/history` — State transition log

Every action on the order, oldest first.

**Roles** — any authenticated (scoped)
**Request** — no body
**Response 200** — `OrderEvent[]`
```json
[
  { "id": "oev-1", "action": "create",
    "from": "—", "to": "PENDING_OPS_APPROVAL",
    "actor_id": "usr-ops1", "notes": null,
    "occurred_at": "2026-11-07T09:00:00.000Z" }
]
```
**Errors** — `403`, `404`

---

## 26. `GET /api/orders/{id}/manifest` — Packing manifest

What's inside each container: container ID, EPC, contents.

**Roles** — any authenticated (scoped)
**Request** — no body
**Response 200**
```json
{
  "order_id": "ord-1",
  "order_number": "ORD-0001",
  "customer_id": "cust-hyperpure",
  "session": { "id": "ps-xyz", "status": "COMPLETED" },
  "containers": [
    {
      "container_id": "con-000001",
      "container_code": "CON-000001",
      "epc": "E280A1000000000000000001",
      "contents": [ { "sku": "PCM-POS5", "qty": 4 } ]
    }
  ]
}
```
**Errors** — `403`, `404`

---

# ORDER LIFECYCLE ACTIONS (16 endpoints)

## 27. `POST /api/orders/{id}/approve` — Ops approves order

Assigns the station and unlocks the packing flow.

**Roles** — `OPERATIONS_ADMIN`, `SUPER_ADMIN`
**Request**
```json
{ "station_id": "loc-fs-blr" }
```
**Response 200** — `Order` with `status: "APPROVED"`
**Errors**
- `403` wrong role
- `404`
- `409` not `PENDING_OPS_APPROVAL`

**Side effects** — sets `approved_by`, `approved_at`; notifies FSM + Packer at station

---

## 28. `POST /api/orders/{id}/packing-sessions` — Start a packing session

**Roles** — `FREEZING_STATION_MANAGER`, `PACKING_WORKER`, `OPERATIONS_ADMIN`, `SUPER_ADMIN`
**Request** — no body
**Response 200**
```json
{ "id": "ps-xyz", "order_id": "ord-1", "status": "OPEN" }
```
**Errors**
- `403` FSM/Packer at wrong station
- `404`
- `409` active session exists; order not `APPROVED`

**Side effects** — `Order.status` → `PACKING`; creates `PackingSession`

---

## 29. `POST /api/packing-sessions/{sid}/scans` — Scan EPCs into a session

Moves containers from `AVAILABLE` → `PACKING`. Unknown EPCs create exceptions.

**Roles** — same as #28
**Request**
```json
{ "epcs": ["E280A1000000000000000001", "E280A1000000000000000002"] }
```
**Response 200**
```json
{
  "added": [
    { "epc": "E280A1000000000000000001",
      "container_id": "con-000001",
      "container_code": "CON-000001" }
  ],
  "duplicates": [],
  "unknown_epcs": [],
  "unavailable": []
}
```
**Errors**
- `403` not your station
- `404` session not found
- `409` session not `OPEN`
- `422` empty `epcs` or > 500

---

## 30. `PATCH /api/packing-sessions/{sid}/items/{cid}` — Set manifest contents

Record what SKUs and quantities are packed in one container.

**Roles** — same as #28
**Request**
```json
{ "contents": [ { "sku": "PCM-POS5", "qty": 4 } ] }
```
**Response 200**
```json
{ "container_id": "con-000001", "contents": [ { "sku": "PCM-POS5", "qty": 4 } ] }
```
**Errors**
- `404` container not in this session (scan it first)
- `409` session not `OPEN`

---

## 31. `POST /api/packing-sessions/{sid}/complete` — Complete packing

Validates every container has contents. Moves order → `PACKED`.

**Roles** — same as #28
**Request** — no body
**Response 200**
```json
{ "order_id": "ord-1", "status": "PACKED" }
```
**Errors**
- `400` no containers; any container has empty contents
- `403`
- `404`
- `409` session not `OPEN`

**Side effects** — containers → `PACKED`; notifies Ops

---

## 32. `POST /api/orders/{id}/dispatch` — Dispatch with driver + EPC verify

The `epcs` list must **exactly match** what was scanned in step 29.

**Roles** — `FREEZING_STATION_MANAGER`, `PACKING_WORKER`, `OPERATIONS_ADMIN`, `SUPER_ADMIN`
**Request**
```json
{
  "driver_id": "usr-driver1",
  "vehicle_ref": "KA-01-AB-1234",
  "epcs": ["E280A1000000000000000001", "E280A1000000000000000002"]
}
```
**Response 200** — `Order` with `status: "DISPATCHED"`
**Errors**
- `400` EPC mismatch — response has `missing_epcs` + `unexpected_epcs`; invalid driver
- `403`
- `404`
- `409` not `PACKED`

**Side effects** — containers → `IN_TRANSIT_TO_CUSTOMER`; creates `Dispatch` + `DeliveryTask`; notifies driver + Ops

---

## 33. `POST /api/orders/{id}/depart` — Driver leaves the station

**Roles** — `DRIVER` (own), `OPERATIONS_ADMIN`, `SUPER_ADMIN`
**Request** — no body
**Response 200** — `Order` with `status: "IN_TRANSIT"`
**Errors**
- `403` not your assignment
- `404`
- `409` not `DISPATCHED`

---

## 34. `POST /api/orders/{id}/arrive` — Driver reaches the customer

Generates the QR token for customer verification.

**Roles** — same as #33
**Request** — no body
**Response 200** — `Order` with `status: "ARRIVED"`
**Errors** — `403`, `404`, `409` not `IN_TRANSIT`

**Side effects** — creates `QRToken`; notifies customer

---

## 35. `POST /api/orders/{id}/deliver` — Driver hands over

**Roles** — same as #33
**Request** — no body
**Response 200** — `Order` with `status: "DELIVERED"`
**Errors** — `403`, `404`, `409` not `ARRIVED`

---

## 36. `POST /api/orders/{id}/verify` — Customer verifies QR

Unlocks the container list before confirm-receipt.

**Roles** — `CUSTOMER` (own order)
**Request**
```json
{ "token": "abc123..." }
```
**Response 200**
```json
{
  "order_id": "ord-1",
  "order_number": "ORD-0001",
  "status": "DELIVERED",
  "containers": [
    { "container_id": "con-000001",
      "container_code": "CON-000001",
      "status": "IN_TRANSIT_TO_CUSTOMER" }
  ]
}
```
**Errors**
- `401` invalid / expired token
- `403` not your order
- `409` token already used

---

## 37. `POST /api/orders/{id}/confirm-receipt` — Customer confirms delivery

**Every** expected container must be accounted for across `received` / `missing` / `damaged`.

**Roles** — `CUSTOMER` (own order)
**Request**
```json
{
  "received": ["con-000001", "con-000002"],
  "missing": [],
  "damaged": [],
  "notes": "All good"
}
```
**Response 200** — `Order` with `status: "CUSTOMER_CONFIRMED"` (or `"DISPUTED"` if any missing/damaged)
**Errors**
- `400` report doesn't cover every container (response has `expected` + `reported`)
- `403`
- `404`

**Side effects** — `received` → `WITH_CUSTOMER`; `damaged` → `ExceptionRecord`; `missing` → `ExceptionRecord`; notifies Ops

---

## 38. `POST /api/orders/{id}/returns` — Customer requests return

**Roles** — `CUSTOMER` (own), `OPERATIONS_ADMIN`, `SUPER_ADMIN`
**Request**
```json
{ "container_ids": ["con-000001", "con-000002"] }
```
**Response 200** — `Order` with `status: "RETURN_REQUESTED"`
**Errors**
- `400` container not in customer custody
- `403`
- `404`
- `409` order not in a returnable state

**Side effects** — containers → `RETURN_REQUESTED`; notifies Ops, FSM, **all drivers**

---

## 39. `POST /api/orders/{id}/returns/assign-driver` — Assign a pickup driver

**Roles** — `FREEZING_STATION_MANAGER`, `OPERATIONS_ADMIN`, `SUPER_ADMIN`
**Request**
```json
{ "driver_id": "usr-driver1" }
```
**Response 200** — `Order` (status unchanged, `return_driver_id` set)
**Errors**
- `400` invalid driver
- `403` FSM at wrong station
- `404`

**Side effects** — notifies assigned driver

---

## 40. `POST /api/orders/{id}/returns/collect` — Driver collects containers

EPCs must match the `RETURN_REQUESTED` containers.

**Roles** — `DRIVER` (assigned), `OPERATIONS_ADMIN`, `SUPER_ADMIN`
**Request**
```json
{ "epcs": ["E280A1000000000000000001", "E280A1000000000000000002"] }
```
**Response 200** — `Order` with `status: "RETURN_COLLECTED"`
**Errors**
- `400` EPC mismatch — response has `missing_epcs` / `unexpected_epcs`
- `403` not your pickup
- `404`
- `409` not `RETURN_REQUESTED`

**Side effects** — containers → `IN_TRANSIT_TO_STATION`; notifies FSM

---

## 41. `POST /api/orders/{id}/returns/receive` — FSM receives at station

**Roles** — `FREEZING_STATION_MANAGER`, `OPERATIONS_ADMIN`, `SUPER_ADMIN`
**Request** — no body
**Response 200** — `Order` with `status: "RETURN_RECEIVED"`
**Errors** — `403`, `404`, `409` not `RETURN_COLLECTED`

---

## 42. `POST /api/orders/{id}/returns/inspect` — FSM inspects containers

`OK` → order closes. Any `DAMAGED`/`CONTAMINATED` → order stays open.

**Roles** — same as #41
**Request**
```json
{
  "results": [
    { "container_id": "con-000001", "condition": "OK", "contains_panels": false },
    { "container_id": "con-000002", "condition": "DAMAGED", "notes": "Hinge broken" }
  ]
}
```
**Response 200** — `Order`
- All `OK` → `status: "CLOSED"`
- Any issue → `status` stays `RETURN_RECEIVED`

**Errors**
- `400` container not in `IN_TRANSIT_TO_STATION`
- `403`
- `404`
- `409` not `RETURN_RECEIVED`
- `422` empty results; invalid condition; > 500 results

**Side effects** — `OK` → `AVAILABLE`, `DAMAGED` → `DAMAGED`, `CONTAMINATED` → `QUARANTINED`; creates `ReturnInspection` per container; if all OK notifies Ops

---

# DELIVERIES (3 endpoints)

## 43. `GET /api/deliveries` — List delivery tasks

Driver sees own; ops/admin see all.

**Roles** — `DRIVER` (own), `OPERATIONS_ADMIN`, `SUPER_ADMIN`, `SUPPLY_CHAIN_MANAGER`
**Request** — no body
**Response 200**
```json
[
  {
    "id": "task-xyz",
    "dispatch_id": "dsp-abc",
    "status": "DEPARTED",
    "driver_id": "usr-driver1"
  }
]
```
**Errors**
- `403` wrong role
- `401`

---

## 44. `POST /api/deliveries/{task_id}/gps` — Record GPS point

**Roles** — `DRIVER` (own task), `OPERATIONS_ADMIN`, `SUPER_ADMIN`
**Request**
```json
{ "latitude": 12.9716, "longitude": 77.5946, "accuracy_m": 8.5 }
```
**Response 200**
```json
{ "id": "gps-xyz" }
```
**Errors**
- `403` not your task
- `404`
- `422` lat outside ±90, lng outside ±180

---

## 45. `POST /api/deliveries/{task_id}/scans` — Driver scans at delivery

Records EPCs seen at handover; matched vs unknown.

**Roles** — `DRIVER`, `OPERATIONS_ADMIN`, `SUPER_ADMIN`
**Request**
```json
{ "epcs": ["E280A1000000000000000001"] }
```
**Response 200**
```json
{
  "matched_container_ids": ["con-000001"],
  "unknown_epcs": []
}
```
**Errors** — `404`, `422` empty `epcs`

---

# RETURNS (1 endpoint)

## 46. `GET /api/returns` — List return requests

**Roles** — any authenticated (scoped)
**Request** — `?status=` (optional)
**Response 200**
```json
[
  {
    "order_id": "ord-11",
    "order_number": "ORD-0011",
    "status": "RETURN_REQUESTED",
    "return_requested_at": "2026-11-07T10:00:00.000Z",
    "return_driver_id": "usr-driver1"
  }
]
```
**Errors** — `401`

---

# ADMIN (3 endpoints)

## 47. `GET /api/admin/overview` — Full dashboard

**Roles** — `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `SUPPLY_CHAIN_MANAGER`
**Request** — no body
**Response 200** — `AdminOverview`
```json
{
  "containers_by_status": {
    "AVAILABLE": 48,
    "WITH_CUSTOMER": 2,
    "RETURN_REQUESTED": 4,
    "...": 0
  },
  "orders_by_status": {
    "PENDING_OPS_APPROVAL": 1,
    "APPROVED": 1,
    "PACKING": 1,
    "...": 0
  },
  "containers_held_by_customers": [
    {
      "customer_id": "cust-hyperpure",
      "customer_name": "Zomato Hyperpure",
      "count": 2
    }
  ],
  "total_containers": 60,
  "total_orders": 15
}
```
**Errors** — `403`

---

## 48. `GET /api/admin/pending-approvals` — Ops action queue

Orders at `PENDING_OPS_APPROVAL`.

**Roles** — `SUPER_ADMIN`, `OPERATIONS_ADMIN`
**Request** — no body
**Response 200**
```json
[
  {
    "id": "ord-1",
    "order_number": "ORD-0001",
    "customer_id": "cust-hyperpure",
    "created_at": "2026-11-07T09:00:00.000Z"
  }
]
```
**Errors** — `403`

---

## 49. `GET /api/admin/activity` — Recent audit log

**Roles** — `SUPER_ADMIN`, `OPERATIONS_ADMIN`
**Request** — `?limit=50` (1–500, default 50)
**Response 200**
```json
[
  {
    "id": "aud-xyz",
    "entity_type": "order",
    "entity_id": "ord-1",
    "action": "ORDER_CREATED",
    "actor_id": "usr-ops1",
    "occurred_at": "2026-11-07T09:00:00.000Z"
  }
]
```
**Errors**
- `403`
- `422` limit out of 1–500

---

# EXCEPTIONS (2 endpoints)

## 50. `GET /api/exceptions` — Operational exceptions

**Roles** — `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `FREEZING_STATION_MANAGER`, `SUPPLY_CHAIN_MANAGER`
**Request** — `?status=OPEN`, `?kind=UNKNOWN_EPC` (both optional)
**Response 200**
```json
[
  {
    "id": "exc-demo-1",
    "kind": "UNKNOWN_EPC",
    "severity": "WARNING",
    "status": "OPEN",
    "reference_type": "SCAN_SESSION",
    "reference_id": "scan-demo",
    "details": "{\"epc\": \"E280A1UNKNOWN\"}",
    "created_at": "2026-11-07T09:00:00.000Z",
    "resolved_at": null
  }
]
```
**Errors** — `403`

---

## 51. `POST /api/exceptions/{id}/resolve` — Mark resolved

**Roles** — `SUPER_ADMIN`, `OPERATIONS_ADMIN`
**Request** — no body
**Response 200**
```json
{ "id": "exc-demo-1", "status": "RESOLVED" }
```
**Errors** — `403`, `404`

---

# HEALTH (1 endpoint)

## 52. `GET /health` — Liveness check

**Roles** — public
**Request** — no body
**Response 200**
```json
{ "status": "ok", "version": "0.1.0" }
```

---

# Order state machine

The frontend never sends `status`. Every transition is its own endpoint.

```
PENDING_OPS_APPROVAL
  → #27 approve              (ops/admin)
APPROVED
  → #28 start packing session (packer/fsm)
PACKING
  → #31 complete packing      (packer/fsm)
PACKED
  → #32 dispatch              (packer/fsm)
DISPATCHED
  → #33 depart                (driver)
IN_TRANSIT
  → #34 arrive                (driver)
ARRIVED
  → #35 deliver               (driver)
DELIVERED
  → #36 verify + #37 confirm-receipt (customer)
CUSTOMER_CONFIRMED
  → #38 request return        (customer)
RETURN_REQUESTED
  → #39 assign driver         (ops/fsm)
  → #40 collect               (driver)
RETURN_COLLECTED
  → #41 receive               (fsm)
RETURN_RECEIVED
  → #42 inspect (all OK)      (fsm)
CLOSED
```

Any illegal transition returns `409` with `{"detail": "Cannot perform 'action' from status 'X'"}`.

---

# Pages → endpoints

| Page | Endpoints to call |
|---|---|
| Login | #1 |
| Sign-up | #2 |
| Dashboard | #3, #4, #47 (admin/ops) |
| Notifications inbox | #4, #5 |
| Orders list | #23 |
| Order detail | #24, #25, #26 |
| Ops: Approvals | #48, #27 |
| Packer: Work queue | #10 |
| Packer: Active session | #28, #29, #30, #31 |
| Packer: Register container | #15, #16 |
| Packer: Dispatch | #32 |
| Driver: My deliveries | #43 |
| Driver: Active delivery | #33, #34, #35, #44, #45 |
| Customer: My orders | #23 |
| Customer: Verify delivery | #36, #37 |
| Customer: My containers | #19 |
| Customer: Request return | #38 |
| FSM: Inbound returns | #46, #41, #42 |
| Containers list | #17 |
| Container detail | #18, #20 |
| Container tag replacement | #21 |
| Admin: Overview | #47 |
| Products | #11, #12, #13, #14 |
| Stations | #6, #7, #8, #9 |
| Exceptions | #50, #51 |

---

# Seed reference (after auto-seed on startup)

**All passwords:** `password123`

| Role | Login |
|---|---|
| Super Admin | `admin@tan90.local` |
| Ops | `ops@tan90.local` |
| FSM Bangalore | `fsblr@tan90.local` |
| FSM Chennai | `fschn@tan90.local` |
| Packer | `packer1@tan90.local` |
| Driver | `driver1@tan90.local` |
| Customer | `hyperpure@tan90.local`, `instamart@tan90.local`, `blinkit@tan90.local`, `medplus@tan90.local` |

**Data at startup:**
- 6 locations (4 FS + 2 WH)
- 6 customers
- 21 users (2–3 per role)
- 8 PCM products
- 60 containers + 60 RFID tags
- 15 orders across every lifecycle state (1 pending, 1 approved, 1 packing, 1 packed, 1 dispatched, 1 in-transit, 1 arrived, 1 delivered, 1 confirmed, 1 disputed, 1 return-requested, 1 return-collected, 1 return-received, 1 closed, 1 damaged-return)
- 32 inventory balances
- 1 open exception

---

# Polling

No websockets. Recommended intervals:
- `GET /api/notifications?unread_only=true` every 10s for the badge
- `GET /api/orders/{id}` every 10s on the detail page
