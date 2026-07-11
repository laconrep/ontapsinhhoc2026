"use client"

import { Check, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LiveQuizView } from "./use-live-quiz"

const LETTERS = ["A", "B", "C", "D", "E", "F"]

/**
 * Sân khấu trình chiếu: câu hỏi chiếm phần lớn màn hình + các overlay
 * (ô số HS tham gia góc trên-trái, đồng hồ góc trên-phải, thông báo
 * thoát fullscreen góc dưới-trái). Dùng cho màn hình TV và màn hình GV.
 */
export function QuizStage({ view }: { view: LiveQuizView }) {
  const { question, revealed, phase } = view

  return (
    <div className="dark relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Overlay: số HS tham gia (góc trên-trái, nền trong suốt, hiện 3s) */}
      <div
        className={cn(
          "pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full px-3 py-1.5 text-lg font-semibold transition-opacity duration-500",
          view.showJoinBadge ? "opacity-100" : "opacity-0",
        )}
        aria-live="polite"
      >
        <Users className="h-5 w-5 text-primary" aria-hidden="true" />
        <span className="text-foreground">{view.joinedCount}</span>
      </div>

      {/* Overlay: đồng hồ đếm ngược (góc trên-phải) */}
      {phase === "question" && view.remainingSec != null && (
        <div className="absolute right-4 top-4 z-20 flex flex-col items-center">
          <div
            className={cn(
              "flex h-20 w-20 items-center justify-center rounded-2xl border-2 font-heading text-4xl font-bold tabular-nums",
              view.remainingSec <= 5
                ? "border-destructive text-destructive"
                : "border-primary/50 text-foreground",
            )}
          >
            {view.remainingSec}
          </div>
        </div>
      )}

      {/* Vùng câu hỏi chính */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-10 md:px-16">
        {question ? (
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-primary/15 px-4 py-1 text-lg font-semibold text-primary">
                Câu {view.currentIndex + 1}/{view.total}
              </span>
              <span className="rounded-full bg-secondary px-4 py-1 text-lg font-medium text-secondary-foreground">
                {question.type === "MC" ? "Trắc nghiệm" : question.type === "TF" ? "Đúng / Sai" : "Trả lời ngắn"}
              </span>
            </div>

            <h1 className="text-balance text-center font-heading text-4xl font-bold leading-tight md:text-5xl">
              {question.content}
            </h1>

            {/* Lựa chọn */}
            {question.type === "SA" ? (
              <div className="mt-2 w-full max-w-3xl text-center">
                {revealed ? (
                  <p className="rounded-2xl border-2 border-primary bg-primary/10 px-6 py-5 text-3xl font-semibold text-foreground">
                    {revealed.correctText}
                  </p>
                ) : (
                  <p className="text-2xl text-muted-foreground">Nhập câu trả lời trên thiết bị của bạn</p>
                )}
              </div>
            ) : (
              <div
                className={cn(
                  "grid w-full gap-4",
                  question.options.length > 2 ? "md:grid-cols-2" : "grid-cols-1",
                )}
              >
                {question.options.map((o, i) => {
                  const isCorrect = revealed?.correctOptionIds.includes(o.id)
                  return (
                    <div
                      key={o.id}
                      className={cn(
                        "flex items-center gap-4 rounded-2xl border-2 px-6 py-5 text-2xl transition-colors",
                        revealed && isCorrect
                          ? "border-primary bg-primary/15 text-foreground"
                          : revealed
                            ? "border-border bg-card/40 text-muted-foreground opacity-60"
                            : "border-border bg-card text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl font-bold",
                          revealed && isCorrect
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {revealed && isCorrect ? <Check className="h-6 w-6" /> : LETTERS[i]}
                      </span>
                      <span className="font-medium leading-snug">{o.content}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <Users className="h-16 w-16 text-primary" aria-hidden="true" />
            <h1 className="font-heading text-4xl font-bold">Đang chờ bắt đầu…</h1>
            <p className="text-2xl text-muted-foreground">
              {view.joinedCount > 0 ? `${view.joinedCount} học sinh đã sẵn sàng` : "Học sinh chưa tham gia"}
            </p>
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
