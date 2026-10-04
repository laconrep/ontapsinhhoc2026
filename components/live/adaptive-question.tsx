"use client"

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { stripOptionPrefix, stripOptionPrefixHtml } from "@/lib/option-prefix"
import { QuestionStem } from "@/components/question/question-stem"
import type { LiveQuizView } from "./use-live-quiz"

type Q = NonNullable<LiveQuizView["question"]>
type Revealed = LiveQuizView["revealed"]
type Cols = 1 | 2 | 4

const STAGE_MIN_FS = 28
const STAGE_MAX_FS = 80
const SPLIT_GAP = 12
const SPLIT_OPTS_CHROME = 13
const SPLIT_MIN_SHARE = 0.2
const LETTERS = ["A", "B", "C", "D", "E", "F"]
const FOUR_COL_MAX_CHARS = 14

const FIGURE_CLASS = "[&_img:not(.eq-inline)]:max-h-[28vh]"

export function computeSplitRatio(stemH: number, optsH: number, avail: number): number {
  if (avail <= 0 || stemH + optsH <= 0) return 0.65
  const total = stemH + optsH
  const half = avail / 2
  let stem: number
  if (total <= avail) stem = stemH + (avail - total) / 2
  else if (stemH <= half) stem = stemH
  else if (optsH <= half) stem = avail - optsH
  else stem = (avail * stemH) / total
  return Math.min(1 - SPLIT_MIN_SHARE, Math.max(SPLIT_MIN_SHARE, stem / avail))
}

function optionOverflowsX(opts: HTMLElement): boolean {
  for (const cell of opts.children) {
    if (!(cell instanceof HTMLElement)) continue
    if (cell.clientWidth > 0 && cell.scrollWidth > cell.clientWidth + 1) return true
  }
  return false
}

export function AdaptiveQuestion({ question, revealed }: { question: Q; revealed: Revealed }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const natRef = useRef<HTMLDivElement>(null)
  const optsRef = useRef<HTMLDivElement>(null)
  const stemWrapRef = useRef<HTMLDivElement>(null)
  const optsWrapRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<{
    mode: "single" | "split"
    fs: number
    cols: Cols
    ratio: number
  }>({
    mode: "single",
    fs: STAGE_MIN_FS,
    cols: 1,
    ratio: 0.65,
  })
  const n = question.options.length
  const allowFourCols = useMemo(
    () =>
      question.type !== "SA" &&
      question.options.every(
        (o) =>
          !/<img\b/i.test(o.bodyHtml ?? "") &&
          stripOptionPrefix(o.content).replace(/@@\w+@@/g, "").trim().length <= FOUR_COL_MAX_CHARS,
      ),
    [question.options, question.type],
  )

  const measure = useCallback(() => {
    const box = boxRef.current
    const nat = natRef.current
    const opts = optsRef.current
    if (!box || !nat || !opts) return
    if (box.clientHeight < 8 || box.clientWidth < 8) return

    const apply = (fs: number, cols: Cols) => {
      nat.style.fontSize = `${fs}px`
      opts.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`
    }
    const fits = (fs: number, cols: Cols) => {
      apply(fs, cols)
      return (
        nat.offsetHeight <= box.clientHeight &&
        nat.scrollWidth <= nat.clientWidth + 1 &&
        !optionOverflowsX(opts)
      )
    }

    const candidates: Cols[] = n >= 4 ? (allowFourCols ? [2, 1, 4] : [2, 1]) : n === 2 ? [2, 1] : [1]
    let best: { fs: number; cols: Cols } | null = null

    for (const cols of candidates) {
      let fs: number
      if (fits(STAGE_MAX_FS, cols)) fs = STAGE_MAX_FS
      else if (!fits(STAGE_MIN_FS, cols)) continue
      else {
        let lo = STAGE_MIN_FS
        let hi = STAGE_MAX_FS
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1
          if (fits(mid, cols)) lo = mid
          else hi = mid
        }
        fs = lo
      }
      if (!best || fs > best.fs) best = { fs, cols }
    }

    if (best) {
      apply(best.fs, best.cols)
      setLayout((prev) =>
        prev.mode === "single" && prev.fs === best.fs && prev.cols === best.cols
          ? prev
          : { mode: "single", ratio: prev.ratio, ...best },
      )
      return
    }

    let bestCols: Cols = 1
    let bestH = Infinity
    for (const cols of candidates.filter((c) => c <= 2)) {
      apply(STAGE_MIN_FS, cols)
      if (nat.offsetHeight < bestH) {
        bestH = nat.offsetHeight
        bestCols = cols
      }
    }
    apply(STAGE_MIN_FS, bestCols)
    const stemH = stemWrapRef.current?.offsetHeight ?? 0
    const optsH = (optsWrapRef.current?.offsetHeight ?? 0) + SPLIT_OPTS_CHROME
    const ratio = Math.round(computeSplitRatio(stemH, optsH, box.clientHeight - SPLIT_GAP) * 100) / 100
    setLayout((prev) =>
      prev.mode === "split" && prev.fs === STAGE_MIN_FS && prev.cols === bestCols && prev.ratio === ratio
        ? prev
        : { mode: "split", fs: STAGE_MIN_FS, cols: bestCols, ratio },
    )
  }, [n, allowFourCols])

  useLayoutEffect(() => {
    measure()
  }, [measure, question.id, revealed])

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => measure())
    }
    const ro = new ResizeObserver(schedule)
    ro.observe(box)
    box.addEventListener("load", schedule, true)
    void document.fonts?.ready.then(schedule)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      box.removeEventListener("load", schedule, true)
    }
  }, [measure])

  function stemNode() {
    return (
      <QuestionStem
        content={question.content.replace(/\n{2,}/g, "\n")}
        bodyHtml={question.bodyHtml ?? undefined}
        className={cn(
          "whitespace-pre-line font-heading font-bold leading-snug [&_p]:my-0 text-justify [text-align-last:left]",
          FIGURE_CLASS,
        )}
        maxHeightClass="max-h-none"
      />
    )
  }

  const optionsGrid = (ref?: Ref<HTMLDivElement>) => (
    <div
      ref={ref}
      className="grid gap-[0.5em]"
      style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}
    >
      {question.type === "SA" ? (
        <p
          className={cn(
            "col-span-full text-center",
            revealed
              ? "rounded-[0.6em] border-2 border-primary bg-primary/10 px-[0.8em] py-[0.4em] font-semibold"
              : "text-[0.7em] text-muted-foreground",
          )}
        >
          {revealed ? revealed.correctText : "Nhập câu trả lời trên thiết bị của bạn"}
        </p>
      ) : (
        question.options.map((o, i) => {
          const isCorrect = revealed?.correctOptionIds.includes(o.id)
          return (
            <div
              key={o.id}
              className={cn(
                "flex min-w-0 items-center gap-[0.5em] rounded-[0.6em] border-2 px-[0.6em] py-[0.35em]",
                revealed && isCorrect
                  ? "border-primary bg-primary/15"
                  : revealed
                    ? "border-border bg-card/40 text-muted-foreground opacity-60"
                    : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "flex h-[1.5em] w-[1.5em] shrink-0 items-center justify-center rounded-full text-[0.75em] font-bold",
                  revealed && isCorrect ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                )}
              >
                {revealed && isCorrect ? <Check className="h-[1em] w-[1em]" /> : LETTERS[i]}
              </span>
              <div className="min-w-0 flex-1">
                <QuestionStem
                  content={stripOptionPrefix(o.content)}
                  bodyHtml={o.bodyHtml ? stripOptionPrefixHtml(o.bodyHtml) : o.bodyHtml}
                  className={cn(
                    "font-medium leading-snug text-justify [text-align-last:left]",
                    FIGURE_CLASS,
                  )}
                  maxHeightClass="max-h-none"
                />
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ visibility: "hidden" }}
      >
        <div ref={natRef} className="mx-auto flex w-full max-w-[1800px] flex-col gap-[0.7em]">
          <div ref={stemWrapRef}>{stemNode()}</div>
          <div ref={optsWrapRef}>{optionsGrid(optsRef)}</div>
        </div>
      </div>

      {layout.mode === "single" ? (
        <div className="flex h-full items-center">
          <div
            className="mx-auto flex w-full max-w-[1800px] flex-col gap-[0.7em]"
            style={{ fontSize: layout.fs }}
          >
            {stemNode()}
            {optionsGrid()}
          </div>
        </div>
      ) : (
        <div
          className="grid h-full gap-3"
          style={{
            fontSize: layout.fs,
            gridTemplateRows: `minmax(0, ${layout.ratio}fr) minmax(0, ${1 - layout.ratio}fr)`,
          }}
        >
          <div className="min-h-0 overflow-y-auto pr-3">{stemNode()}</div>
          <div className="min-h-0 overflow-y-auto border-t border-border pr-3 pt-3">{optionsGrid()}</div>
        </div>
      )}
    </div>
  )
}
