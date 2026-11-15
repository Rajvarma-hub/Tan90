def test_stations(api, tokens, stamp):
    assert len(api("GET", "/api/stations", tokens["admin"])) >= 6
    api("GET", "/api/stations?kind=FREEZING_STATION", tokens["admin"])
    api("GET", "/api/stations?kind=BAD", tokens["admin"], expect=400)
    api("GET", "/api/stations/loc-fs-blr", tokens["admin"])
    api("GET", "/api/stations/nope", tokens["admin"], expect=404)

    code = f"FS-T{stamp % 10000}"
    loc = api("POST", "/api/stations", tokens["admin"], expect=201,
              body={"code": code, "name": "Test FS", "kind": "FREEZING_STATION"})
    api("POST", "/api/stations", tokens["blinkit"], expect=403,
        body={"code": "X", "name": "X", "kind": "WAREHOUSE"})
    api("POST", "/api/stations", tokens["admin"], expect=409,
        body={"code": code, "name": "D", "kind": "WAREHOUSE"})
    api("PATCH", f"/api/stations/{loc['id']}", tokens["admin"], body={"name": "Upd"})


def test_station_work_queue_is_scoped(api, tokens):
    api("GET", "/api/stations/loc-fs-blr/work-queue", tokens["fsblr"])
    api("GET", "/api/stations/loc-fs-chn/work-queue", tokens["fsblr"], expect=403)


def test_products(api, tokens, stamp):
    api("GET", "/api/products", tokens["admin"])
    api("GET", "/api/products/prd-pcm-pos5", tokens["admin"])

    sku = f"PCM-T{stamp % 10000}"
    api("POST", "/api/products", tokens["admin"], expect=201,
        body={"sku": sku, "name": "Test", "setpoint_c": -5.0})
    api("POST", "/api/products", tokens["admin"], expect=409,
        body={"sku": sku, "name": "D", "setpoint_c": 0.0})
    api("POST", "/api/products", tokens["blinkit"], expect=403,
        body={"sku": "X", "name": "X", "setpoint_c": 0.0})


def test_container_types(api, tokens):
    assert len(api("GET", "/api/containers/types", tokens["packer"])) == 8
