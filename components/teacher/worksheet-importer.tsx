"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { assignLessons } from "@/app/actions/assignments"
import {
  Download,
  FileText,
  FileUp,
  Loader2,
  Save,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
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
}

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
}: {
  assignToClass?: { id: string; name: string } | null
}) {
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
  const aiReadyHandledRef = useRef<string | null>(null)

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
      setAiJob({
        id: res.jobId,
        status: "pending",
        progress: 0,
        stage: "Đang chờ AI nhận việc",
        error: null,
      })
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
        const res = await postForm<SaveResult>("/api/worksheet/save", fd)
        savedRef.current = true
        if (assignToClass && res.lessonIds?.length) {
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
          toast.success(
            `Đã lưu: ${res.createdLessons} bài, ${res.createdKps} kiến thức, ${res.createdQuestions} câu hỏi`,
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
          Bạn đang tạo bài cho lớp <strong>{assignToClass.name}</strong>: sau khi lưu thành công,
          bài sẽ <strong>được giao luôn cho lớp này</strong> và đồng thời xuất hiện ở tab Bài
          giảng.
        </div>
      ) : null}
      {preview ? (
        <h1 className="font-heading text-lg font-bold text-foreground">Nạp câu hỏi từ file</h1>
      ) : (
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Nạp câu hỏi từ file</h1>
          <p className="mt-1 text-muted-foreground">
            Tải lên tài liệu .docx, .pdf hoặc .txt được soạn theo cú pháp mẫu. Hệ thống sẽ tự tách
            chương, bài, điểm kiến thức và sinh câu hỏi. Không dùng dấu + hay *.
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
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              Khung tài liệu: <code className="text-foreground">{"{chương}"}</code>{" "}
              <code className="text-foreground">[bài]</code> rồi điểm kiến thức bắt đầu bằng{" "}
              <code className="text-foreground">-</code>.
            </li>
            <li>
              Mốc nhóm dính (chỉ đặt loại, không tạo câu; giữ đến mốc mới):{" "}
              <code className="text-foreground">#</code> trắc nghiệm,{" "}
              <code className="text-foreground">##</code> đúng/sai,{" "}
              <code className="text-foreground">###</code> trả lời ngắn.
            </li>
            <li>
              Mỗi câu bắt đầu bằng <code className="text-foreground">Câu 1.</code> /{" "}
              <code className="text-foreground">câu 1:</code> / <code className="text-foreground">cau:</code>{" "}
              (số bất kỳ). Dòng trống không cắt câu.
            </li>
            <li>
              Trắc nghiệm: 4 lựa chọn <code className="text-foreground">A. B. C. D.</code> (mỗi dòng, cùng 1
              dòng, hoặc 2+2). Gạch chân đáp án đúng.
            </li>
            <li>
              Đúng/Sai: 4 ý <code className="text-foreground">a) b) c) d)</code>. Gạch chân = Đúng.
            </li>
            <li>
              Trả lời ngắn: đề đến <code className="text-foreground">Đáp án:</code> /{" "}
              <code className="text-foreground">dap an:</code>.
            </li>
            <li>
              Phần <code className="text-foreground">ĐÁP ÁN</code> /{" "}
              <code className="text-foreground">HƯỚNG DẪN GIẢI</code> ở cuối file bị bỏ, không nạp thành câu.
            </li>
            <li>
              Trong .txt/.pdf dùng <code className="text-foreground">__...__</code> để gạch chân. Trong Word
              dùng gạch chân thật. Công thức Word được giữ thành ảnh.
            </li>
          </ul>
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
