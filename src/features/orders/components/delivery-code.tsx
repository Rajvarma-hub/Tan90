import Image from "next/image";
import QRCode from "qrcode";
import { Card, CardHeader } from "@/components/ui/card";
import { publicEnv } from "@/config/env.public";
import { getDeliveryCode } from "@/features/orders/service";
import { AppError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";

/** What the driver shows the customer on arrival. Scanning it opens the order with the code filled in. */
export async function DeliveryCode({ orderId }: { orderId: string }) {
  let code: Awaited<ReturnType<typeof getDeliveryCode>>;
  try {
    code = await getDeliveryCode(orderId);
  } catch (error) {
    if (error instanceof AppError) return null;
    throw error;
  }

  const link = `${publicEnv.NEXT_PUBLIC_APP_URL}/orders/${encodeURIComponent(orderId)}?code=${encodeURIComponent(code.token)}`;
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 240, errorCorrectionLevel: "M" });

  return (
    <Card>
      <CardHeader
        title="Delivery code"
        description={
          code.used
            ? "The customer has verified this delivery."
            : `Show this to the customer. It expires ${formatDateTime(code.expires_at)}.`
        }
      />
      <div className="flex flex-wrap items-center gap-6">
        <Image
          src={qr}
          alt="Delivery QR code"
          width={192}
          height={192}
          unoptimized
          className="rounded-lg bg-white p-2"
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Or read this code out</p>
          <p className="mt-1 font-mono text-sm break-all text-card-foreground">{code.token}</p>
        </div>
      </div>
    </Card>
  );
}
