// Shapes returned by the backend inventory endpoints.

export type StockBalance = {
  id: string;
  quantity: number;
  product_id: string;
  sku: string;
  product_name: string;
  setpoint_c: number | null;
  unit: string;
  location_id: string;
  location_code: string;
  location_name: string;
  location_kind: string;
};

export type StockMovement = {
  id: string;
  direction: "INWARD" | "OUTWARD";
  quantity: number;
  reason: string;
  reference_type: string;
  reference_id: string;
  product_id: string;
  sku: string;
  product_name: string;
  location_id: string;
  location_code: string;
  actor_name: string | null;
  occurred_at: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  setpoint_c: number | null;
  unit: string;
  is_active: boolean;
};

export type Station = {
  id: string;
  code: string;
  name: string;
  kind: "FREEZING_STATION" | "WAREHOUSE";
  address: string | null;
  is_active: boolean;
};

export type StationSummary = Station & {
  stockUnits: number;
  containersAvailable: number;
  containersTotal: number;
  openOrders: number;
};
