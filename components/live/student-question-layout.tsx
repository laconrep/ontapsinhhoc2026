"use client"

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

const PHONE_MIN_FS = 14
const PHONE_MAX_FS = 24
const PHONE_SPLIT = 0.65

function dup(node: ReactNode): ReactNode {
  if (node == null || typeof node === "boolean") return node
  if (Array.isArray(node)) return node.map((n, i) => dup(n))
  if (!isValidElement<{ children?: ReactNode }>(node)) return node
  const children = node.props.children
  if (children === undefined) return cloneElement(node)
  return cloneElement(node, undefined, ...Children.map(children, (c) => dup(c)) ?? [])
}

export function StudentQuestionLayout({
  questionId,
  stem,
  options,
}: {
  questionId: string
  stem: ReactNode
  options: ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const natRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<{ mode: "single" | "split"; fs: number }>({
    mode: "single",
    fs: PHONE_MIN_FS,
  })

  const measure = useCallback(() => {
    const box = boxRef.current
    const nat = natRef.current
    if (!box || !nat) return
    if (box.clientHeight < 8 || box.clientWidth < 8) return

    const apply = (fs: number) => {
      nat.style.fontSize = `${fs}px`
    }
    const fits = (fs: number) => {
      apply(fs)
      return nat.offsetHeight <= box.clientHeight && nat.scrollWidth <= nat.clientWidth + 1
    }

    let fs: number
    let mode: "single" | "split"
    if (fits(PHONE_MAX_FS)) {
      fs = PHONE_MAX_FS
      mode = "single"
    } else if (!fits(PHONE_MIN_FS)) {
      fs = PHONE_MIN_FS
      mode = "split"
      apply(PHONE_MIN_FS)
    } else {
      let lo = PHONE_MIN_FS
      let hi = PHONE_MAX_FS
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (fits(mid)) lo = mid
        else hi = mid
      }
      fs = lo
      mode = "single"
      apply(fs)
    }

    setLayout((prev) => (prev.mode === mode && prev.fs === fs ? prev : { mode, fs }))
  }, [questionId])

  useLayoutEffect(() => {
    measure()
  }, [measure, questionId])

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

  return (
    <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ visibility: "hidden" }}
      >
        <div ref={natRef} className="flex w-full flex-col gap-[0.7em]">
          {dup(stem)}
          {dup(options)}
        </div>
      </div>

      {layout.mode === "single" ? (
        <div className="flex h-full min-h-0 flex-col justify-center overflow-hidden">
          <div className="flex w-full flex-col gap-[0.7em]" style={{ fontSize: layout.fs }}>
            {stem}
            {options}
          </div>
        </div>
      ) : (
        <div
          className="grid h-full min-h-0 gap-2"
          style={{ fontSize: layout.fs, gridTemplateRows: `${PHONE_SPLIT}fr ${1 - PHONE_SPLIT}fr` }}
        >
          <div className="min-h-0 overflow-y-auto pr-1">{stem}</div>
          <div className="min-h-0 overflow-y-auto border-t border-border pr-1 pt-2">{options}</div>
        </div>
      )}
    </div>
  )
}
