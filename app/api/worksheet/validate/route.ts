import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-helpers"
import { bufferFromFormData, validateWorksheetBuffer } from "@/lib/worksheet-import"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 })
  if (user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên được nạp file" }, { status: 403 })

  try {
    const formData = await req.formData()
    const { buffer, filename } = await bufferFromFormData(formData)
    const preview = await validateWorksheetBuffer(buffer, filename)
    return NextResponse.json(preview)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Không đọc được file"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
