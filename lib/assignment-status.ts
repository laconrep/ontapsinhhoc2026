export type StudentAssignmentStatus = "not_started" | "in_progress" | "completed" | "overdue"

export function deriveStudentAssignmentStatus(input: {
  hasCompletedQuiz: boolean
  hasTab1Submission: boolean
  dueAt: Date | null
  now?: Date
}): StudentAssignmentStatus {
  const now = input.now ?? new Date()
  if (input.hasCompletedQuiz) return "completed"
  if (input.dueAt && input.dueAt.getTime() < now.getTime()) return "overdue"
  if (input.hasTab1Submission) return "in_progress"
  return "not_started"
}

export function assignmentProgressPercent(input: {
  hasTab1Submission: boolean
  hasCompletedQuiz: boolean
}): number {
  if (input.hasCompletedQuiz) return 100
  if (input.hasTab1Submission) return 50
  return 0
}

export function quizCompletedAfterTab1(
  completedAt: Date | null | undefined,
  submittedAt: Date | null | undefined,
): boolean {
  if (!completedAt || !submittedAt) return false
  return completedAt.getTime() > submittedAt.getTime()
}
