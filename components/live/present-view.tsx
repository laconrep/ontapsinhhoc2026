"use client"

import { useState } from "react"
import { Maximize, Minimize } from "lucide-react"
import { QuizStage } from "./quiz-stage"
import { useLiveQuiz } from "./use-live-quiz"

export function PresentView({ sessionId }: { sessionId: string }) {
  const view = useLiveQuiz(sessionId)
  const [isFs, setIsFs] = useState(false)

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFs(true)).catch(() => {})
    } else {
      document.exitFullscreen?.().then(() => setIsFs(false)).catch(() => {})
    }
  }

  if (view.phase === "ended") {
    return (
      <div className="dark flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <h1 className="font-heading text-5xl font-bold">Phiên đã kết thúc</h1>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen">
      <QuizStage view={view} />
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute bottom-4 right-4 z-30 rounded-full bg-secondary/80 p-2 text-secondary-foreground opacity-40 transition-opacity hover:opacity-100"
        aria-label={isFs ? "Thoát toàn màn hình" : "Toàn màn hình"}
      >
        {isFs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </button>
    </div>
  )
}
