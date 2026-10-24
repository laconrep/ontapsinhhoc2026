import { and, desc, eq, isNull } from "drizzle-orm"
import { db, ensureSchema } from "@/lib/db"
import { aiJobs, classes, importDrafts } from "@/lib/db/schema"

export type ImportDraftDto = {
  id: string
  kind: "ai" | "upload"
  jobId: string | null
  classId: string | null
  filename: string
  createdAt: string
  jobStatus: string | null
  jobProgress: number | null
  jobError: string | null
}

/** §21: GV có sở hữu lớp này không (để gắn / xem thẻ đỏ giữ chỗ). */
export async function teacherOwnsClass(teacherId: string, classId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
    .limit(1)
  return !!row
}

/**
 * §21: tạo thẻ đỏ giữ chỗ cho một phiên nạp chưa lưu. Nạp thường cùng
 * (GV, lớp, tên file) thì thay thế dòng cũ — tránh nhân đôi thẻ khi GV
 * nạp lại cùng file; việc AI thì mỗi job một dòng (giống panel §17).
 */
export async function createImportDraft(input: {
  teacherId: string
  kind: "ai" | "upload"
  jobId?: string | null
  classId?: string | null
  filename: string
  sourceText?: string | null
  images?: unknown
  tables?: unknown
}): Promise<string> {
  await ensureSchema()
  if (input.classId && !(await teacherOwnsClass(input.teacherId, input.classId))) {
    throw new Error("Không tìm thấy lớp")
  }
  if (input.kind === "ai" && input.jobId) {
    const [job] = await db
      .select({ id: aiJobs.id })
      .from(aiJobs)
      .where(and(eq(aiJobs.id, input.jobId), eq(aiJobs.teacherId, input.teacherId)))
      .limit(1)
    if (!job) throw new Error("Không tìm thấy việc AI")
  }
  if (input.kind === "upload") {
    // Nạp lại cùng file -> dòng cũ không còn ý nghĩa, thay bằng dòng mới.
    await db.delete(importDrafts).where(
      and(
        eq(importDrafts.teacherId, input.teacherId),
        eq(importDrafts.kind, "upload"),
        eq(importDrafts.filename, input.filename),
        input.classId ? eq(importDrafts.classId, input.classId) : isNull(importDrafts.classId),
      ),
    )
  }
  const [row] = await db
    .insert(importDrafts)
    .values({
      teacherId: input.teacherId,
      classId: input.classId ?? null,
      kind: input.kind,
      jobId: input.jobId ?? null,
      filename: input.filename,
      sourceText: input.sourceText ?? null,
      images: (input.images as never) ?? null,
      tables: (input.tables as never) ?? null,
    })
    .returning({ id: importDrafts.id })
  return row.id
}

/** §21: một dòng nháp của chính GV (kèm trạng thái job AI nếu có). */
export async function getImportDraftForTeacher(
  teacherId: string,
  draftId: string,
): Promise<(typeof importDrafts.$inferSelect & { jobStatus: string | null; jobError: string | null }) | null> {
  await ensureSchema()
  const [row] = await db
    .select()
    .from(importDrafts)
    .where(and(eq(importDrafts.id, draftId), eq(importDrafts.teacherId, teacherId)))
    .limit(1)
  if (!row) return null
  let jobStatus: string | null = null
  let jobError: string | null = null
  if (row.jobId) {
    const [job] = await db
      .select({ status: aiJobs.status, error: aiJobs.error })
      .from(aiJobs)
      .where(and(eq(aiJobs.id, row.jobId), eq(aiJobs.teacherId, teacherId)))
      .limit(1)
    jobStatus = job?.status ?? null
    jobError = job?.error ?? null
  }
  return { ...row, jobStatus, jobError }
}

/**
 * §21: danh sách thẻ đỏ giữ chỗ. classId = null -> việc bắt đầu từ
 * đường nạp thường (nhóm "Chưa lưu" ở tab Bài giảng); classId có giá
 * trị -> việc bắt đầu từ tab Lớp đó (chỉ khi GV sở hữu lớp).
 */
export async function listImportDrafts(
  teacherId: string,
  classId: string | null,
): Promise<ImportDraftDto[]> {
  await ensureSchema()
  if (classId && !(await teacherOwnsClass(teacherId, classId))) return []
  const rows = await db
    .select()
    .from(importDrafts)
    .where(
      and(
        eq(importDrafts.teacherId, teacherId),
        classId ? eq(importDrafts.classId, classId) : isNull(importDrafts.classId),
      ),
    )
    .orderBy(desc(importDrafts.createdAt))
  const out: ImportDraftDto[] = []
  for (const row of rows) {
    let jobStatus: string | null = null
    let jobProgress: number | null = null
    let jobError: string | null = null
    if (row.jobId) {
      const [job] = await db
        .select({ status: aiJobs.status, progress: aiJobs.progress, error: aiJobs.error })
        .from(aiJobs)
        .where(and(eq(aiJobs.id, row.jobId), eq(aiJobs.teacherId, teacherId)))
        .limit(1)
      jobStatus = job?.status ?? null
      jobProgress = job?.progress ?? null
      jobError = job?.error ?? null
    }
    out.push({
      id: row.id,
      kind: row.kind as "ai" | "upload",
      jobId: row.jobId,
      classId: row.classId,
      filename: row.filename,
      createdAt: row.createdAt.toISOString(),
      jobStatus,
      jobProgress,
      jobError,
    })
  }
  return out
}

/** §21: xoá một dòng nháp của chính GV. Việc AI thì đồng thời consume job. */
export async function deleteImportDraft(teacherId: string, draftId: string): Promise<boolean> {
  await ensureSchema()
  const [row] = await db
    .select({ jobId: importDrafts.jobId })
    .from(importDrafts)
    .where(and(eq(importDrafts.id, draftId), eq(importDrafts.teacherId, teacherId)))
    .limit(1)
  if (!row) return false
  if (row.jobId) {
    await db
      .update(aiJobs)
      .set({ consumedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(aiJobs.id, row.jobId), eq(aiJobs.teacherId, teacherId), isNull(aiJobs.consumedAt)))
  }
  await db.delete(importDrafts).where(eq(importDrafts.id, draftId))
  return true
}

/** §21: dọn thẻ đỏ sau khi lưu thành công — theo draftId và/hoặc jobId. */
export async function clearImportDrafts(
  teacherId: string,
  draftId?: string,
  aiJobId?: string,
): Promise<void> {
  await ensureSchema()
  try {
    if (draftId) {
      await db
        .delete(importDrafts)
        .where(and(eq(importDrafts.id, draftId), eq(importDrafts.teacherId, teacherId)))
    }
    if (aiJobId) {
      await db
        .delete(importDrafts)
        .where(and(eq(importDrafts.jobId, aiJobId), eq(importDrafts.teacherId, teacherId)))
    }
  } catch {
    // Dọn thẻ đỏ là việc phụ sau khi đã lưu — lỗi ở đây không được làm
    // hỏng kết quả lưu bài của GV.
  }
}
