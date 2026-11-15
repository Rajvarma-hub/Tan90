from conftest import PASSWORD


def _token(api, email):
    return api("POST", "/api/auth/login", body={"email": email, "password": PASSWORD})["access_token"]


def test_unread_count_matches_the_unread_list(api, tokens):
    unread = api("GET", "/api/notifications?unread_only=true", tokens["ops"])
    count = api("GET", "/api/notifications/unread-count", tokens["ops"])["count"]
    assert count == len(unread)
    api("GET", "/api/notifications/unread-count", expect=401)


def test_reading_is_kept_per_person(api, tokens):
    # Two Ops admins share every role-wide notification, but each reads their own copy.
    ops2 = _token(api, "ops2@tan90.local")
    first = api("GET", "/api/notifications?unread_only=true", tokens["ops"])
    assert first, "the demo data has unread Ops notifications"
    target = first[0]["id"]
    assert target in {n["id"] for n in api("GET", "/api/notifications?unread_only=true", ops2)}

    api("POST", f"/api/notifications/{target}/read", tokens["ops"])
    api("POST", f"/api/notifications/{target}/read", tokens["ops"])  # harmless twice
    assert target not in {n["id"] for n in api("GET", "/api/notifications?unread_only=true", tokens["ops"])}
    assert target in {n["id"] for n in api("GET", "/api/notifications?unread_only=true", ops2)}

    read = next(n for n in api("GET", "/api/notifications", tokens["ops"]) if n["id"] == target)
    assert read["read_at"]


def test_cannot_read_someone_elses_notification(api, tokens):
    # A packing-worker notification is not addressed to Ops or to a customer.
    packer = api("GET", "/api/notifications", tokens["packer"])
    assert packer
    api("POST", f"/api/notifications/{packer[0]['id']}/read", tokens["blinkit"], expect=404)
    api("POST", "/api/notifications/ntf-missing/read", tokens["ops"], expect=404)


def test_read_all(api, stamp):
    email = f"inbox{stamp}@tan90.local"
    api("POST", "/api/auth/register", expect=201, body={
        "email": email, "password": PASSWORD, "full_name": "Inbox", "role": "CUSTOMER",
        "customer_name": f"Inbox {stamp}"})
    token = _token(api, email)
    assert api("GET", "/api/notifications", token) == []
    ops = _token(api, "ops@tan90.local")
    result = api("POST", "/api/notifications/read-all", ops)
    assert result["ok"] is True
    assert api("GET", "/api/notifications/unread-count", ops)["count"] == 0
    assert api("GET", "/api/notifications?unread_only=true", ops) == []
