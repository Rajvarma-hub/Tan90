from conftest import PASSWORD

STATION = "loc-fs-blr"


def _new_staff(api, admin_token, stamp, tag, role="WAREHOUSE", **extra):
    email = f"{tag}{stamp}@tan90.local"
    body = {"email": email, "password": PASSWORD, "full_name": f"Staff {tag}", "role": role,
            "location_id": "loc-wh-blr", **extra}
    user = api("POST", "/api/auth/register", admin_token, expect=201, body=body)
    return email, user


def _login(api, email, password=PASSWORD, expect=200):
    return api("POST", "/api/auth/login", expect=expect, body={"email": email, "password": password})


def test_only_admins_can_manage_users(api, tokens, customer):
    for who in (customer["token"], tokens["driver"], tokens["fsblr"], tokens["packer"]):
        api("GET", "/api/admin/users", who, expect=403)
    users = api("GET", "/api/admin/users", tokens["ops"])
    assert {"email", "role", "is_active", "locked", "location_code"} <= set(users[0])
    api("GET", "/api/admin/users", tokens["admin"])


def test_admin_roles_need_a_super_admin(api, tokens, stamp):
    body = {"email": f"boss{stamp}@tan90.local", "password": PASSWORD, "full_name": "B",
            "role": "OPERATIONS_ADMIN"}
    api("POST", "/api/auth/register", tokens["ops"], expect=403, body=body)
    api("POST", "/api/auth/register", tokens["admin"], expect=201, body=body)

    # Station roles need a real location.
    nowhere = {"email": f"nw{stamp}@tan90.local", "password": PASSWORD, "full_name": "N",
               "role": "PACKING_WORKER"}
    api("POST", "/api/auth/register", tokens["ops"], expect=400, body=nowhere)
    api("POST", "/api/auth/register", tokens["ops"], expect=404,
        body={**nowhere, "location_id": "loc-nope"})


def test_edit_a_user(api, tokens, stamp):
    email, user = _new_staff(api, tokens["ops"], stamp, "edit")
    uid = user["id"]
    updated = api("PATCH", f"/api/admin/users/{uid}", tokens["ops"],
                  body={"full_name": "Renamed", "role": "PACKING_WORKER", "location_id": STATION})
    assert updated["full_name"] == "Renamed" and updated["role"] == "PACKING_WORKER"
    assert updated["location_code"] == "FS-BLR"

    # The role is inside the token, so a role change ends the old sessions.
    old = _login(api, email)["access_token"]
    api("PATCH", f"/api/admin/users/{uid}", tokens["ops"], body={"role": "WAREHOUSE"})
    api("GET", "/api/auth/me", old, expect=401)

    api("PATCH", f"/api/admin/users/{uid}", tokens["ops"], expect=400, body={"role": "NOPE"})
    api("PATCH", f"/api/admin/users/{uid}", tokens["ops"], expect=400, body={"role": "CUSTOMER"})
    api("PATCH", f"/api/admin/users/{uid}", tokens["ops"], expect=404, body={"location_id": "x"})
    api("PATCH", f"/api/admin/users/{uid}", tokens["ops"], expect=400, body={"location_id": None})
    api("PATCH", "/api/admin/users/usr-none", tokens["ops"], expect=404, body={"full_name": "x"})


def test_ops_cannot_touch_admins_or_promote(api, tokens, stamp):
    users = {u["email"]: u for u in api("GET", "/api/admin/users", tokens["admin"])}
    boss = users["admin@tan90.local"]
    api("PATCH", f"/api/admin/users/{boss['id']}", tokens["ops"], expect=403, body={"full_name": "x"})
    api("POST", f"/api/admin/users/{boss['id']}/password", tokens["ops"], expect=403,
        body={"new_password": "another-password"})
    _, user = _new_staff(api, tokens["ops"], stamp, "promote")
    api("PATCH", f"/api/admin/users/{user['id']}", tokens["ops"], expect=403,
        body={"role": "SUPER_ADMIN"})
    api("PATCH", f"/api/admin/users/{user['id']}", tokens["admin"], body={"role": "OPERATIONS_ADMIN"})


def test_cannot_lock_yourself_out(api, tokens):
    me = api("GET", "/api/auth/me", tokens["admin"])
    api("PATCH", f"/api/admin/users/{me['id']}", tokens["admin"], expect=400,
        body={"is_active": False})
    api("PATCH", f"/api/admin/users/{me['id']}", tokens["admin"], expect=400,
        body={"role": "WAREHOUSE"})
    api("PATCH", f"/api/admin/users/{me['id']}", tokens["admin"], body={"full_name": "Soumalya Mukherjee"})


def test_deactivate_ends_sessions_and_blocks_sign_in(api, tokens, stamp):
    email, user = _new_staff(api, tokens["ops"], stamp, "off")
    token = _login(api, email)["access_token"]
    api("PATCH", f"/api/admin/users/{user['id']}", tokens["ops"], body={"is_active": False})
    api("GET", "/api/auth/me", token, expect=401)
    _login(api, email, expect=401)
    api("PATCH", f"/api/admin/users/{user['id']}", tokens["ops"], body={"is_active": True})
    _login(api, email)


def test_reset_password_and_unlock(api, tokens, stamp):
    email, user = _new_staff(api, tokens["ops"], stamp, "pwreset")
    token = _login(api, email)["access_token"]
    for _ in range(4):
        _login(api, email, "wrong-password", expect=401)
    _login(api, email, "wrong-password", expect=429)

    listed = next(u for u in api("GET", "/api/admin/users", tokens["ops"]) if u["id"] == user["id"])
    assert listed["locked"] is True
    api("POST", f"/api/admin/users/{user['id']}/unlock", tokens["ops"], expect=204)
    _login(api, email)

    api("POST", f"/api/admin/users/{user['id']}/password", tokens["ops"], expect=422,
        body={"new_password": "short"})
    api("POST", f"/api/admin/users/{user['id']}/password", tokens["ops"], expect=204,
        body={"new_password": "brand-new-password"})
    api("GET", "/api/auth/me", token, expect=401)
    _login(api, email, expect=401)
    _login(api, email, "brand-new-password")
    api("POST", "/api/admin/users/usr-none/unlock", tokens["ops"], expect=404)


def test_catalog_edits_ignore_nulls_for_required_fields(api, tokens, stamp):
    product = api("POST", "/api/products", tokens["ops"], expect=201,
                  body={"sku": f"NUL-{stamp}", "name": "Null test", "setpoint_c": -20})
    after = api("PATCH", f"/api/products/{product['id']}", tokens["ops"],
                body={"name": None, "is_active": None, "setpoint_c": None})
    assert after["name"] == "Null test" and after["is_active"] is True
    assert after["setpoint_c"] is None
    api("PATCH", f"/api/products/{product['id']}", tokens["ops"], body={"is_active": False})
    assert product["id"] not in {p["id"] for p in api("GET", "/api/products", tokens["ops"])}
    assert product["id"] in {p["id"] for p in api("GET", "/api/products?active_only=false", tokens["ops"])}


def test_low_stock_alert_fires_once_when_stock_falls_to_the_level(api, tokens, stamp):
    product = api("POST", "/api/products", tokens["ops"], expect=201,
                  body={"sku": f"LOW-{stamp}", "name": "Low test", "reorder_level": 5})
    assert product["reorder_level"] == 5
    move = {"product_id": product["id"], "location_id": "loc-wh-blr", "reason": "NEW_INVENTORY",
            "direction": "INWARD", "quantity": 10, "reference": "t"}
    api("POST", "/api/inventory/movements", tokens["ops"], expect=201, body=move)

    def alerts():
        return [n for n in api("GET", "/api/notifications", tokens["ops"])
                if n["kind"] == "LOW_STOCK" and n["reference_id"] == product["id"]]

    assert alerts() == []
    out = {**move, "direction": "OUTWARD", "reason": "DAMAGED"}
    api("POST", "/api/inventory/movements", tokens["ops"], expect=201, body={**out, "quantity": 3})
    assert alerts() == []  # 7 left: still above the level
    api("POST", "/api/inventory/movements", tokens["ops"], expect=201, body={**out, "quantity": 3})
    assert len(alerts()) == 1  # 4 left: crossed it
    api("POST", "/api/inventory/movements", tokens["ops"], expect=201, body={**out, "quantity": 1})
    assert len(alerts()) == 1  # already low: no second alert

    api("PATCH", f"/api/products/{product['id']}", tokens["ops"], body={"reorder_level": 0})
    api("PATCH", f"/api/products/{product['id']}", tokens["ops"], expect=422, body={"reorder_level": -1})


def test_a_busy_location_cannot_be_switched_off(api, tokens):
    api("PATCH", "/api/stations/loc-fs-blr", tokens["ops"], expect=409, body={"is_active": False})
    empty = api("POST", "/api/stations", tokens["ops"], expect=201,
                body={"code": "EMPTY-1", "name": "Empty", "kind": "WAREHOUSE"})
    off = api("PATCH", f"/api/stations/{empty['id']}", tokens["ops"], body={"is_active": False})
    assert off["is_active"] is False


def test_driver_location_reaches_the_order_page_while_on_the_road(api, tokens):
    mine = [o for o in api("GET", "/api/orders", tokens["driver"]) if o["status"] == "IN_TRANSIT"]
    assert mine, "the demo data has an order in transit for driver1"
    detail = api("GET", f"/api/orders/{mine[0]['id']}/detail", tokens["driver"])
    assert detail["task_id"]
    api("POST", f"/api/deliveries/{detail['task_id']}/gps", tokens["driver"],
        body={"latitude": 12.97, "longitude": 77.59, "accuracy_m": 9})
    for who in ("driver", "ops"):
        after = api("GET", f"/api/orders/{mine[0]['id']}/detail", tokens[who])
        assert after["last_location"]["latitude"] == 12.97
