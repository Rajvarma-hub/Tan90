import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // FastAPI backend (see backend/). The portal signs in as this service user;
  // the defaults are the seeded Ops account, so local dev needs no setup.
  BACKEND_API_URL: z.url().default("http://127.0.0.1:8001"),
  BACKEND_EMAIL: z.string().default("ops@tan90.local"),
  BACKEND_PASSWORD: z.string().default("password123"),
});

export const env = serverEnvSchema.parse(process.env);
