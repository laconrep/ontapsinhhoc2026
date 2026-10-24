import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-helpers"
import {
  createImportDraft,
  deleteImportDraft,
  getImportDraftForTeacher,
  listImportDrafts,
} from "@/lib/import-drafts"
import { safeErrorMessage } from "@/lib/api-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// §21: thẻ đỏ giữ chỗ cho việc nạp file chưa lưu (lớp / tab Bài giảng).
// GET không id -> danh sách: ?classId=<id> (lớp đó) hoặc không tham số
// (đường nạp thường -> nhóm "Chưa lưu" ở tab Bài giảng).
// GET ?id= -> một dòng đầy đủ (để trang nạp mở lại bản xem trước).
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 })
  if (user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên" }, { status: 403 })

  const sp = new URL(req.url).searchParams
  const id = sp.get("id")
  try {
    if (id) {
      const row = await getImportDraftForTeacher(user.id, id)
      if (!row) return NextResponse.json({ error: "Không tìm thấy việc" }, { status: 404 })
      return NextResponse.json({
        id: row.id,
        kind: row.kind,
        jobId: row.jobId,
        classId: row.classId,
        filename: row.filename,
        sourceText: row.sourceText,
        images: (row.images as string[] | null) ?? [],
        tables: (row.tables as string[] | null) ?? [],
        createdAt: row.createdAt.toISOString(),
        jobStatus: row.jobStatus,
        jobError: row.jobError,
      })
    }
    const drafts = await listImportDrafts(user.id, sp.get("classId"))
    return NextResponse.json({ drafts })
  } catch (e) {
    return NextResponse.json({ error: safeErrorMessage(e, "Không tải được danh sách") }, { status: 400 })
  }
}

// POST: ghi một dòng nháp mới (trang nạp gọi khi bản xem trước đã có).
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 })
  if (user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên được nạp file" }, { status: 403 })

  try {
    const body = (await req.json()) as {
      kind?: string
      jobId?: string | null
      classId?: string | null
      filename?: string
      sourceText?: string | null
      images?: unknown
      tables?: unknown
    }
    if (body.kind !== "ai" && body.kind !== "upload") {
      return NextResponse.json({ error: "Thiếu loại việc" }, { status: 400 })
    }
    if (!body.filename) return NextResponse.json({ error: "Thiếu tên file" }, { status: 400 })
    const id = await createImportDraft({
      teacherId: user.id,
      kind: body.kind,
      jobId: body.jobId ?? null,
      classId: body.classId ?? null,
      filename: body.filename,
      sourceText: body.sourceText ?? null,
      images: body.images ?? null,
      tables: body.tables ?? null,
    })
    return NextResponse.json({ id })
  } catch (e) {
    return NextResponse.json({ error: safeErrorMessage(e, "Không ghi được việc") }, { status: 400 })
  }
}

// DELETE: GV bỏ việc dở -> thẻ đỏ biến mất (việc AI thì consume luôn job).
export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 })
  if (user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên" }, { status: 403 })

  try {
    const body = (await req.json()) as { id?: string }
    if (!body.id) return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 })
    const ok = await deleteImportDraft(user.id, body.id)
    if (!ok) return NextResponse.json({ error: "Không tìm thấy việc" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: safeErrorMessage(e, "Không bỏ được việc") }, { status: 400 })
  }
}
