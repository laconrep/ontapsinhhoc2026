"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { TourStepArt, tourStepCopy, type TvOs } from "./tv-tour-illustrations"

const TV_OS_KEY = "edusync-tv-os"
const TV_TOUR_DONE_KEY = "edusync-tv-tour-done"
const STEP_COUNT = 4
const PRESENT_WINDOW_NAME = "edusync-tv-stage"

type ScreenInfo = {
  isPrimary: boolean
  availLeft: number
  availTop: number
  availWidth: number
  availHeight: number
}

type WindowWithScreens = Window & {
  getScreenDetails?: () => Promise<{ screens: ScreenInfo[] }>
}

function detectOs(): TvOs {
  try {
    const stored = localStorage.getItem(TV_OS_KEY)
    if (stored === "win" || stored === "mac") return stored
  } catch {}
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  const platform = `${uaData?.platform ?? ""} ${navigator.userAgent}`
  if (/mac/i.test(platform) && !/win/i.test(uaData?.platform ?? "")) return "mac"
  if (/iphone|ipad|macintosh|mac os/i.test(platform) && !/windows/i.test(platform)) return "mac"
  return "win"
}

function persistOs(os: TvOs) {
  try {
    localStorage.setItem(TV_OS_KEY, os)
  } catch {}
}

function persistTourDone() {
  try {
    localStorage.setItem(TV_TOUR_DONE_KEY, "1")
  } catch {}
}

export function TvStageTour({
  open,
  onOpenChange,
  sessionId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId?: string
}) {
  const [os, setOs] = useState<TvOs>("win")
  const [step, setStep] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setOs(detectOs())
    setStep(0)
    setErr(null)
    setBusy(false)
  }, [open])

  function selectOs(next: TvOs) {
    setOs(next)
    persistOs(next)
    setErr(null)
  }

  async function openOnTv() {
    setErr(null)
    if (!sessionId) {
      setErr("Đây là bản xem trước — không mở cửa sổ present thật.")
      return
    }

    const w = window as WindowWithScreens
    if (typeof w.getScreenDetails !== "function") {
      setErr(
        "Trình duyệt không hỗ trợ Window Management. Dùng Chrome hoặc Edge, rồi Cho phép quyền ở bước 3.",
      )
      setStep(2)
      return
    }

    let details: { screens: ScreenInfo[] }
    try {
      details = await w.getScreenDetails()
    } catch {
      setErr("Chưa có quyền Window Management. Dùng Chrome/Edge và chọn Cho phép ở bước 3.")
      setStep(2)
      return
    }

    const secondary = details.screens.find((s) => !s.isPrimary)
    if (!secondary) {
      setErr(
        "Chưa thấy màn phụ. Vào bước 2: chọn Mở rộng (không Nhân bản). Duplicate vẫn chỉ 1 màn.",
      )
      setStep(1)
      return
    }

    const presentUrl = `/teacher/sessions/${sessionId}/present`
    const features = [
      "popup=yes",
      `left=${Math.round(secondary.availLeft)}`,
      `top=${Math.round(secondary.availTop)}`,
      `width=${Math.round(secondary.availWidth)}`,
      `height=${Math.round(secondary.availHeight)}`,
    ].join(",")

    const popup = window.open(presentUrl, PRESENT_WINDOW_NAME, features)
    if (!popup) {
      setErr("Cửa sổ bị chặn. Cho phép popup cho trang này rồi thử lại.")
      return
    }

    try {
      popup.moveTo(Math.round(secondary.availLeft), Math.round(secondary.availTop))
      popup.resizeTo(Math.round(secondary.availWidth), Math.round(secondary.availHeight))
    } catch {}

    const tryFs = () => {
      try {
        popup.document.documentElement.requestFullscreen?.().catch(() => {})
      } catch {}
    }
    if (popup.document.readyState === "complete") {
      tryFs()
    } else {
      popup.addEventListener("load", tryFs, { once: true })
    }

    persistOs(os)
    persistTourDone()
    onOpenChange(false)
  }

  async function handleOpenStage() {
    if (busy) return
    setBusy(true)
    try {
      await openOnTv()
    } finally {
      setBusy(false)
    }
  }

  const copy = tourStepCopy(os, step)
  const isLast = step === STEP_COUNT - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Đưa sân khấu lên TV</DialogTitle>
          <DialogDescription>
            Làm 4 bước trên máy của bạn. Ứng dụng không tự bấm Win+K hay đổi Nhân bản thành Mở rộng.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium",
              os === "win" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
            onClick={() => selectOs("win")}
          >
            Windows
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium",
              os === "mac" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
            onClick={() => selectOs("mac")}
          >
            Mac
          </button>
        </div>

        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Bước {step + 1} / {STEP_COUNT}
        </p>

        <TourStepArt os={os} step={step} />

        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{copy.title}</p>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
        </div>

        {err && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setErr(null)
              setStep((s) => Math.max(0, s - 1))
            }}
            disabled={step === 0 || busy}
          >
            Quay lại
          </Button>
          {isLast ? (
            <Button size="sm" onClick={() => void handleOpenStage()} disabled={busy}>
              {busy ? "Đang mở…" : "Mở sân khấu trên TV"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setErr(null)
                setStep((s) => Math.min(STEP_COUNT - 1, s + 1))
              }}
            >
              Tiếp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
