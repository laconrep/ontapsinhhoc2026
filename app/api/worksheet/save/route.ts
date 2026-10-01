import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-helpers"
import {
  bufferFromFormData,
  parseMediaArray,
  saveWorksheetBuffer,
  saveWorksheetFromText,
} from "@/lib/worksheet-import"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 })
  if (user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên được nạp file" }, { status: 403 })
  if (!user.isOnboarded) return NextResponse.json({ error: "Cần hoàn tất đăng ký" }, { status: 403 })

  try {
    const formData = await req.formData()
    const text = formData.get("text")
    if (typeof text === "string") {
      const rawName = formData.get("filename")
      const filename = typeof rawName === "string" && rawName ? rawName : "draft.txt"
      const images = parseMediaArray(formData.get("images"))
      const tables = parseMediaArray(formData.get("tables"))
      const result = await saveWorksheetFromText(user, text, filename, images, tables)
      return NextResponse.json(result)
    }
    const { buffer, filename } = await bufferFromFormData(formData)
    const result = await saveWorksheetBuffer(user, buffer, filename)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lưu thất bại"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
