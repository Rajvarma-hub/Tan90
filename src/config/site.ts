import { publicEnv } from "@/config/env.public";

export const siteConfig = {
  name: "Tan90Thermal Portal",
  shortName: "Tan90thermal",
  tagline: "Cooling Solutions",
  description: "Tan90Thermal operations portal.",
  url: publicEnv.NEXT_PUBLIC_APP_URL,
} as const;
