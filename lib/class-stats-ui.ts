import type { StudentAssignmentStatus } from "@/lib/assignment-status"
import { formatDateTime } from "@/lib/format-date"

export const STATUS_LABEL: Record<StudentAssignmentStatus, string> = {
  not_started: "Chưa làm",
  in_progress: "Đang làm",
  completed: "Hoàn thành",
  overdue: "Quá hạn",
}

export function studentStatusLabel(status?: StudentAssignmentStatus | null): string {
  if (!status) return "Chưa làm"
  return STATUS_LABEL[status]
}

export function atRiskRowClass(atRisk?: boolean): string {
  return atRisk ? "bg-destructive/10" : ""
}

export function formatActivityAt(iso?: string | null): string {
  return formatDateTime(iso)
}
