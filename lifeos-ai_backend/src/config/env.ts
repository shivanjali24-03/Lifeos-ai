import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  DIRECT_URL: z.string().url().startsWith("postgresql://"),
  CORS_ORIGIN: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must contain at least 32 characters."),
  JWT_EXPIRES_IN: z.string().default("15m"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed. Check your backend .env file.");
}

export const env = parsed.data;
