const TIME_ZONE = "Asia/Ho_Chi_Minh"

function toDate(input: Date | string | null | undefined): Date | null {
  if (!input) return null
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function formatDateTime(input: Date | string | null | undefined): string {
  const d = toDate(input)
  if (!d) return "—"
  return d.toLocaleString("vi-VN", { timeZone: TIME_ZONE })
}

export function formatDueAt(dueAt: string | null | undefined): string | null {
  const d = toDate(dueAt)
  if (!d) return null
  return d.toLocaleString("vi-VN", { timeZone: TIME_ZONE })
}
