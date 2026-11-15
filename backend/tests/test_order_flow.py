"""Container registration through the full order lifecycle.

Tests run in file order and share `ctx`: each stage builds on the one before it.
"""
import pytest

PCM = "prd-pcm-pos5"
BLR = "loc-fs-blr"


@pytest.fixture(scope="module")
def ctx(stamp):
    return {
        "epc1": f"E280A1{stamp:018d}",
        "epc2": f"E280A1{stamp + 1:018d}",
        "new_epc": f"E280A1{stamp + 100:018d}",
    }


def test_register_containers(api, tokens, ctx):
    c1 = api("POST", "/api/containers", tokens["packer"], expect=201, body={
        "epc": ctx["epc1"], "container_type_code": "SHIP-20", "location_id": BLR})
    assert c1["container_type"] == "20L Shipper Box"
    assert c1["capacity_litres"] == 20.0
    c2 = api("POST", "/api/containers", tokens["fsblr"], expect=201, body={
        "epc": ctx["epc2"], "container_type_code": "SHIP-40", "location_id": BLR})
    ctx["c1"], ctx["c2"] = c1["id"], c2["id"]


@pytest.mark.parametrize("who, body, expect", [
    ("blinkit", {"epc": "X", "container_type_code": "SHIP-20", "location_id": BLR}, 403),
    ("driver", {"epc": "Y", "container_type_code": "SHIP-20", "location_id": BLR}, 403),
    ("packer", {"epc": "ZZZZ9999", "container_type_code": "BAD", "location_id": BLR}, 400),
    ("packer", {"epc": "WWWW9999", "container_type_code": "SHIP-20",
                "location_id": "loc-fs-chn"}, 403),
])
def test_register_rejections(api, tokens, who, body, expect):
    api("POST", "/api/containers", tokens[who], expect=expect, body=body)


def test_register_duplicate_epc(api, tokens, ctx):
    api("POST", "/api/containers", tokens["packer"], expect=409, body={
        "epc": ctx["epc1"], "container_type_code": "SHIP-20", "location_id": BLR})


def test_container_reads(api, tokens, ctx):
    api("GET", "/api/containers", tokens["admin"])
    api("GET", "/api/containers?status=AVAILABLE", tokens["admin"])
    api("GET", f"/api/containers/{ctx['c1']}", tokens["admin"])
    api("GET", "/api/containers/me", tokens["blinkit"])
    api("GET", "/api/containers/me", tokens["admin"], expect=403)
    api("GET", f"/api/containers/{ctx['c1']}/history", tokens["admin"])


def test_replace_tag(api, tokens, ctx):
    api("POST", f"/api/containers/{ctx['c1']}/replace-tag", tokens["fsblr"],
        body={"new_epc": ctx["new_epc"], "reason": "Test"})
    ctx["epc1"] = ctx["new_epc"]


def test_create_order(api, tokens, customer, ctx):
    t = customer["token"]
    order = api("POST", "/api/orders", t, body={
        "customer_id": customer["customer_id"], "station_id": BLR,
        "destination": "Test", "items": [{"product_id": PCM, "quantity": 2}]})
    ctx["order"] = order["id"]

    other = {"customer_id": "cust-hyperpure", "station_id": BLR}
    api("POST", "/api/orders", t, expect=403,
        body={**other, "items": [{"product_id": PCM, "quantity": 1}]})
    api("POST", "/api/orders", tokens["admin"], expect=422, body={**other, "items": []})
    api("POST", "/api/orders", tokens["admin"], expect=422,
        body={**other, "items": [{"product_id": PCM, "quantity": 0}]})

    api("GET", "/api/orders", t)
    api("GET", f"/api/orders/{ctx['order']}", t)
    api("GET", f"/api/orders/{ctx['order']}/history", t)
    api("GET", f"/api/orders/{ctx['order']}/manifest", t)


def test_approve(api, tokens, ctx):
    path = f"/api/orders/{ctx['order']}/approve"
    body = {"station_id": BLR}
    api("POST", path, tokens["blinkit"], expect=403, body=body)
    api("POST", path, tokens["ops"], body=body)
    api("POST", path, tokens["ops"], expect=409, body=body)


def test_packing(api, tokens, ctx):
    p = tokens["packer"]
    order = ctx["order"]
    sess = api("POST", f"/api/orders/{order}/packing-sessions", p)
    api("POST", f"/api/orders/{order}/packing-sessions", p, expect=409)
    sid = sess["id"]

    api("POST", f"/api/packing-sessions/{sid}/scans", p,
        body={"epcs": [ctx["epc1"], ctx["epc2"]]})
    api("POST", f"/api/packing-sessions/{sid}/scans", p, expect=422, body={"epcs": []})

    api("PATCH", f"/api/packing-sessions/{sid}/items/{ctx['c1']}", p,
        body={"contents": [{"sku": "PCM-POS5", "qty": 2}]})
    api("PATCH", f"/api/packing-sessions/{sid}/items/{ctx['c2']}", p,
        body={"contents": [{"sku": "PCM-POS5", "qty": 1}]})
    api("PATCH", f"/api/packing-sessions/{sid}/items/nope", p, expect=404,
        body={"contents": []})

    api("POST", f"/api/packing-sessions/{sid}/complete", p)
    api("POST", f"/api/packing-sessions/{sid}/complete", p, expect=409)


def test_dispatch(api, tokens, ctx):
    path = f"/api/orders/{ctx['order']}/dispatch"
    p = tokens["packer"]
    base = {"driver_id": "usr-driver1", "vehicle_ref": "KA-X"}
    both = [ctx["epc1"], ctx["epc2"]]
    api("POST", path, p, expect=400, body={**base, "epcs": [ctx["epc1"]]})
    api("POST", path, p, expect=400, body={**base, "driver_id": "usr-invalid", "epcs": both})
    api("POST", path, p, body={**base, "epcs": both})
    api("POST", path, p, expect=409, body={**base, "epcs": both})


def test_transit(api, tokens, ctx):
    d = tokens["driver"]
    order = ctx["order"]
    api("POST", f"/api/orders/{order}/depart", d)
    api("POST", f"/api/orders/{order}/depart", d, expect=409)
    api("POST", f"/api/orders/{order}/arrive", d)
    api("POST", f"/api/orders/{order}/deliver", d)


def test_confirm_receipt(api, customer, ctx, tokens):
    path = f"/api/orders/{ctx['order']}/confirm-receipt"
    t = customer["token"]
    body = {"received": [ctx["c1"], ctx["c2"]], "missing": [], "damaged": []}
    # Confirming needs the driver's code first.
    api("POST", path, t, expect=409, body=body)
    api("GET", f"/api/orders/{ctx['order']}/qr", t, expect=403)
    code = api("GET", f"/api/orders/{ctx['order']}/qr", tokens["driver"])
    assert code["used"] is False
    api("POST", f"/api/orders/{ctx['order']}/verify", t, expect=400, body={"token": "wrong"})
    verified = api("POST", f"/api/orders/{ctx['order']}/verify", t, body={"token": code["token"]})
    assert {c["container_id"] for c in verified["containers"]} == {ctx["c1"], ctx["c2"]}
    api("POST", f"/api/orders/{ctx['order']}/verify", t, expect=409, body={"token": code["token"]})
    assert api("GET", f"/api/orders/{ctx['order']}/qr", tokens["driver"])["used"] is True
    detail = api("GET", f"/api/orders/{ctx['order']}/detail", t)
    assert detail["delivery_verified"] is True

    api("POST", path, t, expect=400, body={"received": [ctx["c1"]]})
    api("POST", path, t, body=body)
    api("GET", "/api/containers/me", t)


def test_return_flow(api, tokens, customer, ctx):
    order = ctx["order"]
    ids = [ctx["c1"], ctx["c2"]]
    both = [ctx["epc1"], ctx["epc2"]]
    api("POST", f"/api/orders/{order}/returns", customer["token"], body={"container_ids": ids})
    api("POST", f"/api/orders/{order}/returns", customer["token"], expect=409,
        body={"container_ids": ids})

    api("POST", f"/api/orders/{order}/returns/assign-driver", tokens["ops"],
        body={"driver_id": "usr-driver1"})
    api("POST", f"/api/orders/{order}/returns/collect", tokens["driver"], expect=400,
        body={"epcs": [ctx["epc1"]]})
    api("POST", f"/api/orders/{order}/returns/collect", tokens["driver"], body={"epcs": both})
    api("POST", f"/api/orders/{order}/returns/receive", tokens["fsblr"])
    api("POST", f"/api/orders/{order}/returns/inspect", tokens["fsblr"], body={"results": [
        {"container_id": ids[0], "condition": "OK"},
        {"container_id": ids[1], "condition": "OK"},
    ]})


def test_history_is_complete(api, tokens, ctx):
    hist = api("GET", f"/api/orders/{ctx['order']}/history", tokens["ops"])
    actions = {h["action"] for h in hist}
    expected = {"create", "approve", "start_packing", "complete_packing", "dispatch",
                "depart", "arrive", "deliver", "confirm", "request_return",
                "collect_return", "receive_return", "close"}
    assert expected <= actions, f"missing actions: {expected - actions}"


def test_deliveries_and_returns(api, tokens, customer, ctx):
    d = tokens["driver"]
    tasks = api("GET", "/api/deliveries", d)
    task = next((t for t in tasks if t.get("driver_id") == "usr-driver1"), None)
    assert task, "driver has no delivery task"
    api("POST", f"/api/deliveries/{task['id']}/gps", d,
        body={"latitude": 12.9716, "longitude": 77.5946, "accuracy_m": 8.5})
    api("POST", f"/api/deliveries/{task['id']}/gps", d, expect=422,
        body={"latitude": 999, "longitude": 999})
    api("POST", f"/api/deliveries/{task['id']}/scans", d,
        body={"epcs": [ctx["epc1"], ctx["epc2"]]})

    api("GET", "/api/returns", tokens["ops"])
    api("GET", "/api/returns", customer["token"])


def test_customer_is_told_along_the_way(api, customer, ctx):
    notes = api("GET", "/api/notifications", customer["token"])
    kinds = {n["kind"] for n in notes if n["reference_id"] == ctx["order"]}
    assert {"ORDER_APPROVED", "ORDER_DISPATCHED", "DELIVERY_ARRIVED", "ORDER_CLOSED"} <= kinds
    # The arrival message does not leak any part of the delivery code.
    arrived = next(n for n in notes if n["kind"] == "DELIVERY_ARRIVED")
    assert "token" not in arrived["body"].lower()


def test_admin_and_exceptions(api, tokens):
    api("GET", "/api/admin/overview", tokens["admin"])
    api("GET", "/api/admin/overview", tokens["blinkit"], expect=403)
    api("GET", "/api/admin/pending-approvals", tokens["ops"])
    feed = api("GET", "/api/admin/activity?limit=500", tokens["admin"])
    assert [r["occurred_at"] for r in feed] == sorted((r["occurred_at"] for r in feed), reverse=True)
    steps = [r for r in feed if r["entity_type"] == "order"]
    assert any(r["entity_label"] and r["action"] == "approve" for r in steps)
    assert len({r["id"] for r in feed}) == len(feed)
    api("GET", "/api/admin/activity?limit=10", tokens["admin"])
    api("GET", "/api/admin/activity?limit=501", tokens["admin"], expect=422)
    api("GET", "/api/admin/activity?limit=0", tokens["admin"], expect=422)

    api("GET", "/api/exceptions", tokens["ops"])
    api("GET", "/api/exceptions?status=OPEN", tokens["ops"])
    api("POST", "/api/exceptions/exc-demo-1/resolve", tokens["ops"])
    api("GET", "/health")


def test_input_limits(api, tokens):
    base = {"customer_id": "cust-hyperpure", "station_id": BLR}
    item = {"product_id": PCM, "quantity": 1}

    order = api("POST", "/api/orders", tokens["admin"], body={**base, "items": [item]})
    api("POST", f"/api/orders/{order['id']}/approve", tokens["ops"], body={"station_id": BLR})
    sess = api("POST", f"/api/orders/{order['id']}/packing-sessions", tokens["packer"])
    api("POST", f"/api/packing-sessions/{sess['id']}/scans", tokens["packer"], expect=422,
        body={"epcs": [f"E280A1{i:018d}" for i in range(501)]})

    api("POST", "/api/orders", tokens["admin"], expect=422, body={**base, "items": [item] * 101})
    api("POST", "/api/orders", tokens["admin"], expect=422,
        body={**base, "items": [{**item, "quantity": 10001}]})
    api("POST", "/api/deliveries/any/gps", tokens["driver"], expect=422,
        body={"latitude": 91, "longitude": 0})
