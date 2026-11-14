import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // FastAPI backend (see backend/). The portal signs in as this service user.
  // Credentials have no fallback in production; see getCredentials() in server/backend.ts.
  BACKEND_API_URL: z.url().default("http://127.0.0.1:8001"),
  BACKEND_EMAIL: z.string().min(1).optional(),
  BACKEND_PASSWORD: z.string().min(1).optional(),
});

export const env = serverEnvSchema.parse(process.env);
