import { timingSafeEqual } from "node:crypto"
import {
  claimJob,
  failJob,
  getJobForWorker,
  listPendingJobs,
  logAi,
  reportDetection,
  setJobProgress,
  submitJobResult,
  submitTextResult,
} from "@/lib/ai/jobs"
import type { AiResult } from "@/lib/ai/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// AI-MCP (§15.5): cổng MCP (JSON-RPC qua HTTP) cho worker Muse.
//
// Bảo mật: Bearer token trong env AI_WORKER_TOKEN (fail-closed như
// TEACHER_INVITE_CODE: chưa đặt hoặc < 8 ký tự thì cổng đóng). Định
// danh worker qua header X-Worker-Id (mặc định "muse-main") — nền cho
// farm nhiều Muse sau này. Đây KHÔNG phải API cho client thường: mọi
// thao tác đều qua các hàm nghiệp vụ trong lib/ai/jobs.ts.

interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

function rpcResult(id: string | number | null, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result })
}
function rpcError(id: string | number | null, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } })
}

function tokenOk(req: Request): boolean {
  const expected = process.env.AI_WORKER_TOKEN ?? ""
  if (expected.length < 8) return false
  const header = req.headers.get("authorization") ?? ""
  const given = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function workerIdOf(req: Request): string {
  const raw = req.headers.get("x-worker-id") ?? "muse-main"
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)
  return clean || "muse-main"
}

const TOOLS = [
  {
    name: "list_pending_jobs",
    description: "Liệt kê các việc AI đang chờ xử lý (tài liệu GV vừa nạp bằng chế độ AI).",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "claim_job",
    description: "Nhận một việc để xử lý (nguyên tử — một việc chỉ một worker nhận được).",
    inputSchema: {
      type: "object",
      properties: { jobId: { type: "string" } },
      required: ["jobId"],
    },
  },
  {
    name: "get_job",
    description: "Đọc chi tiết việc: văn bản gốc đã trích, cờ giải chi tiết, lỗi sửa của vòng trước.",
    inputSchema: {
      type: "object",
      properties: { jobId: { type: "string" } },
      required: ["jobId"],
    },
  },
  {
    name: "report_detection",
    description:
      "Sau khi quét tài liệu: báo tài liệu CÓ (true) hay KHÔNG (false) phần giải chi tiết tách riêng.",
    inputSchema: {
      type: "object",
      properties: { jobId: { type: "string" }, hasSolutions: { type: "boolean" } },
      required: ["jobId", "hasSolutions"],
    },
  },
  {
    name: "set_progress",
    description: "Cập nhật tiến độ 0-100 (%) và nhãn giai đoạn hiển thị cho giáo viên.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        progress: { type: "number" },
        stage: { type: "string" },
      },
      required: ["jobId", "progress"],
    },
  },
  {
    name: "submit_result",
    description:
      "Nộp kết quả xử lý dạng JSON có cấu trúc (chương/bài/KP/câu hỏi/gạch chân/lời giải). App tự dựng form worksheet, kiểm tra và đối chiếu giữ nguyên; sai sẽ trả repairErrors để sửa lại.",
    inputSchema: {
      type: "object",
      properties: { jobId: { type: "string" }, result: { type: "object" } },
      required: ["jobId", "result"],
    },
  },
  {
    name: "submit_text_result",
    description:
      "Nộp kết quả dạng văn bản cho việc thống kê (bản tin lớp #1, hỏi đáp #11). Chỉ dùng cho việc có kind stats_newsletter/stats_qa (xem resultMeta.kind trong get_job); việc nhập bài dùng submit_result.",
    inputSchema: {
      type: "object",
      properties: { jobId: { type: "string" }, text: { type: "string" } },
      required: ["jobId", "text"],
    },
  },
  {
    name: "fail_job",
    description: "Báo việc không xử lý được, kèm lý do hiển thị cho giáo viên.",
    inputSchema: {
      type: "object",
      properties: { jobId: { type: "string" }, reason: { type: "string" } },
      required: ["jobId", "reason"],
    },
  },
  {
    name: "get_textbook_excerpt",
    description:
      "Lấy đoạn sách giáo khoa liên quan (kho tham chiếu). Hiện chưa có sách được nạp — trả về rỗng.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
] as const

function toolText(payload: unknown, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    ...(isError ? { isError: true } : {}),
  }
}

async function callTool(name: string, args: Record<string, unknown>, workerId: string) {
  const jobId = typeof args.jobId === "string" ? args.jobId : ""
  switch (name) {
    case "list_pending_jobs": {
      const jobs = await listPendingJobs(workerId, typeof args.limit === "number" ? args.limit : 20)
      return toolText({ jobs })
    }
    case "claim_job": {
      const job = await claimJob(jobId, workerId)
      if (!job) return toolText({ ok: false, error: "Việc không còn chờ (đã có worker khác nhận hoặc sai id)" }, true)
      return toolText({
        ok: true,
        job: {
          id: job.id,
          filename: job.filename,
          status: job.status,
          hasSolutions: job.hasSolutions,
          wantSolutions: job.wantSolutions,
          repairRound: job.repairRound,
        },
      })
    }
    case "get_job": {
      const job = await getJobForWorker(jobId)
      if (!job) return toolText({ ok: false, error: "Không tìm thấy việc" }, true)
      return toolText({
        ok: true,
        job: {
          id: job.id,
          filename: job.filename,
          teacherId: job.teacherId,
          status: job.status,
          // Việc thống kê mang kind trong resultMeta (stats_newsletter/stats_qa);
          // việc nhập bài không có kind (null).
          kind: (job.resultMeta as { kind?: string } | null)?.kind ?? null,
          sourceText: job.sourceText,
          hasSolutions: job.hasSolutions,
          wantSolutions: job.wantSolutions,
          repairRound: job.repairRound,
          lastErrors: job.lastErrors,
        },
      })
    }
    case "report_detection": {
      const res = await reportDetection(jobId, workerId, args.hasSolutions === true)
      return toolText(res, !res.ok)
    }
    case "set_progress": {
      const res = await setJobProgress(
        jobId,
        workerId,
        typeof args.progress === "number" ? args.progress : 0,
        typeof args.stage === "string" ? args.stage : undefined,
      )
      return toolText(res, !res.ok)
    }
    case "submit_result": {
      const res = await submitJobResult(jobId, workerId, (args.result ?? {}) as AiResult)
      return toolText(res, !res.ok && !res.repairErrors)
    }
    case "submit_text_result": {
      const res = await submitTextResult(jobId, workerId, typeof args.text === "string" ? args.text : "")
      return toolText(res, !res.ok)
    }
    case "fail_job": {
      const res = await failJob(jobId, workerId, typeof args.reason === "string" ? args.reason : "Không rõ lý do")
      return toolText(res, !res.ok)
    }
    case "get_textbook_excerpt": {
      // §15.2 chốt 6: sách là tham chiếu cắm sau — chưa có kho sách.
      return toolText({ ok: true, excerpts: [], note: "Chưa có sách giáo khoa trong hệ thống" })
    }
    default:
      return toolText({ ok: false, error: `Tool không tồn tại: ${name}` }, true)
  }
}

export async function POST(req: Request) {
  if (!tokenOk(req)) {
    return Response.json({ error: "Cổng MCP chưa mở hoặc sai khóa" }, { status: 503 })
  }
  const workerId = workerIdOf(req)

  let body: JsonRpcRequest
  try {
    body = (await req.json()) as JsonRpcRequest
  } catch {
    return rpcError(null, -32700, "Parse error")
  }
  const id = body.id ?? null
  const isNotification = body.id === undefined

  switch (body.method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "ontapsinhhoc-ai-worker", version: "1.0.0" },
      })
    case "ping":
      return rpcResult(id, {})
    case "tools/list":
      return rpcResult(id, { tools: TOOLS })
    case "tools/call": {
      const params = (body.params ?? {}) as { name?: string; arguments?: Record<string, unknown> }
      const name = params.name ?? ""
      const args = params.arguments ?? {}
      await logAi({ workerId, action: `mcp:${name}`, jobId: typeof args.jobId === "string" ? args.jobId : null })
      const result = await callTool(name, args, workerId)
      return rpcResult(id, result)
    }
    default:
      if (isNotification) return new Response(null, { status: 202 })
      return rpcError(id, -32601, `Method not found: ${body.method ?? ""}`)
  }
}

export async function GET() {
  return Response.json({ error: "MCP endpoint chỉ nhận POST JSON-RPC" }, { status: 405 })
}
