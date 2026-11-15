"""Customers and drivers only reach what is theirs."""

DRIVER_ID = "usr-driver1"
STAFF_ONLY = [
    "/api/containers",
    "/api/containers/summary",
    "/api/containers/lookup?code=CON-000001",
    "/api/containers/con-000001",
    "/api/containers/con-000001/history",
    "/api/containers/con-000001/detail",
    "/api/inventory",
    "/api/inventory/movements",
    "/api/customers",
    "/api/users",
    "/api/admin/overview",
    "/api/exceptions",
]


def test_customers_and_drivers_cannot_read_staff_data(api, tokens, customer):
    for token in (customer["token"], tokens["driver"]):
        for path in STAFF_ONLY:
            api("GET", path, token, expect=403)
    # Staff still can.
    for path in STAFF_ONLY[:3] + STAFF_ONLY[6:8]:
        api("GET", path, tokens["ops"])


def test_driver_sees_only_assigned_orders(api, tokens):
    mine = api("GET", "/api/orders", tokens["driver"])
    everything = api("GET", "/api/orders", tokens["ops"])
    assert mine, "the seeded driver has assignments"
    assert len(mine) < len(everything)
    assert all(DRIVER_ID in (o["driver_id"], o["return_driver_id"]) for o in mine)

    mine_ids = {o["id"] for o in mine}
    other = next(o for o in everything if o["id"] not in mine_ids)
    for suffix in ("", "/detail", "/history", "/manifest", "/qr"):
        api("GET", f"/api/orders/{other['id']}{suffix}", tokens["driver"], expect=403)
    api("GET", f"/api/orders/{mine[0]['id']}/detail", tokens["driver"])

    for row in api("GET", "/api/returns", tokens["driver"]):
        assert row["return_driver_id"] == DRIVER_ID


def test_customer_sees_only_own_orders(api, tokens, customer):
    own = api("GET", "/api/orders", customer["token"])
    assert all(o["customer_id"] == customer["customer_id"] for o in own)
    seeded = api("GET", "/api/orders", tokens["blinkit"])
    assert seeded and all(o["customer_id"] == "cust-blinkit" for o in seeded)
    other = next(o for o in api("GET", "/api/orders", tokens["ops"])
                 if o["customer_id"] != "cust-blinkit")
    for suffix in ("", "/detail", "/history", "/manifest"):
        api("GET", f"/api/orders/{other['id']}{suffix}", tokens["blinkit"], expect=403)


def test_customer_does_not_get_driver_email(api, tokens):
    seeded = api("GET", "/api/orders", tokens["blinkit"])
    with_driver = next(o for o in seeded if o["driver_id"])
    detail = api("GET", f"/api/orders/{with_driver['id']}/detail", tokens["blinkit"])
    assert detail["driver"]["full_name"] and detail["driver"]["email"] is None
    ops_view = api("GET", f"/api/orders/{with_driver['id']}/detail", tokens["ops"])
    assert ops_view["driver"]["email"]


def test_seeded_delivery_has_a_code_ready(api, tokens):
    """The demo data ships delivered orders whose driver code can be shown."""
    arrived = [o for o in api("GET", "/api/orders", tokens["ops"])
               if o["status"] in ("ARRIVED", "DELIVERED") and o["driver_id"]]
    assert arrived
    code = api("GET", f"/api/orders/{arrived[0]['id']}/qr", tokens["ops"])
    assert code["token"] and code["used"] is False
