"use server"

import { db } from "@/lib/db"
import {
  classes,
  classStudents,
  chapters,
  lessons,
  knowledgePoints,
  studentProgress,
  user,
} from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { and, asc, eq, inArray } from "drizzle-orm"
import type { ClassStatsDto, StudentStatRow, KPStatRow } from "@/types"

/**
 * Thống kê một lớp học cho giáo viên:
 * - students: mỗi HS với số KP known/unknown/overconfident/mastered + % tiến độ
 * - knowledgePoints: mỗi KP với % HS biết / chủ quan sai / đã củng cố
 *
 * overconfidentCount (FIX-V88-09): selfAssessment='known' AND fillStatus='incorrect'
 * — chỉ số CHẨN ĐOÁN, có thể chồng lấn masteredCount.
 */
export async function getClassStats(classId: string): Promise<ClassStatsDto> {
  const teacher = await requireRole("teacher")

  // Xác thực lớp thuộc giáo viên
  const [cls] = await db
    .select({ id: classes.id, teacherId: classes.teacherId })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacher.id)))
    .limit(1)
  if (!cls) throw new Error("Không tìm thấy lớp học")

  // Danh sách học sinh trong lớp
  const studentRows = await db
    .select({ id: user.id, name: user.name })
    .from(classStudents)
    .innerJoin(user, eq(user.id, classStudents.studentId))
    .where(eq(classStudents.classId, classId))
    .orderBy(asc(user.name))
  const studentIds = studentRows.map((s) => s.id)

  // Tất cả KP thuộc giáo viên (qua chapter → lesson ready)
  const kpRows = await db
    .select({
      id: knowledgePoints.id,
      content: knowledgePoints.content,
    })
    .from(knowledgePoints)
    .innerJoin(lessons, eq(lessons.id, knowledgePoints.lessonId))
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .where(and(eq(chapters.teacherId, teacher.id), eq(lessons.status, "ready")))
    .orderBy(asc(knowledgePoints.order))
  const totalKp = kpRows.length

  // Không có HS hoặc KP → trả rỗng
  if (studentIds.length === 0 || totalKp === 0) {
    return {
      students: studentRows.map((s) => ({
        studentId: s.id,
        name: s.name,
        knownCount: 0,
        unknownCount: 0,
        overconfidentCount: 0,
        masteredCount: 0,
        progress: 0,
      })),
      knowledgePoints: kpRows.map((k) => ({
        kpId: k.id,
        content: k.content,
        knownPercent: 0,
        overconfidentPercent: 0,
        reinforcedPercent: 0,
      })),
    }
  }

  // Toàn bộ tiến độ của các HS trong lớp
  const progressRows = await db
    .select({
      studentId: studentProgress.studentId,
      knowledgePointId: studentProgress.knowledgePointId,
      selfAssessment: studentProgress.selfAssessment,
      fillStatus: studentProgress.fillStatus,
      dragStatus: studentProgress.dragStatus,
      overallStatus: studentProgress.overallStatus,
    })
    .from(studentProgress)
    .where(inArray(studentProgress.studentId, studentIds))

  const kpIdSet = new Set(kpRows.map((k) => k.id))

  // Thống kê theo HS
  const students: StudentStatRow[] = studentRows.map((s) => {
    const rows = progressRows.filter((p) => p.studentId === s.id && kpIdSet.has(p.knowledgePointId))
    const knownCount = rows.filter(
      (r) => r.overallStatus === "known" || r.overallStatus === "mastered",
    ).length
    const unknownCount = rows.filter((r) => r.overallStatus === "unknown").length
    const masteredCount = rows.filter((r) => r.overallStatus === "mastered").length
    const overconfidentCount = rows.filter(
      (r) => r.selfAssessment === "known" && r.fillStatus === "incorrect",
    ).length
    const touched = rows.filter((r) => r.overallStatus !== "not_started").length
    return {
      studentId: s.id,
      name: s.name,
      knownCount,
      unknownCount,
      overconfidentCount,
      masteredCount,
      progress: Math.round((touched / totalKp) * 100),
    }
  })

  // Thống kê theo KP
  const numStudents = studentIds.length
  const kpStats: KPStatRow[] = kpRows.map((k) => {
    const rows = progressRows.filter((p) => p.knowledgePointId === k.id)
    const knownCount = rows.filter(
      (r) => r.selfAssessment === "known" || r.overallStatus === "known" || r.overallStatus === "mastered",
    ).length
    const overconfidentCount = rows.filter(
      (r) => r.selfAssessment === "known" && r.fillStatus === "incorrect",
    ).length
    // "reinforced" = từng sai (fill/drag incorrect) nhưng cuối cùng mastered
    const reinforcedCount = rows.filter(
      (r) =>
        r.overallStatus === "mastered" &&
        (r.fillStatus === "incorrect" || r.dragStatus === "incorrect"),
    ).length
    return {
      kpId: k.id,
      content: k.content,
      knownPercent: Math.round((knownCount / numStudents) * 100),
      overconfidentPercent: Math.round((overconfidentCount / numStudents) * 100),
      reinforcedPercent: Math.round((reinforcedCount / numStudents) * 100),
    }
  })

  return { students, knowledgePoints: kpStats }
}
