import { pool } from "@/lib/db"

/**
 * SEC-08: rate limit lưu ở DB (bảng rate_limits) thay cho bộ nhớ tiến trình,
 * để giới hạn còn đúng khi app chạy nhiều instance. Cửa sổ cố định (fixed
 * window) theo key: hitRateLimit ghi nhận 1 lần thử và cho biết còn trong
 * hạn mức hay không; peekRateLimit chỉ đọc, không ghi.
 *
 * Thiết kế "fail-open có log": nếu DB lỗi, cho qua (tránh khoá toàn bộ
 * người dùng vì lỗi hạ tầng) nhưng ghi console.error để vận hành biết.
 */

function windowStartFor(now: number, windowMs: number): Date {
  return new Date(Math.floor(now / windowMs) * windowMs)
}

export async function ensureRateLimitsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      "key" text PRIMARY KEY,
      "count" integer NOT NULL DEFAULT 0,
      "windowStart" timestamp NOT NULL DEFAULT now()
    )
  `)
}

let tableReady: Promise<void> | null = null
function ready(): Promise<void> {
  if (!tableReady) {
    tableReady = ensureRateLimitsTable().catch((e) => {
      tableReady = null
      throw e
    })
  }
  return tableReady
}

/** Ghi nhận 1 lần thử vào key; trả true nếu vẫn trong hạn mức (count <= limit). */
export async function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  try {
    await ready()
    const ws = windowStartFor(Date.now(), windowMs)
    const res = await pool.query(
      `INSERT INTO rate_limits ("key", "count", "windowStart")
       VALUES ($1, 1, $2)
       ON CONFLICT ("key") DO UPDATE SET
         "count" = CASE WHEN rate_limits."windowStart" < $2
                        THEN 1 ELSE rate_limits."count" + 1 END,
         "windowStart" = CASE WHEN rate_limits."windowStart" < $2
                        THEN $2 ELSE rate_limits."windowStart" END
       RETURNING "count"`,
      [key, ws],
    )
    return Number(res.rows[0]?.count ?? 1) <= limit
  } catch (e) {
    console.error("hitRateLimit failed (fail-open):", e)
    return true
  }
}

/** Đọc số lần thử hiện tại trong cửa sổ (không ghi thêm). */
export async function peekRateLimit(key: string, windowMs: number): Promise<number> {
  try {
    await ready()
    const ws = windowStartFor(Date.now(), windowMs)
    const res = await pool.query(
      `SELECT "count" FROM rate_limits WHERE "key" = $1 AND "windowStart" >= $2`,
      [key, ws],
    )
    return Number(res.rows[0]?.count ?? 0)
  } catch (e) {
    console.error("peekRateLimit failed (fail-open):", e)
    return 0
  }
}

/** Xoá bộ đếm của key (ví dụ sau khi thao tác thành công). */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await ready()
    await pool.query(`DELETE FROM rate_limits WHERE "key" = $1`, [key])
  } catch (e) {
    console.error("resetRateLimit failed:", e)
  }
}
