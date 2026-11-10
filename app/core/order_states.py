"""Order state machine + container state machine."""

class OrderStatus:
    # happy path
    PENDING_OPS_APPROVAL = "PENDING_OPS_APPROVAL"
    APPROVED             = "APPROVED"
    PACKING              = "PACKING"
    PACKED               = "PACKED"
    DISPATCHED           = "DISPATCHED"
    IN_TRANSIT           = "IN_TRANSIT"
    ARRIVED              = "ARRIVED"
    DELIVERED            = "DELIVERED"
    CUSTOMER_CONFIRMED   = "CUSTOMER_CONFIRMED"

    # exceptions
    DISPUTED             = "DISPUTED"
    CANCELLED            = "CANCELLED"

    # returns
    RETURN_REQUESTED     = "RETURN_REQUESTED"
    RETURN_COLLECTED     = "RETURN_COLLECTED"
    RETURN_RECEIVED      = "RETURN_RECEIVED"
    CLOSED               = "CLOSED"

    ALL = {
        PENDING_OPS_APPROVAL, APPROVED, PACKING, PACKED,
        DISPATCHED, IN_TRANSIT, ARRIVED, DELIVERED, CUSTOMER_CONFIRMED,
        DISPUTED, CANCELLED, RETURN_REQUESTED, RETURN_COLLECTED,
        RETURN_RECEIVED, CLOSED,
    }


# allowed order transitions (action → from → to)
ORDER_TRANSITIONS = {
    "approve":      {OrderStatus.PENDING_OPS_APPROVAL: OrderStatus.APPROVED},
    "cancel":       {
        OrderStatus.PENDING_OPS_APPROVAL: OrderStatus.CANCELLED,
        OrderStatus.APPROVED: OrderStatus.CANCELLED,
    },
    "start_packing": {OrderStatus.APPROVED: OrderStatus.PACKING},
    "complete_packing": {OrderStatus.PACKING: OrderStatus.PACKED},
    "dispatch":     {OrderStatus.PACKED: OrderStatus.DISPATCHED},
    "depart":       {OrderStatus.DISPATCHED: OrderStatus.IN_TRANSIT},
    "arrive":       {OrderStatus.IN_TRANSIT: OrderStatus.ARRIVED},
    "deliver":      {OrderStatus.ARRIVED: OrderStatus.DELIVERED},
    "confirm":      {OrderStatus.DELIVERED: OrderStatus.CUSTOMER_CONFIRMED},
    "dispute":      {OrderStatus.DELIVERED: OrderStatus.DISPUTED},
    "request_return": {
        OrderStatus.CUSTOMER_CONFIRMED: OrderStatus.RETURN_REQUESTED,
        OrderStatus.DISPUTED: OrderStatus.RETURN_REQUESTED,
    },
    "collect_return": {OrderStatus.RETURN_REQUESTED: OrderStatus.RETURN_COLLECTED},
    "receive_return": {OrderStatus.RETURN_COLLECTED: OrderStatus.RETURN_RECEIVED},
    "close":        {OrderStatus.RETURN_RECEIVED: OrderStatus.CLOSED},
}


# container statuses (unchanged from earlier work)
CONTAINER_TRANSITIONS = {
    "AVAILABLE":              {"PACKING", "DAMAGED", "QUARANTINED", "MISSING"},
    "PACKING":                {"PACKED", "AVAILABLE"},
    "PACKED":                 {"IN_TRANSIT_TO_CUSTOMER", "AVAILABLE"},
    "IN_TRANSIT_TO_CUSTOMER": {"WITH_CUSTOMER"},
    "WITH_CUSTOMER":          {"RETURN_REQUESTED"},
    "RETURN_REQUESTED":       {"IN_TRANSIT_TO_STATION"},
    "IN_TRANSIT_TO_STATION":  {"UNDER_INSPECTION"},
    "UNDER_INSPECTION":       {"AVAILABLE", "DAMAGED", "QUARANTINED"},
    "DAMAGED":                {"UNDER_INSPECTION", "AVAILABLE"},
    "QUARANTINED":            {"UNDER_INSPECTION", "AVAILABLE"},
    "MISSING":                {"UNDER_INSPECTION", "AVAILABLE"},
}


class InvalidOrderTransition(Exception):
    def __init__(self, action: str, frm: str):
        super().__init__(f"Cannot perform '{action}' from status '{frm}'")
        self.action = action
        self.frm = frm


class InvalidContainerTransition(Exception):
    def __init__(self, frm: str, to: str):
        super().__init__(f"Container: illegal transition {frm} -> {to}")


def check_order_transition(action: str, current: str) -> str:
    rules = ORDER_TRANSITIONS.get(action, {})
    if current not in rules:
        raise InvalidOrderTransition(action, current)
    return rules[current]


def check_container_transition(frm: str, to: str) -> None:
    if to not in CONTAINER_TRANSITIONS.get(frm, set()):
        raise InvalidContainerTransition(frm, to)
