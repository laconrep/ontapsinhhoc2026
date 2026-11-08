import { eq, sql } from "drizzle-orm"
import { db, ensureSchema } from "@/lib/db"
import { aiJobs } from "@/lib/db/schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// §55: tín hiệu công khai cho hook nhận việc AI — chỉ số lượng việc đang
// chờ + mốc tạo mới nhất, KHÔNG lộ tên file, id GV, id việc hay nội dung.
// Hook thăm dò endpoint này mỗi 5 giây (không cần token); khi tín hiệu
// đổi (có việc mới), hook đánh thức agent, agent mới dùng token Vault để
// hỏi cổng MCP và nhận việc theo luồng cũ. Endpoint chỉ đọc một câu truy
// vấn tổng hợp trên cột status (đã có index), không ghi log, không đếm
// vào lượt dùng. Lỗi DB trả 503 với tín hiệu rỗng để hook im lặng chờ.
export async function GET() {
  try {
    await ensureSchema()
    const [row] = await db
      .select({
        pendingCount: sql<number>`count(*)::int`,
        latestPendingCreatedAt: sql<Date | null>`max(${aiJobs.createdAt})`,
      })
      .from(aiJobs)
      .where(eq(aiJobs.status, "pending"))
    const latest = row?.latestPendingCreatedAt ?? null
    return Response.json({
      pendingCount: row?.pendingCount ?? 0,
      latestPendingCreatedAt:
        latest instanceof Date
          ? latest.toISOString()
          : latest == null
            ? null
            : new Date(latest).toISOString(),
    })
  } catch {
    return Response.json({ pendingCount: 0, latestPendingCreatedAt: null }, { status: 503 })
  }
}
