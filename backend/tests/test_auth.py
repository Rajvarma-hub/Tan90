from conftest import PASSWORD


def test_login_rejects_wrong_password(api):
    api("POST", "/api/auth/login", expect=401,
        body={"email": "admin@tan90.local", "password": "wrong"})


def test_login_rejects_empty_body(api):
    api("POST", "/api/auth/login", expect=422, body={})


def test_me_requires_token(api, tokens):
    assert api("GET", "/api/auth/me", tokens["admin"])["email"] == "admin@tan90.local"
    api("GET", "/api/auth/me", expect=401)


def test_register_rules(api, tokens, stamp):
    email = f"reg{stamp}@tan90.local"
    base = {"email": email, "password": PASSWORD, "full_name": "TC",
            "role": "CUSTOMER", "customer_name": f"Reg {stamp}"}
    api("POST", "/api/auth/register", expect=201, body=base)
    api("POST", "/api/auth/register", expect=409, body=base)
    api("POST", "/api/auth/register", expect=401, body={
        "email": f"bad{stamp}@t.local", "password": PASSWORD,
        "full_name": "X", "role": "DRIVER"})
    api("POST", "/api/auth/register", expect=400, body={
        "email": f"bad2{stamp}@t.local", "password": PASSWORD,
        "full_name": "X", "role": "CUSTOMER"})
    api("POST", "/api/auth/register", expect=422, body={
        **base, "email": f"short{stamp}@t.local", "password": "1234567"})
    api("POST", "/api/auth/register", expect=422, body={
        **base, "email": f"long{stamp}@t.local", "password": "a" * 73})


def test_notifications(api, tokens):
    api("GET", "/api/notifications?unread_only=true", tokens["admin"])
    notes = api("GET", "/api/notifications", tokens["ops"])
    if notes:
        api("POST", f"/api/notifications/{notes[0]['id']}/read", tokens["ops"])


def _new_customer(api, stamp, tag):
    email = f"{tag}{stamp}@tan90.local"
    api("POST", "/api/auth/register", expect=201, body={
        "email": email, "password": PASSWORD, "full_name": "Sec Test",
        "role": "CUSTOMER", "customer_name": f"Sec {tag} {stamp}"})
    return email


def _login(api, email, password=PASSWORD, expect=200):
    return api("POST", "/api/auth/login", expect=expect,
               body={"email": email, "password": password})


def test_account_locks_after_repeated_wrong_passwords(api, stamp):
    email = _new_customer(api, stamp, "lock")
    for _ in range(4):
        _login(api, email, "wrong-password", expect=401)
    # The fifth wrong password triggers the lock.
    _login(api, email, "wrong-password", expect=429)
    # Locked now: even the right password is refused.
    _login(api, email, expect=429)


def test_success_resets_failure_count(api, stamp):
    email = _new_customer(api, stamp, "reset")
    for _ in range(4):
        _login(api, email, "wrong-password", expect=401)
    _login(api, email)
    for _ in range(4):
        _login(api, email, "wrong-password", expect=401)
    _login(api, email)  # still not locked: the earlier four were cleared


def test_logout_revokes_the_token(api, stamp):
    email = _new_customer(api, stamp, "out")
    token = _login(api, email)["access_token"]
    api("GET", "/api/auth/me", token)
    api("POST", "/api/auth/logout", token, expect=204)
    api("GET", "/api/auth/me", token, expect=401)
    api("GET", "/api/auth/me", _login(api, email)["access_token"])


def test_refresh_gives_a_working_token(api, tokens):
    fresh = api("POST", "/api/auth/refresh", tokens["ops"])["access_token"]
    assert api("GET", "/api/auth/me", fresh)["email"] == "ops@tan90.local"
    api("POST", "/api/auth/refresh", expect=401)


def test_change_password(api, stamp):
    email = _new_customer(api, stamp, "pw")
    old = _login(api, email)["access_token"]
    body = {"current_password": "nope-nope", "new_password": "a-new-password"}
    api("POST", "/api/auth/change-password", old, expect=400, body=body)
    api("POST", "/api/auth/change-password", old, expect=422,
        body={"current_password": PASSWORD, "new_password": "short"})

    body["current_password"] = PASSWORD
    new = api("POST", "/api/auth/change-password", old, body=body)["access_token"]
    api("GET", "/api/auth/me", old, expect=401)  # the old session ended
    api("GET", "/api/auth/me", new)
    _login(api, email, expect=401)
    _login(api, email, "a-new-password")


def test_only_admins_can_join_an_existing_customer(api, tokens, stamp):
    body = {"email": f"join{stamp}@tan90.local", "password": PASSWORD, "full_name": "J",
            "role": "CUSTOMER", "customer_id": "cust-hyperpure"}
    api("POST", "/api/auth/register", expect=403, body=body)
    api("POST", "/api/auth/register", tokens["ops"], expect=201, body=body)


def test_email_is_case_insensitive(api, stamp):
    email = _new_customer(api, stamp, "case")
    _login(api, email.upper())
