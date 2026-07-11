import type { ApiResponse } from "@/types"

/**
 * Fetch wrapper phía client (thay cho axios instance trong spec).
 * - Tự prefix /api
 * - Gửi cookie (session) kèm request
 * - Chuẩn hoá lỗi + bóc { success, data, error } theo ApiResponse<T>
 */

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown }

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options
  const res = await fetch(`/api${path.startsWith("/") ? path : `/${path}`}`, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let payload: ApiResponse<T> | null = null
  try {
    payload = (await res.json()) as ApiResponse<T>
  } catch {
    // Không có body JSON (ví dụ 204)
  }

  if (!res.ok || (payload && payload.success === false)) {
    const message = payload?.error || payload?.message || `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }

  return (payload?.data ?? (payload as unknown)) as T
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
}
