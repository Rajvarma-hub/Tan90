"""Container state machine — enforces legal transitions per POC §10."""

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "AVAILABLE":              {"ALLOCATED", "PACKING", "DAMAGED", "QUARANTINED", "MISSING"},
    "ALLOCATED":              {"PACKING", "AVAILABLE"},
    "PACKING":                {"PACKED", "AVAILABLE"},
    "PACKED":                 {"IN_TRANSIT_TO_CUSTOMER", "PACKING", "AVAILABLE"},
    "IN_TRANSIT_TO_CUSTOMER": {"WITH_CUSTOMER"},
    "WITH_CUSTOMER":          {"RETURN_REQUESTED"},
    "RETURN_REQUESTED":       {"IN_TRANSIT_TO_STATION"},
    "IN_TRANSIT_TO_STATION":  {"UNDER_INSPECTION"},
    "UNDER_INSPECTION":       {"AVAILABLE", "DAMAGED", "QUARANTINED"},
    "DAMAGED":                {"UNDER_INSPECTION", "AVAILABLE"},
    "QUARANTINED":            {"UNDER_INSPECTION", "AVAILABLE"},
    "MISSING":                {"UNDER_INSPECTION", "AVAILABLE"},
}


class InvalidTransition(Exception):
    def __init__(self, frm: str, to: str):
        super().__init__(f"Illegal transition: {frm} -> {to}")
        self.frm = frm
        self.to = to


def validate_transition(from_status: str, to_status: str) -> None:
    allowed = ALLOWED_TRANSITIONS.get(from_status, set())
    if to_status not in allowed:
        raise InvalidTransition(from_status, to_status)
