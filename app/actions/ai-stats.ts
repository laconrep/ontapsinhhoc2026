"use server"

import { db, ensureSchema } from "@/lib/db"
import { aiJobs, classes } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { and, desc, eq, sql } from "drizzle-orm"
import { getLessonStats } from "@/app/actions/lesson-stats"
import { anonymizeLessonStats } from "@/lib/ai/anonymize"
import { logAi } from "@/lib/ai/jobs"

// Trợ lý AI cho thống kê lớp (#1 bản tin, #11 hỏi đáp) — kiến trúc (b) chốt 28/10:
// KHÔNG tách builder getLessonStats sang module mới, KHÔNG thêm tool MCP đọc thống kê.
// Số liệu được tính bằng action sẵn có + ẩn danh, rồi GẮN VÀO việc AI (sourceText);
// worker đọc qua get_job sẵn có, nộp văn bản qua submit_text_result.

export type AiStatsJobKind = "newsletter" | "qa"

export interface AiStatsJobRow {
  id: string
  kind: AiStatsJobKind | "unknown"
  question: string | null
  status: string
  progress: number
  stage: string | null
  error: string | null
  createdAt: string
  resultText: string | null
}

async function assertTeacherClass(classId: string) {
  const teacher = await requireRole("teacher")
  const [cls] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacher.id)))
    .limit(1)
  if (!cls) throw new Error("Không tìm thấy lớp học")
  return teacher
}

export async function createAiStatsJob(
  kind: AiStatsJobKind,
  classId: string,
  lessonId: string,
  question?: string,
): Promise<{ jobId: string }> {
  // getLessonStats tự kiểm tra quyền giáo viên của lớp; bài chưa chọn được thì báo lỗi.
  const stats = await getLessonStats(classId, lessonId)
  if (!stats.lessonId) throw new Error("Lớp chưa có bài nào để thống kê")
  if (kind === "qa" && !question?.trim()) throw new Error("Chưa nhập câu hỏi")
  const teacher = await requireRole("teacher")
  const anon = anonymizeLessonStats(stats)
  const statsKind = kind === "newsletter" ? "stats_newsletter" : "stats_qa"
  const filename =
    kind === "newsletter" ? `Bản tin lớp: ${stats.lessonTitle ?? "Bài học"}` : `Hỏi đáp: ${question!.trim().slice(0, 40)}`
  const payload = {
    kind: statsKind,
    classId,
    lessonId: stats.lessonId,
    question: kind === "qa" ? question!.trim() : null,
    stats: anon,
  }
  await ensureSchema()
  const [row] = await db
    .insert(aiJobs)
    .values({
      teacherId: teacher.id,
      filename,
      sourceText: JSON.stringify(payload),
      resultMeta: { kind: statsKind, classId, lessonId: stats.lessonId, question: payload.question },
      hasSolutions: false,
      wantSolutions: false,
      status: "pending",
    })
    .returning({ id: aiJobs.id })
  await logAi({ teacherId: teacher.id, jobId: row.id, action: "stats_job_created", detail: { kind: statsKind, lessonId: stats.lessonId } })
  return { jobId: row.id }
}

export async function listAiStatsJobs(classId: string, lessonId: string): Promise<AiStatsJobRow[]> {
  const teacher = await assertTeacherClass(classId)
  const rows = await db
    .select({
      id: aiJobs.id,
      resultMeta: aiJobs.resultMeta,
      status: aiJobs.status,
      progress: aiJobs.progress,
      stage: aiJobs.stage,
      error: aiJobs.error,
      createdAt: aiJobs.createdAt,
      resultText: aiJobs.resultText,
    })
    .from(aiJobs)
    .where(
      and(
        eq(aiJobs.teacherId, teacher.id),
        sql`COALESCE(${aiJobs.resultMeta}->>'kind', '') IN ('stats_newsletter', 'stats_qa')`,
        sql`${aiJobs.resultMeta}->>'classId' = ${classId}`,
        sql`${aiJobs.resultMeta}->>'lessonId' = ${lessonId}`,
      ),
    )
    .orderBy(desc(aiJobs.createdAt))
    .limit(30)
  return rows.map((r) => {
    const meta = (r.resultMeta as { kind?: string; question?: string | null } | null) ?? {}
    return {
      id: r.id,
      kind: meta.kind === "stats_newsletter" ? "newsletter" : meta.kind === "stats_qa" ? "qa" : "unknown",
      question: meta.question ?? null,
      status: r.status,
      progress: r.progress,
      stage: r.stage,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
      resultText: r.resultText,
    }
  })
}
