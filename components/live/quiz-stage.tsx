"use client"

import { Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LiveQuizView } from "./use-live-quiz"
import { AdaptiveQuestion } from "./adaptive-question"

/**
 * Sân khấu trình chiếu: câu hỏi chiếm phần lớn màn hình + các overlay
 * (ô số HS tham gia góc trên-trái, đồng hồ góc trên-phải, thông báo
 * thoát fullscreen góc dưới-trái). Dùng cho màn hình TV và màn hình GV.
 */
export function QuizStage({ view }: { view: LiveQuizView }) {
  const { question, revealed, phase } = view

  return (
    <div className="dark relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-1.5">
        {question ? (
          <>
            <span className="rounded-full bg-primary/15 px-2 py-px text-xs font-semibold leading-tight text-primary">
              Câu {view.currentIndex + 1}/{view.total}
            </span>
            <span className="rounded-full bg-secondary px-2 py-px text-xs font-medium leading-tight text-secondary-foreground">
              {question.type === "MC" ? "Trắc nghiệm" : question.type === "TF" ? "Đúng / Sai" : "Trả lời ngắn"}
            </span>
          </>
        ) : null}
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-px text-xs font-semibold transition-opacity duration-500",
            view.showJoinBadge ? "opacity-100" : "opacity-0",
          )}
          aria-live="polite"
        >
          <Users className="h-3 w-3 text-primary" aria-hidden="true" />
          <span className="text-foreground">{view.joinedCount}</span>
        </div>
      </div>

      {phase === "question" && view.remainingSec != null && (
        <div className="absolute right-4 top-4 z-30">
          <div
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-2xl border-2 bg-background/90 font-heading text-4xl font-bold tabular-nums shadow-lg",
              view.remainingSec <= 5
                ? "border-destructive text-destructive"
                : "border-primary/50 text-foreground",
            )}
          >
            {view.remainingSec}
          </div>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col px-8 pb-6 pt-10 md:px-16">
        {question ? (
          <div className="relative min-h-0 flex-1">
            <AdaptiveQuestion key={question.id} question={question} revealed={revealed} />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <Users className="h-16 w-16 text-primary" aria-hidden="true" />
              <h1 className="font-heading text-4xl font-bold">Đang chờ bắt đầu…</h1>
              <p className="text-2xl text-muted-foreground">
                {view.joinedCount > 0 ? `${view.joinedCount} học sinh đã sẵn sàng` : "Học sinh chưa tham gia"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Overlay: thông báo HS thoát fullscreen (góc dưới-trái, nền trong suốt, chữ đỏ 26px) */}
      {view.notFullscreen.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex flex-col gap-1">
          {view.notFullscreen.map((n) => (
            <p key={n.studentId} style={{ fontSize: 26 }} className="font-semibold text-destructive">
              {n.name} đã thoát toàn màn hình
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
