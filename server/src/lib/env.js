import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().default("file:./dev.db"),
  AI_PROVIDER: z
    .string()
    .default("openai")
    .transform((v) => v.trim().toLowerCase()),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-20250514"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Express "trust proxy": "false" (default), a hop count, or a string such as "loopback" or a CIDR list.
  TRUST_PROXY: z
    .string()
    .default("false")
    .transform((v) => {
      const t = v.trim();
      if (t === "" || t.toLowerCase() === "false") return false;
      if (t.toLowerCase() === "true") return true;
      return /^\d+$/.test(t) ? Number(t) : t;
    }),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Empty strings from .env count as unset.
const e = parsed.data;
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = e.DATABASE_URL;

export const env = {
  ...e,
  OPENAI_API_KEY: e.OPENAI_API_KEY.trim(),
  ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY.trim(),
  OPENAI_MODEL: e.OPENAI_MODEL.trim() || "gpt-4o-mini",
  ANTHROPIC_MODEL: e.ANTHROPIC_MODEL.trim() || "claude-sonnet-4-20250514",
};
