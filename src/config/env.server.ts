import "server-only";
import { z } from "zod";
import { DEFAULT_BACKEND_API_URL } from "@/config/backend-url";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // FastAPI backend (see backend/). Users sign in with their own accounts.
  BACKEND_API_URL: z.url().default(DEFAULT_BACKEND_API_URL),
});

export const env = serverEnvSchema.parse(process.env);
