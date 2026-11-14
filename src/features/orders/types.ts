export type OrderStatus =
  | "PENDING_OPS_APPROVAL"
  | "APPROVED"
  | "PACKING"
  | "PACKED"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "ARRIVED"
  | "DELIVERED"
  | "CUSTOMER_CONFIRMED"
  | "DISPUTED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURN_COLLECTED"
  | "RETURN_RECEIVED"
  | "CLOSED";

// Row shown in the orders table (backend order + resolved names).
export type OrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerId: string;
  customerName: string;
  destination: string | null;
  stationCode: string | null;
  totalQuantity: number;
  itemCount: number;
  expectedDeliveryAt: string | null;
  createdAt: string;
};

export type Option = { id: string; label: string };

export type OrderFormOptions = {
  customers: Option[];
  stations: Option[];
  products: Option[];
};

export type OrderContainer = {
  container_id: string;
  container_code: string;
  container_type: string;
  status: string;
  epc: string | null;
  contents: { sku: string; qty: number }[];
};

type Person = { id: string; full_name: string; email: string };

// Shape of GET /api/orders/{id}/detail.
export type OrderDetail = {
  id: string;
  order_number: string;
  status: OrderStatus;
  destination: string | null;
  expected_delivery_at: string | null;
  created_at: string;
  customer: {
    id: string;
    name: string;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
  } | null;
  station: {
    id: string;
    code: string;
    name: string;
    address: string | null;
  } | null;
  items: {
    id: string;
    product_id: string;
    quantity: number;
    sku: string | null;
    product_name: string;
    setpoint_c: number | null;
  }[];
  packing_session: { id: string; status: string } | null;
  containers: OrderContainer[];
  driver: Person | null;
  vehicle_ref: string | null;
  return_driver: Person | null;
  history: {
    id: string;
    action: string;
    from: string;
    to: string;
    actor_name: string | null;
    notes: string | null;
    occurred_at: string;
  }[];
};

// Lookups the order page needs to offer its next action.
export type OrderActionOptions = {
  stations: Option[];
  drivers: Option[];
  availableContainers: { epc: string; label: string }[];
};
