import { publicEnv } from "@/config/env.public";

export const siteConfig = {
  name: "tan90",
  description: "A full-stack Next.js application.",
  url: publicEnv.NEXT_PUBLIC_APP_URL,
} as const;
