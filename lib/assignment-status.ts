export type StudentAssignmentStatus = "not_started" | "in_progress" | "completed" | "overdue"

export function deriveStudentAssignmentStatus(input: {
  totalKp: number
  touchedKp: number
  hasCompletedQuiz: boolean
  dueAt: Date | null
  now?: Date
}): StudentAssignmentStatus {
  const now = input.now ?? new Date()
  const done = input.hasCompletedQuiz || (input.totalKp > 0 && input.touchedKp >= input.totalKp)
  if (done) return "completed"
  if (input.dueAt && input.dueAt.getTime() < now.getTime()) return "overdue"
  if (input.touchedKp > 0) return "in_progress"
  return "not_started"
}
