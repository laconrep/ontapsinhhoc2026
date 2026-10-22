import { WorksheetImporter } from "@/components/teacher/worksheet-importer"
import { getClasses } from "@/app/actions/classes"

export const dynamic = "force-dynamic"

export default async function ImportLessonPage({
  searchParams,
}: {
  searchParams: Promise<{ assignToClass?: string }>
}) {
  const sp = await searchParams
  // Ngữ cảnh lớp (đi từ nút tắt "Tạo bài giảng" trong tab Lớp học):
  // lưu xong, các bài vừa nạp được giao luôn cho lớp này. Chỉ nhận lớp
  // thuộc chính GV (getClasses đã lọc theo teacher).
  let assignToClass: { id: string; name: string } | null = null
  if (sp.assignToClass) {
    const classes = await getClasses()
    const found = classes.find((c) => c.id === sp.assignToClass)
    if (found) assignToClass = { id: found.id, name: found.name }
  }
  return <WorksheetImporter assignToClass={assignToClass} />
}
