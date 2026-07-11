"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  Loader2,
  Save,
  UploadCloud,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { validateWorksheet, saveWorksheet, type WorksheetPreview } from "@/app/actions/worksheet"

const TYPE_LABEL: Record<string, string> = { MC: "Trắc nghiệm", TF: "Đúng/Sai", SA: "Trả lời ngắn" }
const ACCEPT = ".txt,.docx,.pdf"

export function WorksheetImporter() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<WorksheetPreview | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [isValidating, startValidate] = useTransition()
  const [isSaving, startSave] = useTransition()

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
    setFile(f)
    setPreview(null)
  }

  function reset() {
    setFile(null)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  function doValidate() {
    if (!file) return
    const fd = new FormData()
    fd.append("file", file)
    startValidate(async () => {
      try {
        const res = await validateWorksheet(fd)
        setPreview(res)
        if (res.isValid) toast.success("Tài liệu hợp lệ, sẵn sàng để lưu")
        else toast.error(`Phát hiện ${res.errors.length} lỗi cần sửa`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Không đọc được file")
      }
    })
  }

  function doSave() {
    if (!file || !preview?.isValid) return
    const fd = new FormData()
    fd.append("file", file)
    startSave(async () => {
      try {
        const res = await saveWorksheet(fd)
        toast.success(
          `Đã lưu: ${res.createdLessons} bài, ${res.createdKps} kiến thức, ${res.createdQuestions} câu hỏi`,
        )
        router.push("/teacher/lessons")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lưu thất bại")
      }
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Nạp câu hỏi từ file</h1>
        <p className="mt-1 text-muted-foreground">
          Tải lên tài liệu .docx, .pdf hoặc .txt được soạn theo cú pháp mẫu. Hệ thống sẽ tự tách
          chương, bài, điểm kiến thức và sinh câu hỏi.
        </p>
      </div>

      {/* Bước tải mẫu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Tải file mẫu và soạn nội dung</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <a href="/templates/mau-cau-hoi.docx" download>
              <Download className="h-4 w-4" />
              Mẫu Word (.docx)
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/templates/mau-cau-hoi.txt" download>
              <Download className="h-4 w-4" />
              Mẫu văn bản (.txt)
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Bước upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Chọn file và kiểm tra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1 overflow-hidden">
                <p className="truncate font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset} aria-label="Bỏ file">
                <X className="h-4 w-4" />
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
          <div className="flex gap-3">
            <Button onClick={doValidate} disabled={!file || isValidating}>
              {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Kiểm tra tài liệu
            </Button>
            <Button
              variant="default"
              onClick={doSave}
              disabled={!preview?.isValid || isSaving}
              className="bg-primary"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Lưu vào hệ thống
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kết quả */}
      {preview && <PreviewPanel preview={preview} />}
    </div>
  )
}

function PreviewPanel({ preview }: { preview: WorksheetPreview }) {
  const { summary, errors, isValid, parseResult } = preview
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {isValid ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Tài liệu hợp lệ
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cần sửa {errors.length} lỗi
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{summary.chapters} chương</Badge>
          <Badge variant="secondary">{summary.lessons} bài</Badge>
          <Badge variant="secondary">{summary.kps} kiến thức</Badge>
          <Badge variant="secondary">{summary.questions} câu hỏi</Badge>
        </div>

        {errors.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {errors.map((e, i) => (
              <li key={i} className="flex gap-2 text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {e.line ? <strong>Dòng {e.line}: </strong> : null}
                  {e.message}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3">
          {parseResult.chapters.map((c, ci) => (
            <div key={ci} className="rounded-lg border">
              <div className="border-b bg-secondary/40 px-3 py-2 font-heading font-semibold text-foreground">
                {c.title}
              </div>
              <div className="divide-y">
                {c.lessons.map((l, li) => (
                  <div key={li} className="px-3 py-2">
                    <p className="font-medium text-foreground">{l.title}</p>
                    <ul className="mt-2 space-y-2">
                      {l.knowledgePoints.map((kp, ki) => (
                        <li key={ki} className="rounded-md bg-muted/40 p-2 text-sm">
                          <p className="text-foreground">{highlightBlanks(kp.content, kp.underlinedTerms)}</p>
                          {kp.questions.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {kp.questions.map((q, qi) => (
                                <Badge key={qi} variant="outline" className="text-xs">
                                  {TYPE_LABEL[q.type] ?? q.type}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Hiển thị nội dung KP, tô đậm những từ là ô trống
function highlightBlanks(content: string, terms: { text: string }[]) {
  if (terms.length === 0) return content
  const parts: (string | { blank: string })[] = [content]
  for (const t of terms) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (typeof p !== "string") continue
      const idx = p.indexOf(t.text)
      if (idx >= 0) {
        parts.splice(i, 1, p.slice(0, idx), { blank: t.text }, p.slice(idx + t.text.length))
        break
      }
    }
  }
  return parts.map((p, i) =>
    typeof p === "string" ? (
      <span key={i}>{p}</span>
    ) : (
      <span key={i} className="rounded bg-primary/15 px-1 font-semibold text-primary underline decoration-dotted">
        {p.blank}
      </span>
    ),
  )
}
