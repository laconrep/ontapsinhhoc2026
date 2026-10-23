"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { assignLessons } from "@/app/actions/assignments"
import { applyAiDistractors } from "@/app/actions/worksheet"
import { createChapter, getLessonDedupeSnapshot } from "@/app/actions/content"
import { computeAppendPlan, type AppendPlan } from "@/lib/append-dedupe"
import {
  Download,
  Eye,
  FileText,
  FileUp,
  History,
  Loader2,
  Save,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ImportErrorFix, type RevalidatedPreview } from "@/components/teacher/import-error-fix"
import {
  attachBodyHtml,
  attachOptionBodyHtml,
  parseTextContent,
  summarize,
  validateDocument,
  type ParseResult,
  type ValidationError,
} from "@/lib/worksheet-parser"
import type { AiResultMeta } from "@/lib/ai/types"

interface AiJobStatus {
  id: string
  status: "pending" | "detecting" | "needs_solution_choice" | "processing" | "ready" | "failed"
  progress: number
  stage: string | null
  error: string | null
}

interface AiJobReadyPayload {
  resultText: string
  resultMeta: AiResultMeta | null
  images: string[]
  tables: string[]
}

// §17: một dòng trong danh sách việc AI gần đây của GV (API list chỉ
// trả cột nhẹ; bản dựng đầy đủ tải riêng khi bấm "Mở xem trước").
interface AiJobListItem {
  id: string
  filename: string
  status: AiJobStatus["status"]
  progress: number
  stage: string | null
  error: string | null
  consumedAt: string | null
  createdAt: string
}

interface WorksheetPreview {
  parseResult: ParseResult
  errors: ValidationError[]
  warnings?: ValidationError[]
  isValid: boolean
  summary: { chapters: number; lessons: number; kps: number; questions: number }
  sourceText: string
  images?: string[]
  tables?: string[]
}

interface SaveResult {
  createdLessons: number
  createdKps: number
  createdQuestions: number
  lessonIds: string[]
  /** §18: nạp cộng thêm — số mục thực thêm vào bài đích. */
  appended?: { addedKps: number; addedQuestions: number; skippedQuestions: number }
  duplicateWarnings?: string[]
}

/** §18: đích lưu khi GV nạp bài từ tab Lớp học. */
type SaveFork = { kind: "library"; chapterId: string } | { kind: "class" }

async function postForm<T>(url: string, fd: FormData): Promise<T> {
  const res = await fetch(url, { method: "POST", body: fd })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `Lỗi server (${res.status})`)
  return data
}

async function postWorksheet<T>(url: string, file: File): Promise<T> {
  const fd = new FormData()
  fd.append("file", file)
  return postForm<T>(url, fd)
}

const ACCEPT = ".txt,.docx,.pdf"

export function WorksheetImporter({
  assignToClass,
  intoLesson,
  chapterOptions,
}: {
  assignToClass?: { id: string; name: string } | null
  /** §18: nạp cộng thêm vào bài này thay vì tạo bài mới. */
  intoLesson?: { id: string; title: string; chapterTitle: string } | null
  /** §18: các chương hiện có của GV cho ô chọn chương đích. */
  chapterOptions?: { id: string; title: string }[]
}) {
  const chapters = chapterOptions ?? []
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<WorksheetPreview | null>(null)
  const [draftText, setDraftText] = useState("")
  const [originalSource, setOriginalSource] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [isValidating, startValidate] = useTransition()
  const [isSaving, startSave] = useTransition()
  // --- Chế độ AI (§15) ---
  const [modeOpen, setModeOpen] = useState(false)
  const [aiJob, setAiJob] = useState<AiJobStatus | null>(null)
  const [aiMeta, setAiMeta] = useState<AiResultMeta | null>(null)
  const [previewIsAiResult, setPreviewIsAiResult] = useState(false)
  const [solutionAskOpen, setSolutionAskOpen] = useState(false)
  const [startingAi, setStartingAi] = useState(false)
  // §17: việc AI gần đây của GV — kết quả đã xử lý xong nằm ở máy chủ,
  // đóng tab không mất; mở lại trang là mở lại được bản xem trước.
  const [myAiJobs, setMyAiJobs] = useState<AiJobListItem[]>([])
  const [resumingJobId, setResumingJobId] = useState<string | null>(null)
  const aiReadyHandledRef = useRef<string | null>(null)
  // §16: id job AI của bản xem trước hiện tại — giữ lại sau khi aiJob
  // đã đóng, để gắn từ nhiễu vào bài ngay sau khi lưu.
  const aiJobIdRef = useRef<string | null>(null)
  // --- Đích lưu (§18) ---
  // Ngữ cảnh thường: chương đích ("" = theo chương trong file). Mặc
  // định chọn sẵn chương đầu tiên để file form mới (không ghi chương)
  // không rơi vào "Chương chưa đặt tên".
  const [chapterChoice, setChapterChoice] = useState<string>(() => chapters[0]?.id ?? "")
  const [newChapterName, setNewChapterName] = useState("")
  // Từ tab Lớp: hộp thoại hỏi thư viện / tại lớp.
  const [forkOpen, setForkOpen] = useState(false)
  const [forkKind, setForkKind] = useState<"library" | "class">("library")
  const [forkChapterChoice, setForkChapterChoice] = useState<string>(() => chapters[0]?.id ?? "")
  const [forkNewChapterName, setForkNewChapterName] = useState("")
  // Nạp cộng thêm: kế hoạch chống trùng tính ở bản xem trước.
  const [appendPlan, setAppendPlan] = useState<AppendPlan | null>(null)
  const [appendPlanLoading, setAppendPlanLoading] = useState(false)

  // §18: đối chiếu trùng lặp mỗi khi bản xem trước thay đổi ở chế độ
  // nạp cộng thêm (server tính lại lúc lưu làm kết quả chính thức).
  useEffect(() => {
    if (!intoLesson || !preview) {
      setAppendPlan(null)
      return
    }
    let cancelled = false
    setAppendPlanLoading(true)
    getLessonDedupeSnapshot(intoLesson.id)
      .then((snap) => {
        if (cancelled) return
        const incoming = preview.parseResult.chapters.flatMap((c) =>
          c.lessons.flatMap((l) => l.knowledgePoints),
        )
        setAppendPlan(computeAppendPlan(snap.kps, snap.questions, incoming))
      })
      .catch(() => {
        if (!cancelled) setAppendPlan(null)
      })
      .finally(() => {
        if (!cancelled) setAppendPlanLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [intoLesson, preview])

  function pickFile(f: File | null) {
    if (!f) return
    const ok = /\.(txt|docx|pdf)$/i.test(f.name)
    if (!ok) {
      toast.error("Chỉ chấp nhận file .txt, .docx hoặc .pdf")
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File vượt quá 10MB")
      return
    }
    savedRef.current = false
    setFile(f)
    setPreview(null)
    setDraftText("")
    setOriginalSource("")
    setAiJob(null)
    setAiMeta(null)
    setPreviewIsAiResult(false)
  }

  function reset() {
    savedRef.current = true
    setFile(null)
    setPreview(null)
    setDraftText("")
    setOriginalSource("")
    setAiJob(null)
    setAiMeta(null)
    setPreviewIsAiResult(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  function doValidate() {
    if (!file) return
    startValidate(async () => {
      try {
        const res = await postWorksheet<WorksheetPreview>("/api/worksheet/validate", file)
        setPreview(res)
        setDraftText(res.sourceText)
        setOriginalSource(res.sourceText)
        if (res.isValid) toast.success("Tài liệu hợp lệ, sẵn sàng để lưu")
        else toast.error(`Phát hiện ${res.errors.length} lỗi cần sửa`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không đọc được file")
      }
    })
  }

  // --- Luồng AI (§15): tạo việc -> chờ worker -> bản dựng về làm preview ---
  async function startAiFlow() {
    if (!file || startingAi) return
    setModeOpen(false)
    setStartingAi(true)
    try {
      const res = await postWorksheet<{ jobId: string }>("/api/ai/jobs", file)
      aiJobIdRef.current = res.jobId
      setAiJob({
        id: res.jobId,
        status: "pending",
        progress: 0,
        stage: "Đang chờ AI nhận việc",
        error: null,
      })
      void refreshMyAiJobs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tạo được việc AI")
    } finally {
      setStartingAi(false)
    }
  }

  function applyAiReady(payload: AiJobReadyPayload) {
    const parsed = parseTextContent(payload.resultText)
    const images = payload.images ?? []
    const tables = payload.tables ?? []
    if (images.length > 0 || tables.length > 0) {
      attachBodyHtml(parsed, images, tables)
      attachOptionBodyHtml(parsed, images, tables)
    }
    const validation = validateDocument(parsed)
    setPreview({
      parseResult: parsed,
      errors: validation.errors,
      warnings: validation.warnings,
      isValid: validation.isValid,
      summary: summarize(parsed),
      sourceText: payload.resultText,
      images,
      tables,
    })
    setDraftText(payload.resultText)
    setOriginalSource(payload.resultText)
    setPreviewIsAiResult(true)
    setAiMeta(payload.resultMeta)
    toast.success("AI đã xử lý xong — kiểm tra bản xem trước rồi lưu")
  }

  useEffect(() => {
    if (!aiJob) return
    if (aiJob.status === "ready" || aiJob.status === "failed") return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch(`/api/ai/jobs?id=${aiJob.id}`)
        const data = (await res.json()) as {
          status: AiJobStatus["status"]
          progress: number
          stage: string | null
          error: string | null
          resultText?: string
          resultMeta?: AiResultMeta | null
          images?: string[]
          tables?: string[]
        }
        if (cancelled) return
        if (data.status === "ready" && data.resultText) {
          if (aiReadyHandledRef.current !== aiJob.id) {
            aiReadyHandledRef.current = aiJob.id
            applyAiReady({
              resultText: data.resultText,
              resultMeta: data.resultMeta ?? null,
              images: data.images ?? [],
              tables: data.tables ?? [],
            })
          }
          setAiJob(null)
          return
        }
        setAiJob({
          id: aiJob.id,
          status: data.status,
          progress: data.progress ?? 0,
          stage: data.stage,
          error: data.error,
        })
        if (data.status === "needs_solution_choice") setSolutionAskOpen(true)
      } catch {
        // Mạng chập chờn: giữ nguyên trạng thái, lần poll sau thử lại.
      }
    }
    void tick()
    const t = setInterval(tick, 2500)
    return () => {
      cancelled = true
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiJob?.id, aiJob?.status])

  async function answerSolutions(want: boolean) {
    if (!aiJob) return
    setSolutionAskOpen(false)
    try {
      const res = await fetch("/api/ai/jobs/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: aiJob.id, wantSolutions: want }),
      })
      if (!res.ok) throw new Error("Không ghi được câu trả lời")
      setAiJob({ ...aiJob, status: "pending", stage: "Đang chờ AI xử lý tiếp" })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không ghi được câu trả lời")
      setSolutionAskOpen(true)
    }
  }

  function abandonAiJob() {
    setAiJob(null)
    setSolutionAskOpen(false)
  }

  // --- §17: mở lại việc AI của các phiên trước -------------------------
  async function refreshMyAiJobs() {
    try {
      const res = await fetch("/api/ai/jobs")
      if (!res.ok) return
      const data = (await res.json()) as { jobs?: AiJobListItem[] }
      setMyAiJobs(data.jobs ?? [])
    } catch {
      // Danh sách phụ trợ: lỗi mạng thì bỏ qua, luồng chính không phụ thuộc.
    }
  }

  useEffect(() => {
    void refreshMyAiJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Gắn lại vòng polling cho một việc còn đang chạy dở. */
  function trackJob(item: AiJobListItem) {
    aiJobIdRef.current = item.id
    setAiJob({
      id: item.id,
      status: item.status,
      progress: item.progress ?? 0,
      stage: item.stage,
      error: item.error,
    })
  }

  /** Mở lại bản xem trước của một việc đã xử lý xong nhưng chưa lưu. */
  async function resumeReadyJob(item: AiJobListItem) {
    if (resumingJobId) return
    setResumingJobId(item.id)
    try {
      const res = await fetch(`/api/ai/jobs?id=${item.id}`)
      const data = (await res.json()) as {
        status?: AiJobStatus["status"]
        progress?: number
        stage?: string | null
        error?: string | null
        resultText?: string
        resultMeta?: AiResultMeta | null
        images?: string[]
        tables?: string[]
      }
      if (!res.ok) throw new Error("Không tải được việc")
      if (data.status === "ready" && data.resultText) {
        // Dựng lại "file" từ bản dựng để luồng Lưu chạy như phiên gốc.
        savedRef.current = false
        setFile(new File([data.resultText], item.filename, { type: "text/plain" }))
        aiJobIdRef.current = item.id
        aiReadyHandledRef.current = item.id
        applyAiReady({
          resultText: data.resultText,
          resultMeta: data.resultMeta ?? null,
          images: data.images ?? [],
          tables: data.tables ?? [],
        })
      } else if (data.status) {
        // Trạng thái vừa đổi (vd việc chưa thật xong): theo dõi tiếp.
        trackJob({
          ...item,
          status: data.status,
          progress: data.progress ?? item.progress,
          stage: data.stage ?? item.stage,
          error: data.error ?? item.error,
        })
      }
    } catch {
      toast.error("Không mở lại được bản xem trước — thử tải lại trang")
    } finally {
      setResumingJobId(null)
    }
  }

  /** Ẩn một việc khỏi danh sách chờ (đánh dấu đã xong ở máy chủ). */
  async function dismissJob(item: AiJobListItem) {
    try {
      const res = await fetch("/api/ai/jobs/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: item.id }),
      })
      if (!res.ok) throw new Error("Không ẩn được việc")
      setMyAiJobs((prev) => prev.filter((j) => j.id !== item.id))
    } catch {
      toast.error("Không ẩn được việc — thử lại sau")
    }
  }

  function handleRevalidated(payload: RevalidatedPreview) {
    const wasInvalid = preview && !preview.isValid
    setPreview((prev) => (prev ? { ...prev, ...payload } : prev))
    if (wasInvalid && payload.isValid) toast.success("Hết lỗi, có thể lưu")
  }

  const draftDirty = draftText !== originalSource

  // Popup nhắc khi rời trang mà bài đã nạp/chỉnh sửa CHƯA được lưu (GV
  // quên bấm Lưu rồi thoát tab sẽ mất toàn bộ nội dung đã nạp). Kích
  // hoạt khi đã có bản xem trước mà chưa lưu thành công; tắt sau khi
  // lưu xong hoặc khi GV chủ động bỏ file (reset).
  const savedRef = useRef(false)
  const hasUnsavedWork = preview !== null && !savedRef.current
  useEffect(() => {
    if (!hasUnsavedWork) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    const onClickCapture = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest?.("a")
      if (!anchor) return
      if (anchor.hasAttribute("download") || anchor.target === "_blank") return
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#")) return
      const ok = window.confirm(
        "Bài giảng chưa được lưu vào hệ thống. Rời trang bây giờ sẽ mất nội dung đã nạp. Bạn có chắc muốn rời trang?",
      )
      if (!ok) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClickCapture, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClickCapture, true)
    }
  }, [hasUnsavedWork])

  function doSave() {
    if (!file || !preview?.isValid) return
    // §18: đi từ tab Lớp học -> hỏi trước: lưu vào thư viện hay tại lớp.
    if (assignToClass && !intoLesson) {
      setForkKind("library")
      setForkChapterChoice((prev) => prev || chapters[0]?.id || "")
      setForkOpen(true)
      return
    }
    void proceedSave(null)
  }

  /** §18: xác nhận hộp thoại thư viện/tại lớp rồi mới lưu thật. */
  async function confirmFork() {
    if (!assignToClass) return
    if (forkKind === "class") {
      setForkOpen(false)
      void proceedSave({ kind: "class" })
      return
    }
    let chapterId = forkChapterChoice
    if (chapterId === "__new__") {
      if (!forkNewChapterName.trim()) {
        toast.error("Hãy nhập tên chương mới")
        return
      }
      try {
        const created = await createChapter(forkNewChapterName.trim())
        chapterId = created.id
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không tạo được chương")
        return
      }
    }
    if (!chapterId) {
      toast.error("Hãy chọn chương để lưu vào thư viện")
      return
    }
    setForkOpen(false)
    void proceedSave({ kind: "library", chapterId })
  }

  async function proceedSave(fork: SaveFork | null) {
    if (!file || !preview?.isValid) return
    // §18: ngữ cảnh thường + chọn "tạo chương mới" -> tạo trước lấy id.
    let plainChapterId: string | undefined
    if (!intoLesson && !assignToClass) {
      if (chapterChoice === "__new__") {
        if (!newChapterName.trim()) {
          toast.error("Hãy nhập tên chương mới hoặc chọn một chương khác")
          return
        }
        try {
          plainChapterId = (await createChapter(newChapterName.trim())).id
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Không tạo được chương")
          return
        }
      } else if (chapterChoice) {
        plainChapterId = chapterChoice
      }
    }
    startSave(async () => {
      try {
        const fd = new FormData()
        if (draftDirty || previewIsAiResult) {
          fd.append("text", draftText)
          fd.append("filename", file.name)
          fd.append("images", JSON.stringify(preview.images ?? []))
          fd.append("tables", JSON.stringify(preview.tables ?? []))
        } else {
          fd.append("file", file)
        }
        // §18: đích lưu.
        if (intoLesson) {
          fd.append("intoLessonId", intoLesson.id)
        } else if (fork?.kind === "class" && assignToClass) {
          fd.append("classId", assignToClass.id)
        } else if (fork?.kind === "library") {
          fd.append("targetChapterId", fork.chapterId)
        } else if (plainChapterId) {
          fd.append("targetChapterId", plainChapterId)
        }
        // §18: tên bài do AI đặt -> server ép các bài đó sang nháp.
        if (previewIsAiResult && aiMeta?.draftLessonIndexes?.length) {
          fd.append("draftLessonIndexes", JSON.stringify(aiMeta.draftLessonIndexes))
        }
        const res = await postForm<SaveResult>("/api/worksheet/save", fd)
        savedRef.current = true
        // §16: bản xem trước là kết quả AI -> gắn từ nhiễu kéo thả của
        // job vào các KP vừa tạo (lỗi ở bước này không chặn việc lưu:
        // Tab 3 tự quay về pool mặc định cho KP chưa có từ nhiễu).
        // Nạp cộng thêm thì bỏ qua: vị trí KP đã lệch sau khi gộp.
        if (!intoLesson && previewIsAiResult && aiJobIdRef.current && res.lessonIds?.length) {
          try {
            await applyAiDistractors(aiJobIdRef.current, res.lessonIds)
          } catch {
            toast.warning(
              "Đã lưu bài nhưng chưa gắn được từ nhiễu kéo thả của AI — Tab 3 tạm dùng pool mặc định",
            )
          }
        }
        // §17: đã lưu xong -> đánh dấu việc AI đã dùng, để việc không
        // còn hiện trong danh sách chờ mở lại ở lần vào trang sau.
        if (previewIsAiResult && aiJobIdRef.current) {
          try {
            await fetch("/api/ai/jobs/consume", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jobId: aiJobIdRef.current }),
            })
          } catch {
            // Không chặn luồng lưu: việc còn listed thì GV ẩn tay được.
          }
        }
        if (intoLesson) {
          const a = res.appended
          toast.success(
            a
              ? `Đã nạp thêm vào bài "${intoLesson.title}": +${a.addedKps} điểm kiến thức, +${a.addedQuestions} câu hỏi${
                  a.skippedQuestions > 0 ? `, bỏ qua ${a.skippedQuestions} câu trùng` : ""
                }`
              : "Đã nạp thêm vào bài",
          )
          router.push(`/teacher/lessons/${intoLesson.id}`)
        } else if (fork?.kind === "class" && assignToClass) {
          toast.success(
            `Đã lưu ${res.createdLessons} bài tại lớp ${assignToClass.name} (không vào thư viện)`,
          )
          router.push(`/teacher/classes/${assignToClass.id}?tab=assignments`)
        } else if (assignToClass && res.lessonIds?.length) {
          // Đi từ nút tắt trong tab Lớp học: lưu xong GIAO LUÔN các bài
          // vừa nạp cho lớp đó (bài nạp file đã ở trạng thái ready).
          try {
            const ar = await assignLessons(assignToClass.id, res.lessonIds)
            toast.success(
              `Đã lưu ${res.createdLessons} bài và giao ${ar.assigned} bài cho lớp ${assignToClass.name}`,
            )
          } catch {
            toast.error(
              "Đã lưu bài vào hệ thống nhưng chưa giao được cho lớp — hãy giao thủ công ở tab Lớp học",
            )
          }
          router.push(`/teacher/classes/${assignToClass.id}?tab=assignments`)
        } else {
          const draftCount = preview
            ? preview.parseResult.chapters
                .flatMap((c) => c.lessons)
                .filter((l) => l.titleMissing).length +
              (previewIsAiResult ? (aiMeta?.draftLessonIndexes?.length ?? 0) : 0)
            : 0
          toast.success(
            `Đã lưu: ${res.createdLessons} bài, ${res.createdKps} kiến thức, ${res.createdQuestions} câu hỏi${
              draftCount > 0 ? ` — ${draftCount} bài ở trạng thái Nháp chờ duyệt tên` : ""
            }`,
          )
          router.push("/teacher/lessons")
        }
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lưu thất bại")
      }
    })
  }

  return (
    <div className={preview ? "w-full space-y-4" : "mx-auto max-w-3xl space-y-6"}>
      {assignToClass ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
          Bạn đang tạo bài cho lớp <strong>{assignToClass.name}</strong>. Khi bấm "Lưu vào hệ
          thống", bạn sẽ chọn lưu vào <strong>thư viện</strong> (chọn chương, bài được giao luôn
          cho lớp này) hoặc lưu <strong>tại lớp</strong> (chỉ lớp này có, không vào thư viện).
        </div>
      ) : null}
      {intoLesson ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
          Bạn đang nạp cộng thêm vào bài <strong>{intoLesson.title}</strong> (
          {intoLesson.chapterTitle}). Nội dung file sẽ <strong>cộng dồn</strong> vào bài này;
          điểm kiến thức/câu hỏi trùng với nội dung đã có sẽ <strong>chỉ giữ 1 bản</strong> và
          được cảnh báo ở bản xem trước.
        </div>
      ) : null}
      {preview ? (
        <h1 className="font-heading text-lg font-bold text-foreground">Nạp câu hỏi từ file</h1>
      ) : (
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Nạp câu hỏi từ file</h1>
          <p className="mt-1 text-muted-foreground">
            Tải lên tài liệu .docx, .pdf hoặc .txt được soạn theo cú pháp mẫu. Hệ thống sẽ tự tách
            chương, bài, điểm kiến thức và sinh câu hỏi.
          </p>
        </div>
      )}

      <Card className={preview ? "hidden" : undefined}>
        <CardHeader>
          <CardTitle className="text-base">1. Tải file mẫu và soạn nội dung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <a
              href="/templates/mau-cau-hoi.docx"
              download
              className={buttonVariants({ variant: "outline" })}
            >
              <Download className="h-4 w-4" />
              Mẫu Word (.docx)
            </a>
            <a
              href="/templates/mau-cau-hoi.txt"
              download
              className={buttonVariants({ variant: "outline" })}
            >
              <Download className="h-4 w-4" />
              Mẫu văn bản (.txt)
            </a>
          </div>
        </CardContent>
      </Card>

      <Card size={preview ? "sm" : "default"}>
        {!preview ? (
          <CardHeader>
            <CardTitle className="text-base">2. Chọn file và kiểm tra</CardTitle>
          </CardHeader>
        ) : null}
        <CardContent className={preview ? "py-0" : "space-y-4"}>
          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                pickFile(e.dataTransfer.files?.[0] ?? null)
              }}
              className={`flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <span className="font-medium text-foreground">Kéo thả file vào đây hoặc bấm để chọn</span>
              <span className="text-sm text-muted-foreground">Hỗ trợ .txt, .docx, .pdf — tối đa 10MB</span>
            </button>
          ) : (
            <div className={`flex flex-wrap items-center gap-3 ${preview ? "" : "rounded-lg border bg-card px-4 py-3"}`}>
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset} aria-label="Bỏ file">
                <X className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setModeOpen(true)}
                disabled={!file || isValidating || startingAi || aiJob != null}
                size={preview ? "sm" : "default"}
              >
                {isValidating || startingAi ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                Kiểm tra tài liệu
              </Button>
              <Button
                variant="default"
                onClick={doSave}
                disabled={!preview?.isValid || isSaving}
                className="bg-primary"
                size={preview ? "sm" : "default"}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu vào hệ thống
              </Button>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </CardContent>
      </Card>

      {aiJob ? (
        <Card className="border-primary/40">
          <CardContent className="flex items-center gap-4 pt-4">
            <ProgressRing value={aiJob.status === "failed" ? 100 : aiJob.progress} failed={aiJob.status === "failed"} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">
                {aiJob.status === "failed"
                  ? "AI xử lý không thành công"
                  : aiJob.status === "needs_solution_choice"
                    ? "AI đang chờ bạn trả lời"
                    : "AI đang xử lý tài liệu"}
              </p>
              <p className="text-sm text-muted-foreground">
                {aiJob.status === "failed"
                  ? (aiJob.error ?? "Đã xảy ra lỗi khi AI xử lý")
                  : (aiJob.stage ?? "Đang chờ AI...")}
              </p>
              {aiJob.status === "failed" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      abandonAiJob()
                      doValidate()
                    }}
                  >
                    Kiểm tra không dùng AI
                  </Button>
                  <Button size="sm" variant="outline" onClick={abandonAiJob}>
                    Đóng
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={abandonAiJob} className="mt-1">
                  Huỷ theo dõi việc này
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* §18 bổ sung: ở chế độ nạp cộng thêm (intoLesson) thì ẨN panel
          việc AI chưa lưu — mở lại kết quả AI ở ngữ cảnh này sẽ khiến
          nội dung bị cộng vào bài đích và mất bước gắn từ nhiễu của
          job. Việc AI vẫn nguyên trên máy chủ, mở trang nạp thường
          (không tham số) là thấy lại. */}
      {!preview && !aiJob && !intoLesson
        ? (() => {
            const waiting = myAiJobs.filter((j) => !j.consumedAt)
            if (waiting.length === 0) return null
            return (
              <Card className="border-primary/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4" />
                    Việc AI trước đó chưa lưu
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Kết quả AI đã xử lý được giữ ở hệ thống — đóng tab không bị mất. Mở lại bản xem
                    trước để kiểm tra và lưu khi sẵn sàng.
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {waiting.map((j) => (
                    <div
                      key={j.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3"
                    >
                      <FileText className="h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{j.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(j.createdAt).toLocaleString("vi-VN")} ·{" "}
                          {j.status === "ready"
                            ? "Đã xử lý xong — chưa lưu"
                            : j.status === "failed"
                              ? `Thất bại${j.error ? `: ${j.error}` : ""}`
                              : j.status === "needs_solution_choice"
                                ? "Đang chờ bạn trả lời câu hỏi của AI"
                                : `Đang xử lý (${j.progress}%)`}
                        </p>
                      </div>
                      {j.status === "ready" ? (
                        <Button
                          size="sm"
                          onClick={() => void resumeReadyJob(j)}
                          disabled={resumingJobId != null}
                        >
                          {resumingJobId === j.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          Mở xem trước
                        </Button>
                      ) : j.status === "failed" ? null : (
                        <Button size="sm" variant="outline" onClick={() => trackJob(j)}>
                          Theo dõi tiếp
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void dismissJob(j)}
                        aria-label="Ẩn việc này"
                        title={
                          j.status === "ready"
                            ? "Đánh dấu đã xong (đã lưu ở nơi khác hoặc không cần nữa)"
                            : "Ẩn việc này"
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })()
        : null}

      {preview && !intoLesson && !assignToClass ? (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-4">
            <div className="grid min-w-64 flex-1 gap-1.5">
              <Label htmlFor="imp-chapter">Lưu các bài vào chương</Label>
              <select
                id="imp-chapter"
                value={chapterChoice}
                onChange={(e) => setChapterChoice(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Theo chương ghi trong file</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
                <option value="__new__">+ Tạo chương mới…</option>
              </select>
            </div>
            {chapterChoice === "__new__" ? (
              <div className="grid min-w-64 flex-1 gap-1.5">
                <Label htmlFor="imp-chapter-new">Tên chương mới</Label>
                <Input
                  id="imp-chapter-new"
                  value={newChapterName}
                  onChange={(e) => setNewChapterName(e.target.value)}
                  placeholder="VD: Di truyền học phân tử"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {preview && !intoLesson
        ? (() => {
            const notes: string[] = []
            preview.parseResult.chapters
              .flatMap((c) => c.lessons)
              .forEach((l, i) => {
                if (l.titleMissing) {
                  notes.push(
                    `Bài ${i + 1} chưa có tên trong file — sẽ dùng tên file "${file?.name ?? ""}" và để ở trạng thái Nháp chờ bạn duyệt tên.`,
                  )
                }
              })
            if (previewIsAiResult) {
              const titles = preview.parseResult.chapters.flatMap((c) =>
                c.lessons.map((l) => l.title),
              )
              for (const idx of aiMeta?.draftLessonIndexes ?? []) {
                if (titles[idx]) {
                  notes.push(
                    `Tên bài "${titles[idx]}" do AI đặt — bài sẽ ở trạng thái Nháp chờ bạn duyệt tên.`,
                  )
                }
              }
            }
            if (notes.length === 0) return null
            return (
              <Card className="border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40">
                <CardContent className="space-y-1 pt-4 text-sm text-sky-800 dark:text-sky-300">
                  <p className="font-medium">Tên bài chờ duyệt:</p>
                  <ul className="list-inside list-disc space-y-1">
                    {notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })()
        : null}

      {preview && intoLesson ? (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          <CardContent className="space-y-1 pt-4 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">Đối chiếu trùng lặp với bài hiện có:</p>
            {appendPlanLoading ? (
              <p>Đang đối chiếu…</p>
            ) : appendPlan ? (
              <>
                <p>
                  Sẽ thêm {appendPlan.addedKps} điểm kiến thức, {appendPlan.addedQuestions} câu
                  hỏi; bỏ qua {appendPlan.skippedQuestions} câu trùng.
                </p>
                {appendPlan.warnings.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1">
                    {appendPlan.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p>Không đối chiếu được — hệ thống sẽ chống trùng lại khi lưu.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {preview?.warnings && preview.warnings.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
          <CardContent className="space-y-1 pt-4 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">Cảnh báo (không chặn lưu):</p>
            <ul className="list-inside list-disc space-y-1">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {preview && (
        <ImportErrorFix
          errors={preview.errors}
          sourceText={draftText}
          parseResult={preview.parseResult}
          summary={preview.summary}
          images={preview.images}
          tables={preview.tables}
          aiMeta={aiMeta}
          onSourceChange={setDraftText}
          onRevalidated={handleRevalidated}
        />
      )}

      <Dialog open={forkOpen} onOpenChange={setForkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lưu bài vào đâu?</DialogTitle>
            <DialogDescription>
              Bài được tạo từ tab Lớp học. Chọn nơi lưu trước khi hệ thống ghi bài.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-muted/50">
              <input
                type="radio"
                name="save-fork"
                className="mt-1 size-4 accent-primary"
                checked={forkKind === "library"}
                onChange={() => setForkKind("library")}
              />
              <span className="flex-1">
                <span className="block font-medium">Lưu vào thư viện</span>
                <span className="block text-sm text-muted-foreground">
                  Bài vào tab Bài giảng để dùng lại cho các lớp khác, đồng thời được giao luôn
                  cho lớp {assignToClass?.name}.
                </span>
              </span>
            </label>
            {forkKind === "library" ? (
              <div className="grid gap-2 pl-6">
                <Label htmlFor="fork-chapter">Chương lưu bài</Label>
                <select
                  id="fork-chapter"
                  value={forkChapterChoice}
                  onChange={(e) => setForkChapterChoice(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                  <option value="__new__">+ Tạo chương mới…</option>
                </select>
                {forkChapterChoice === "__new__" ? (
                  <Input
                    value={forkNewChapterName}
                    onChange={(e) => setForkNewChapterName(e.target.value)}
                    placeholder="Tên chương mới"
                  />
                ) : null}
              </div>
            ) : null}
            <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-muted/50">
              <input
                type="radio"
                name="save-fork"
                className="mt-1 size-4 accent-primary"
                checked={forkKind === "class"}
                onChange={() => setForkKind("class")}
              />
              <span className="flex-1">
                <span className="block font-medium">Lưu tại lớp {assignToClass?.name}</span>
                <span className="block text-sm text-muted-foreground">
                  Bài chỉ nằm trong lớp này — không vào thư viện, không giao lại cho lớp khác
                  được.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setForkOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={() => void confirmFork()} disabled={isSaving}>
              <Save className="h-4 w-4" />
              Lưu vào hệ thống
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modeOpen} onOpenChange={setModeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bạn có sử dụng AI không?</DialogTitle>
            <DialogDescription>
              Sử dụng AI: AI đọc toàn bộ tài liệu, đề xuất gạch chân, gắn hoặc viết giải chi tiết
              cho từng câu, rồi trả về đúng form để kiểm tra và xem trước như thường. Không sử
              dụng AI: kiểm tra trực tiếp theo cú pháp mẫu như hiện tại.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setModeOpen(false)
                doValidate()
              }}
            >
              Không sử dụng AI
            </Button>
            <Button onClick={startAiFlow} disabled={startingAi}>
              {startingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Sử dụng AI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={solutionAskOpen} onOpenChange={(open) => !open && setSolutionAskOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bạn có muốn AI giải chi tiết không?</DialogTitle>
            <DialogDescription>
              Tài liệu này không có phần giải chi tiết. AI có thể tự viết lời giải cho từng câu
              trắc nghiệm — học sinh sẽ thấy lời giải ở nút "Hướng dẫn giải" sau khi nộp bài.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => answerSolutions(false)}>
              Không
            </Button>
            <Button onClick={() => answerSolutions(true)}>Có, AI giải chi tiết</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** §15.1: vòng tròn tiến độ % trong lúc AI xử lý tài liệu. */
function ProgressRing({ value, failed }: { value: number; failed?: boolean }) {
  const r = 34
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      className="relative h-20 w-20 shrink-0"
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Tiến độ xử lý AI"
    >
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
        <circle cx="40" cy="40" r={r} className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          className={`fill-none transition-all duration-500 ${failed ? "stroke-destructive" : "stroke-primary"}`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-foreground">
        {v}%
      </div>
    </div>
  )
}
