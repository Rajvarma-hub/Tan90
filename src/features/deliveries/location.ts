import { z } from "zod";

export const recordLocationSchema = z.object({
  taskId: z.string().min(1).max(64),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100_000).nullable(),
});

/** Link and embed address for a spot on OpenStreetMap. The window is about a kilometre wide. */
export function mapLinks(latitude: number, longitude: number) {
  const span = 0.006;
  const bbox = [longitude - span, latitude - span, longitude + span, latitude + span]
    .map((value) => value.toFixed(5))
    .join(",");
  const point = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  return {
    embed: `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(point)}`,
    open: `https://www.openstreetmap.org/?mlat=${latitude.toFixed(5)}&mlon=${longitude.toFixed(5)}#map=16/${latitude.toFixed(5)}/${longitude.toFixed(5)}`,
  };
}
