"""Tan90 container catalogue — sourced from tan90thermal.com.

Capacity is derived from the type code. Clients never send capacity
directly, eliminating typo-driven bad data.
"""

# code -> (display name, capacity_litres)
CONTAINER_TYPES: dict[str, tuple[str, float]] = {
    "SHIP-15":  ("15L Shipper Box",           15.0),
    "SHIP-20":  ("20L Shipper Box",           20.0),
    "SHIP-40":  ("40L Shipper Box",           40.0),
    "SHIP-60":  ("60L Shipper Box",           60.0),
    "SHIP-100": ("100L Shipper Box",         100.0),
    "ICE-50":   ("50L Blowmolded Ice Box",    50.0),
    "ICE-100":  ("100L Rotomolded Icebox",   100.0),
    "BAG-20":   ("20L Insulation Bag",        20.0),
}


def resolve(code: str) -> tuple[str, float]:
    """Return (display_name, capacity_litres) for a type code, or raise KeyError."""
    if code not in CONTAINER_TYPES:
        raise KeyError(code)
    return CONTAINER_TYPES[code]
