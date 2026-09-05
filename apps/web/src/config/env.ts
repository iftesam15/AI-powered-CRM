import { z } from "zod";

/**
 * Public env is validated once at module load so a misconfigured deploy fails
 * loudly at startup instead of at the first fetch.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time, so each variable
 * must be referenced by its full literal name below.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Logistic One CRM"),
  NEXT_PUBLIC_USE_MOCK_API: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_USE_MOCK_API: process.env.NEXT_PUBLIC_USE_MOCK_API,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid public environment configuration.\n${issues}\n\nCopy .env.example to .env.local and fill in the values.`,
  );
}

export const env = parsed.data;
