"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Download,
  FileText,
  FileUp,
  Loader2,
  Save,
  UploadCloud,
  X,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ImportErrorFix, type RevalidatedPreview } from "@/components/teacher/import-error-fix"
import type { ParseResult, ValidationError } from "@/lib/worksheet-parser"

interface WorksheetPreview {
  parseResult: ParseResult
  errors: ValidationError[]
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

export function WorksheetImporter() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<WorksheetPreview | null>(null)
  const [draftText, setDraftText] = useState("")
  const [originalSource, setOriginalSource] = useState("")
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
    setDraftText("")
    setOriginalSource("")
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setDraftText("")
    setOriginalSource("")
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

  function handleRevalidated(payload: RevalidatedPreview) {
    const wasInvalid = preview && !preview.isValid
    setPreview((prev) => (prev ? { ...prev, ...payload } : prev))
    if (wasInvalid && payload.isValid) toast.success("Hết lỗi, có thể lưu")
  }

  const draftDirty = draftText !== originalSource

  function doSave() {
    if (!file || !preview?.isValid) return
    startSave(async () => {
      try {
        const fd = new FormData()
        if (draftDirty) {
          fd.append("text", draftText)
          fd.append("filename", file.name)
          fd.append("images", JSON.stringify(preview.images ?? []))
          fd.append("tables", JSON.stringify(preview.tables ?? []))
        } else {
          fd.append("file", file)
        }
        const res = await postForm<SaveResult>("/api/worksheet/save", fd)
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
    <div className={`mx-auto space-y-6 ${preview ? "max-w-5xl" : "max-w-3xl"}`}>
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Nạp câu hỏi từ file</h1>
        <p className="mt-1 text-muted-foreground">
          Tải lên tài liệu .docx, .pdf hoặc .txt được soạn theo cú pháp mẫu. Hệ thống sẽ tự tách
          chương, bài, điểm kiến thức và sinh câu hỏi. Không dùng dấu + hay *.
        </p>
      </div>

      {/* Bước tải mẫu */}
      <Card>
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

      {preview && (
        <ImportErrorFix
          errors={preview.errors}
          sourceText={draftText}
          parseResult={preview.parseResult}
          summary={preview.summary}
          images={preview.images}
          tables={preview.tables}
          onSourceChange={setDraftText}
          onRevalidated={handleRevalidated}
        />
      )}
    </div>
  )
}
