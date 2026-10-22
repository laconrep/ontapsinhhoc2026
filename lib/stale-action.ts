// Sau mỗi lần triển khai bản mới, mã định danh Server Action thay
// đổi. Một tab đang mở từ bản cũ (chưa tải lại trang) khi bấm nút gọi
// action sẽ gặp lỗi "Server Action ... was not found on the server".
// Nhận diện đúng lỗi đó -> tự tải lại trang MỘT lần để lấy bản mới,
// thay vì bắt người dùng tự F5. Vẫn lỗi sau khi tải lại thì trả về
// false để hiện thông báo lỗi như thường (không lặp vô hạn).

const FLAG = "edusync:stale-action-reloaded"

export function reloadIfStaleAction(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "")
  if (!/was not found on the server|failed-to-find-server-action/i.test(msg)) return false
  let already = false
  try {
    already = sessionStorage.getItem(FLAG) === "1"
    if (!already) sessionStorage.setItem(FLAG, "1")
  } catch {
    /* ignore */
  }
  if (already) {
    try {
      sessionStorage.removeItem(FLAG)
    } catch {
      /* ignore */
    }
    return false
  }
  window.location.reload()
  return true
}

/** Gọi sau khi một action thành công để lần cập nhật sau được tự tải lại tiếp. */
export function noteActionSuccess(): void {
  try {
    sessionStorage.removeItem(FLAG)
  } catch {
    /* ignore */
  }
}
