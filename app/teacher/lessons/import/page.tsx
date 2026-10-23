import { WorksheetImporter } from "@/components/teacher/worksheet-importer"
import { getClasses } from "@/app/actions/classes"
import { getChapterOptions, getLessonForImport } from "@/app/actions/content"

export const dynamic = "force-dynamic"

export default async function ImportLessonPage({
  searchParams,
}: {
  searchParams: Promise<{ assignToClass?: string; intoLesson?: string }>
}) {
  const sp = await searchParams
  // Ngữ cảnh lớp (đi từ nút tắt "Tạo bài giảng" trong tab Lớp học):
  // khi lưu, GV chọn lưu vào thư viện (giao luôn cho lớp này) hoặc
  // lưu tại lớp. Chỉ nhận lớp thuộc chính GV (getClasses đã lọc).
  let assignToClass: { id: string; name: string } | null = null
  if (sp.assignToClass) {
    const classes = await getClasses()
    const found = classes.find((c) => c.id === sp.assignToClass)
    if (found) assignToClass = { id: found.id, name: found.name }
  }
  // §18: nạp cộng thêm vào một bài có sẵn (nút "Nạp file"/"Đã nạp
  // file" trên thẻ bài và ở màn hình tạo bài thủ công).
  let intoLesson: { id: string; title: string; chapterTitle: string } | null = null
  if (sp.intoLesson) {
    const found = await getLessonForImport(sp.intoLesson).catch(() => null)
    if (found) {
      intoLesson = { id: found.id, title: found.title, chapterTitle: found.chapterTitle }
    }
  }
  const chapterOptions = await getChapterOptions().catch(
    () => [] as { id: string; title: string }[],
  )
  return (
    <WorksheetImporter
      assignToClass={assignToClass}
      intoLesson={intoLesson}
      chapterOptions={chapterOptions}
    />
  )
}
