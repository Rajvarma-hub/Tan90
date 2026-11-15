import { Card, CardHeader } from "@/components/ui/card";
import { mapLinks } from "@/features/deliveries/location";
import type { OrderDetail } from "@/features/orders/types";

/** Where the vehicle was last seen, for everyone who can see the order. */
export function VehicleLocation({ order }: { order: OrderDetail }) {
  const location = order.last_location;
  if (!location) return null;
  const { embed, open } = mapLinks(location.latitude, location.longitude);
  return (
    <Card>
      <CardHeader
        title="Vehicle location"
        description={`Last seen ${order.location_age ?? "a while"} ago${location.accuracy_m ? `, within about ${Math.round(location.accuracy_m)} m` : ""}.`}
        actions={
          <a
            href={open}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Open in OpenStreetMap
          </a>
        }
      />
      <iframe
        title="Map showing the vehicle's last known position"
        src={embed}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-72 w-full rounded-lg border border-border/60"
      />
    </Card>
  );
}
