import { z } from "zod"

/**
 * Validate biến môi trường (pattern giữ từ spec: config/env.ts + Zod).
 * Chỉ validate ở phía server. Không import file này vào client component.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL phải là một connection string hợp lệ"),
  // BETTER_AUTH_SECRET cần cho B3 (auth). Cho phép optional ở B1 để preview không vỡ.
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cached: ServerEnv | null = null

export function getServerEnv(): ServerEnv {
  if (cached) return cached
  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")
    throw new Error(`[EduSync] Biến môi trường không hợp lệ:\n${issues}`)
  }
  cached = parsed.data
  return cached
}
