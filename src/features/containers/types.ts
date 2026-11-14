export type ContainerOrderRef = {
  id: string;
  order_number: string;
  status: string;
  customer_name: string | null;
};

// Shape of the backend container read model (GET /api/containers).
export type Container = {
  id: string;
  container_code: string;
  container_type: string;
  capacity_litres: number;
  status: string;
  current_location_id: string | null;
  current_customer_id: string | null;
  epc: string | null;
  location_code: string | null;
  location_name: string | null;
  customer_name: string | null;
  // The order this container is packed for or out on. Null when it is free stock.
  current_order: ContainerOrderRef | null;
};

export type ContainerDetail = Container & {
  created_at: string;
  orders: (ContainerOrderRef & { created_at: string })[];
  history: {
    id: string;
    from_status: string | null;
    to_status: string;
    reason: string;
    from_location: string | null;
    to_location: string | null;
    order_id: string | null;
    order_number: string | null;
    actor_name: string | null;
    occurred_at: string;
  }[];
};

export type ContainerSummary = {
  total: number;
  by_status: Record<string, number>;
};

export type ContainerType = { code: string; name: string; capacity_litres: number };
