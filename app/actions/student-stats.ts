"use server"

import { db } from "@/lib/db"
import {
  classStudents,
  classes,
  chapters,
  lessons,
  knowledgePoints,
  studentProgress,
  studentTab1Submissions,
  quizAttempts,
} from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import type { StudentStatsDto, BadgeDto, WeeklyPoint, BadgeType } from "@/types"

/** Chuẩn hoá 1 Date về "YYYY-MM-DD" theo giờ địa phương server. */
function toDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Tính streak (chuỗi ngày học liên tục) từ tập hợp ngày có hoạt động.
 * Quy tắc (FIX-V85): nghỉ 1 ngày vẫn giữ streak, nghỉ >= 2 ngày reset về 0.
 * Streak đếm ngược từ hôm nay (hoặc hôm qua nếu hôm nay chưa học).
 */
function computeStreak(dayKeys: Set<string>): number {
  if (dayKeys.size === 0) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Điểm bắt đầu: hôm nay nếu có hoạt động, nếu không thì hôm qua.
  const cursor = new Date(today)
  if (!dayKeys.has(toDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!dayKeys.has(toDayKey(cursor))) return 0
  }

  let streak = 0
  // Cho phép bỏ lỡ tối đa 1 ngày liên tiếp mà không phá streak.
  let missAllowance = 1
  while (true) {
    if (dayKeys.has(toDayKey(cursor))) {
      streak += 1
      missAllowance = 1
    } else {
      missAllowance -= 1
      if (missAllowance < 0) break
    }
    cursor.setDate(cursor.getDate() - 1)
    // Chặn vòng lặp vô hạn: streak không thể vượt quá 1 năm.
    if (streak > 366) break
  }
  return streak
}

/**
 * Thống kê học tập của học sinh:
 * - streak: nguồn append-only quiz_attempts.completedAt + student_tab1_submissions.submittedAt (FIX-V84-02)
 * - weeklyProgress: activityCount theo ngày trong 7 ngày gần nhất
 * - totalReviewed: số KP đã có tương tác (overallStatus != not_started)
 * - lessonProgress: % known / % mastered theo từng bài
 * - badges: tính động từ dữ liệu tiến độ
 */
export async function getStudentStats(): Promise<StudentStatsDto> {
  const student = await requireRole("student")

  // Nguồn ngày hoạt động (append-only)
  const [quizDates, tab1Dates] = await Promise.all([
    db
      .select({ ts: quizAttempts.completedAt })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.studentId, student.id), isNotNull(quizAttempts.completedAt))),
    db
      .select({ ts: studentTab1Submissions.submittedAt })
      .from(studentTab1Submissions)
      .where(eq(studentTab1Submissions.studentId, student.id)),
  ])

  const allActivity: Date[] = [
    ...quizDates.map((r) => r.ts as Date),
    ...tab1Dates.map((r) => r.ts),
  ].filter(Boolean)

  const dayKeys = new Set(allActivity.map((d) => toDayKey(new Date(d))))
  const streak = computeStreak(dayKeys)

  // Weekly progress: 7 ngày gần nhất (Mon-Sun không cần, chỉ 7 ngày cuối)
  const weeklyProgress: WeeklyPoint[] = []
  const counts = new Map<string, number>()
  for (const d of allActivity) {
    const k = toDayKey(new Date(d))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const cur = new Date()
  cur.setHours(0, 0, 0, 0)
  cur.setDate(cur.getDate() - 6)
  for (let i = 0; i < 7; i++) {
    const k = toDayKey(cur)
    weeklyProgress.push({ date: k, activityCount: counts.get(k) ?? 0 })
    cur.setDate(cur.getDate() + 1)
  }

  // Tiến độ theo KP
  const progressRows = await db
    .select({
      knowledgePointId: studentProgress.knowledgePointId,
      overallStatus: studentProgress.overallStatus,
      lessonId: knowledgePoints.lessonId,
    })
    .from(studentProgress)
    .innerJoin(knowledgePoints, eq(knowledgePoints.id, studentProgress.knowledgePointId))
    .where(eq(studentProgress.studentId, student.id))

  const totalReviewed = progressRows.filter((r) => r.overallStatus !== "not_started").length

  // Danh sách bài học HS được học (để tính % theo tổng KP của bài)
  const teacherRows = await db
    .selectDistinct({ teacherId: classes.teacherId })
    .from(classStudents)
    .innerJoin(classes, eq(classes.id, classStudents.classId))
    .where(eq(classStudents.studentId, student.id))
  const teacherIds = teacherRows.map((t) => t.teacherId)

  const lessonProgress: StudentStatsDto["lessonProgress"] = []
  if (teacherIds.length > 0) {
    const lessonRows = await db
      .select({
        id: lessons.id,
        title: lessons.title,
        kpCount: sql<number>`count(${knowledgePoints.id})`.as("kpCount"),
      })
      .from(lessons)
      .leftJoin(knowledgePoints, eq(knowledgePoints.lessonId, lessons.id))
      .where(and(inArray(lessons.teacherId, teacherIds), eq(lessons.status, "ready")))
      .groupBy(lessons.id)
      .orderBy(asc(lessons.order))

    for (const l of lessonRows) {
      const total = Number(l.kpCount)
      if (total === 0) continue
      const kpForLesson = progressRows.filter((r) => r.lessonId === l.id)
      const knownCount = kpForLesson.filter(
        (r) => r.overallStatus === "known" || r.overallStatus === "mastered",
      ).length
      const masteredCount = kpForLesson.filter((r) => r.overallStatus === "mastered").length
      lessonProgress.push({
        lessonId: l.id,
        title: l.title,
        knownPercent: Math.round((knownCount / total) * 100),
        masteredPercent: Math.round((masteredCount / total) * 100),
      })
    }
  }

  // Badges tính động
  const badges = computeBadges({
    streak,
    lessonsCompleted: lessonProgress.filter((l) => l.masteredPercent === 100).length,
    hasAnyActivity: totalReviewed > 0,
    perfectQuiz: false, // xác định bên dưới
    quizAttempts: quizDates.length,
  })

  // perfect_quiz: có ít nhất 1 quiz đạt điểm tối đa
  const perfectRows = await db
    .select({ score: quizAttempts.score, maxScore: quizAttempts.maxScore })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.studentId, student.id), isNotNull(quizAttempts.completedAt)))
  const hasPerfect = perfectRows.some(
    (r) => r.maxScore != null && r.score != null && r.maxScore > 0 && r.score >= r.maxScore,
  )
  if (hasPerfect && !badges.some((b) => b.type === "perfect_quiz")) {
    badges.push({ id: "perfect_quiz", type: "perfect_quiz", earnedAt: new Date().toISOString() })
  }

  return { streak, totalReviewed, badges, weeklyProgress, lessonProgress }
}

function computeBadges(input: {
  streak: number
  lessonsCompleted: number
  hasAnyActivity: boolean
  perfectQuiz: boolean
  quizAttempts: number
}): BadgeDto[] {
  const badges: BadgeDto[] = []
  const now = new Date().toISOString()
  const add = (type: BadgeType) => badges.push({ id: type, type, earnedAt: now })

  if (input.hasAnyActivity) add("first_lesson")
  if (input.streak >= 3) add("streak_3")
  if (input.streak >= 7) add("streak_7")
  if (input.streak >= 30) add("streak_30")
  if (input.lessonsCompleted >= 1) add("all_mastered_chapter")

  return badges
}
