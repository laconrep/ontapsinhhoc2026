// Event bus in-memory cho phiên học realtime (thay cho Socket.io + Redis).
// Lưu ý: hoạt động trong 1 tiến trình (dev/preview). Ở môi trường nhiều
// instance cần thay bằng Redis pub/sub hoặc Postgres LISTEN/NOTIFY.

export interface RealtimeEvent {
  id: string
  type: string
  studentId?: string | null
  studentName?: string | null
  questionId?: string | null
  payload?: Record<string, unknown> | null
  createdAt: string
}

type Subscriber = (event: RealtimeEvent) => void

// Dùng globalThis để giữ trạng thái qua các lần hot-reload trong dev.
const globalForBus = globalThis as unknown as {
  __edusyncBus?: Map<string, Set<Subscriber>>
}

const bus: Map<string, Set<Subscriber>> = globalForBus.__edusyncBus ?? new Map()
if (!globalForBus.__edusyncBus) globalForBus.__edusyncBus = bus

/** Đăng ký nhận sự kiện của một phiên. Trả về hàm hủy đăng ký. */
export function subscribe(sessionId: string, fn: Subscriber): () => void {
  let set = bus.get(sessionId)
  if (!set) {
    set = new Set()
    bus.set(sessionId, set)
  }
  set.add(fn)
  return () => {
    const s = bus.get(sessionId)
    if (!s) return
    s.delete(fn)
    if (s.size === 0) bus.delete(sessionId)
  }
}

/** Phát một sự kiện tới mọi subscriber của phiên. */
export function publish(sessionId: string, event: RealtimeEvent): void {
  const set = bus.get(sessionId)
  if (!set) return
  for (const fn of set) {
    try {
      fn(event)
    } catch {
      // bỏ qua subscriber lỗi
    }
  }
}
