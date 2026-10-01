import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

/**
 * Một pg Pool duy nhất, dùng chung cho Drizzle (và sau này cho Better Auth ở B3).
 * Đây là lớp truy cập DB tập trung — khi port sang stack Docker chỉ cần đổi file này.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema })

let schemaReady: Promise<void> | null = null

/** Cot bodyHtml them o phien 2, repo khong co migrate — dam bao DB that co cot. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool
      .query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS "bodyHtml" text`)
      .then(() => pool.query(`ALTER TABLE question_options ADD COLUMN IF NOT EXISTS "bodyHtml" text`))
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null
        throw e
      })
  }
  return schemaReady
}
