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
