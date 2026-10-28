"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import {
  getLessonStats,
  type LessonStatsDto,
} from "@/app/actions/lesson-stats"
import {
  createAiStatsJob,
  listAiStatsJobs,
  type AiStatsJobRow,
} from "@/app/actions/ai-stats"
import { LEVEL_LABEL, type QuestionStat, type StatsLevel } from "@/lib/lesson-stats"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/shared/empty-state"
import { BarChart3, Users } from "lucide-react"

type Screen = 1 | 2 | 3 | 4 | 5 | 6
type MatrixMode = "compact" | "detail" | "groups"

const LEVEL_BG: Record<StatsLevel, string> = {
  mastered: "bg-green-500",
  ok: "bg-yellow-400",
  weak: "bg-red-500",
  unverified: "bg-zinc-400",
  not_started: "bg-zinc-200",
}
const LEVEL_TEXT: Record<StatsLevel, string> = {
  mastered: "text-green-700",
  ok: "text-yellow-700",
  weak: "text-red-600",
  unverified: "text-zinc-500",
  not_started: "text-zinc-400",
}
const LEVEL_ORDER: StatsLevel[] = ["mastered", "ok", "weak", "unverified", "not_started"]

function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

/** Thanh 2-3 đoạn: xanh/đỏ (+ xám cho phần chưa làm). Số lượng nằm trong đoạn. */
function SplitBar({
  segments,
  tail,
}: {
  segments: { count: number; className: string; label: string }[]
  tail: string
}) {
  const total = segments.reduce((s, g) => s + g.count, 0)
  return (
    <div className="min-w-[140px]">
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-secondary">
        {segments.map((g, i) =>
          g.count > 0 && total > 0 ? (
            <div
              key={i}
              className={cn("flex h-full items-center justify-center text-[10px] font-semibold text-white", g.className)}
              style={{ width: `${(g.count / total) * 100}%` }}
              title={`${g.label}: ${g.count}`}
            >
              {g.count}
            </div>
          ) : null,
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{tail}</p>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Mức độ:</span>
      <span>🟢 Thành thạo</span>
      <span>🟡 Khá</span>
      <span>🔴 Chưa tốt</span>
      <span>⚪ Chưa kiểm chứng</span>
      <span>▫️ Chưa làm</span>
      <span className="border-l border-border pl-4">Nguồn: Q kiểm tra · F điền khuyết · D kéo thả · S tự nhận</span>
    </div>
  )
}

export function LessonStatsTab({ classId }: { classId: string }) {
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [data, setData] = useState<LessonStatsDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>(1)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string; lines: string[] } | null>(null)
  const [expandedKp, setExpandedKp] = useState<string | null>(null)
  const [onlyWeak, setOnlyWeak] = useState(false)
  const [matrixMode, setMatrixMode] = useState<MatrixMode>("detail")
  const [matrixGroup, setMatrixGroup] = useState(0)
  const [cellDetail, setCellDetail] = useState<{ studentId: string; kpId: string } | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const lessonIdRef = useRef<string | null>(null)
  lessonIdRef.current = lessonId

  const fetchStats = useCallback(
    async (id: string) => {
      try {
        const result = await getLessonStats(classId, id)
        setData(result)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được thống kê")
      } finally {
        setLoading(false)
      }
    },
    [classId],
  )

  // Lần đầu: lấy bài mặc định (bài mới giao nhất) rồi tải.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const first = await getLessonStats(classId)
        if (cancelled) return
        setData(first)
        if (first.lessonId) setLessonId(first.lessonId)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Không tải được thống kê")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [classId])

  // Polling 30 giây: chỉ khi tab trình duyệt đang hiển thị; dừng khi ẩn.
  useEffect(() => {
    if (!lessonId) return
    const tick = () => {
      if (document.visibilityState === "visible" && lessonIdRef.current) {
        void fetchStats(lessonIdRef.current)
      }
    }
    const timer = setInterval(tick, 30_000)
    const onVisible = () => {
      if (document.visibilityState === "visible" && lessonIdRef.current) {
        void fetchStats(lessonIdRef.current)
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [lessonId, fetchStats])

  const changeLesson = (id: string) => {
    setLessonId(id)
    setLoading(true)
    setCellDetail(null)
    setProfileId(null)
    setMatrixGroup(0)
    void fetchStats(id)
  }

  const namesByKpLevel = useMemo(() => {
    if (!data) return new Map<string, Record<StatsLevel, string[]>>()
    const map = new Map<string, Record<StatsLevel, string[]>>()
    for (const row of data.students) {
      for (const kp of data.matrixOrderedKps) {
        const tier = row.tiersByKp[kp.id]
        const level = tier?.level ?? "not_started"
        let entry = map.get(kp.id)
        if (!entry) {
          entry = { mastered: [], ok: [], weak: [], unverified: [], not_started: [] }
          map.set(kp.id, entry)
        }
        entry[level].push(row.name)
      }
    }
    return map
  }, [data])

  if (loading && !data) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Đang tải thống kê…</p>
  }
  if (error && !data) {
    return <p className="py-6 text-center text-sm text-destructive">{error}</p>
  }
  if (!data || !data.lessonId) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-6 w-6" aria-hidden="true" />}
        title="Chưa có bài để thống kê"
        description="Giao một bài cho lớp này để xem thống kê theo bài."
      />
    )
  }

  const classSize = data.overview.classSize
  const showTooltip = (e: MouseEvent, title: string, lines: string[]) => {
    setTooltip({ x: e.clientX + 12, y: e.clientY + 12, title, lines })
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">Thống kê theo bài</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Số liệu tính theo bài đang chọn, cập nhật mỗi 30 giây khi giáo viên đang xem.
              {data.generatedAt ? ` Cập nhật lúc ${fmtTime(data.generatedAt)}.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="stats-lesson-picker">
              Bài học
            </label>
            <select
              id="stats-lesson-picker"
              value={data.lessonId}
              onChange={(e) => changeLesson(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {data.lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setScreen(5)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground"
            >
              Tiêu chí đánh giá
            </button>
          </div>
        </div>
        <div className="mt-3">
          <Legend />
        </div>
        {data.coverage.total === 0 ? (
          <p className="mt-3 rounded-lg bg-yellow-100 p-3 text-sm text-yellow-900">
            Bài chưa có câu kiểm tra — tầng quiz không áp dụng, các mức chỉ tính theo điền khuyết, kéo thả và
            tự nhận xét.
          </p>
        ) : data.coverage.unattached > 0 ? (
          <p className="mt-3 rounded-lg bg-yellow-100 p-3 text-sm text-yellow-900">
            {data.coverage.unattached}/{data.coverage.total} câu chưa gắn vào điểm kiến thức — các câu này không
            tính vào tầng quiz của điểm kiến thức nào.{" "}
            <a href={`/teacher/lessons/${data.lessonId}`} className="font-semibold underline">
              Gắn câu hỏi →
            </a>
          </p>
        ) : null}
        {data.coverage.total > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Độ phủ đánh giá: {data.coverage.attached}/{data.coverage.total} câu đã gắn vào điểm kiến thức (
            {Math.round((data.coverage.attached / data.coverage.total) * 100)}%).
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-3">
        {(
          [
            [1, "Tiến trình"],
            [2, "Điểm kiến thức"],
            [3, "Ma trận"],
            [4, "Tiến bộ"],
            [5, "Tiêu chí đánh giá"],
            [6, "Trợ lý AI"],
          ] as const
        ).map(([n, label]) => (
          <button
            key={n}
            type="button"
            onClick={() => setScreen(n)}
            className={cn(
              "shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
              screen === n ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {screen === 1 ? (
          <Screen1 data={data} />
        ) : data.coverage.attached === 0 ? (
          // Cửa chưa-gắn (chốt 28/10): chưa câu nào gắn vào điểm nào thì Màn 2–5
          // không hiện số liệu mà hiện thông báo này (thay cho dòng "Chưa có dữ liệu").
          // Giáo viên gắn thêm câu → lần tải lại thống kê sau (mở tab hoặc polling 30s)
          // có attached > 0 thì cửa tự mở, hiện đủ các màn.
          <p className="rounded-lg bg-yellow-100 p-3 text-sm text-yellow-900">
            Giáo viên chưa gắn câu trắc nghiệm vào điểm kiến thức thì kết quả thống kê không chính xác
          </p>
        ) : screen === 2 ? (
          <Screen2
            data={data}
            namesByKpLevel={namesByKpLevel}
            expandedKp={expandedKp}
            onToggleKp={(id) => setExpandedKp((cur) => (cur === id ? null : id))}
            onShowTooltip={showTooltip}
            onClearTooltip={() => setTooltip(null)}
          />
        ) : screen === 3 ? (
          <Screen3
            data={data}
            onlyWeak={onlyWeak}
            onToggleOnlyWeak={() => setOnlyWeak((v) => !v)}
            matrixMode={matrixMode}
            onMatrixMode={setMatrixMode}
            matrixGroup={matrixGroup}
            onMatrixGroup={setMatrixGroup}
            cellDetail={cellDetail}
            onCellDetail={setCellDetail}
            profileId={profileId}
            onProfile={setProfileId}
            onShowTooltip={showTooltip}
            onClearTooltip={() => setTooltip(null)}
          />
        ) : screen === 4 ? (
          <Screen4 data={data} onShowTooltip={showTooltip} onClearTooltip={() => setTooltip(null)} />
        ) : screen === 5 ? (
          <Screen5 data={data} />
        ) : (
          <Screen6 data={data} />
        )}
      </div>

      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-lg border border-border bg-popover p-3 text-xs shadow-lg"
          style={{ left: Math.min(tooltip.x, window.innerWidth - 280), top: tooltip.y }}
        >
          <p className="font-semibold text-foreground">{tooltip.title}</p>
          {tooltip.lines.map((line, i) => (
            <p key={i} className="mt-0.5 text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  )
}

// ================= Màn 1 — Tiến trình =================

function Screen1({ data }: { data: LessonStatsDto }) {
  const o = data.overview
  const weakest = o.weakestKp
  const overdueCount = data.students.filter((s) => s.deadlineBadge === "Quá hạn").length
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <p className="text-xs text-muted-foreground">Đã nộp kiểm tra</p>
          <p className="mt-1 font-heading text-xl font-bold tabular-nums text-foreground">
            {o.submittedCount}/{o.classSize}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <p className="text-xs text-muted-foreground">Điểm kiểm tra TB (thang 10, lượt đầu → gần nhất)</p>
          <p className="mt-1 font-heading text-xl font-bold tabular-nums text-foreground">
            {o.avgFirst10 != null && o.avgLatest10 != null ? `${o.avgFirst10} → ${o.avgLatest10}` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <p className="text-xs text-muted-foreground">Cần hỗ trợ</p>
          <p className="mt-1 font-heading text-xl font-bold tabular-nums text-foreground">{o.needsHelpCount} em</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <p className="text-xs text-muted-foreground">Điểm kiến thức yếu nhất</p>
          <p className="mt-1 font-heading text-sm font-bold text-foreground line-clamp-2">
            {weakest ? `${truncate(weakest.content, 80)} (${Math.round(weakest.weakRate * 100)}% Chưa tốt)` : "—"}
          </p>
        </div>
      </div>

      <p className="rounded-lg bg-secondary/40 p-3 text-sm text-foreground">{o.conclusion}</p>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Học sinh dừng ở bước nào</h3>
        <div className="flex flex-wrap gap-2">
          {data.stageDistribution.map((d) => (
            <span key={d.stage} className="rounded-full border border-border px-3 py-1 text-xs text-foreground">
              {d.label}: {d.count}
            </span>
          ))}
        </div>
        {overdueCount > 0 ? (
          <p className="mt-2 text-xs text-red-600">⚠ {overdueCount} em quá hạn vẫn chưa xong bài.</p>
        ) : null}
      </div>

      {data.students.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" aria-hidden="true" />}
          title="Chưa có học sinh"
          description="Chưa có học sinh nào tham gia lớp này."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Học sinh</th>
                <th className="pb-2 px-3 font-medium">
                  Tự nhận xét
                  <span className="mt-0.5 block font-normal">Xanh: Biết · Đỏ: Chưa biết · Xám: chưa đánh giá</span>
                </th>
                <th className="pb-2 px-3 font-medium">
                  Điền khuyết
                  <span className="mt-0.5 block font-normal">Xanh: đúng ngay lần đầu · Đỏ: sai lần đầu · Xám: chưa làm</span>
                </th>
                <th className="pb-2 px-3 font-medium">
                  Kéo thả
                  <span className="mt-0.5 block font-normal">Xanh: đúng ngay lần đầu · Đỏ: sai lần đầu · Xám: chưa làm</span>
                  <span className="mt-0.5 block font-normal text-red-600">
                    Gồm điểm kiến thức chưa biết từ đầu và điểm kiến thức chuyển từ điền khuyết
                  </span>
                </th>
                <th className="pb-2 px-3 font-medium">
                  Kiểm tra
                  <span className="mt-0.5 block font-normal">Số ô đã nộp / tổng số ô</span>
                </th>
                <th className="pb-2 pl-3 font-medium">Số lần làm lại</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.studentId} className="border-b border-border/60 align-top last:border-0">
                  <td className="py-3 pr-3">
                    <span className="font-medium text-foreground">{s.name}</span>
                    {s.deadlineBadge ? (
                      <span
                        className={cn(
                          "ml-2 rounded-full px-2 py-0.5 text-xs",
                          s.deadlineBadge === "Đúng hạn" && "bg-green-100 text-green-800",
                          s.deadlineBadge === "Trễ" && "bg-yellow-100 text-yellow-800",
                          s.deadlineBadge === "Quá hạn" && "bg-red-100 text-red-800",
                          s.deadlineBadge === "Đang làm" && "bg-blue-100 text-blue-800",
                        )}
                      >
                        {s.deadlineBadge}
                      </span>
                    ) : null}
                    {s.needsHelp ? (
                      <span className="mt-1 block text-xs text-red-600">
                        ⚠ Cần hỗ trợ: {s.helpReasons.join("; ")}
                      </span>
                    ) : null}
                    {s.flags.length > 0 ? (
                      <span className="mt-1 block text-xs text-amber-700">⚑ {s.flags.join(" · ")}</span>
                    ) : null}
                  </td>
                  <td className="py-3 px-3">
                    <SplitBar
                      segments={[
                        { count: s.selfKnown, className: "bg-green-500", label: "Biết" },
                        { count: s.selfUnknown, className: "bg-red-500", label: "Chưa biết" },
                        {
                          count: Math.max(0, s.selfTotal - s.selfAssessed),
                          className: "bg-zinc-300 text-zinc-600",
                          label: "Chưa đánh giá",
                        },
                      ]}
                      tail={`${s.selfAssessed}/${s.selfTotal}`}
                    />
                  </td>
                  <td className="py-3 px-3">
                    {s.fillPool === 0 ? (
                      <span className="text-xs text-muted-foreground">Không có</span>
                    ) : (
                      <>
                        <SplitBar
                          segments={[
                            { count: s.fillGreen, className: "bg-green-500", label: "Đúng lần đầu" },
                            { count: s.fillRed, className: "bg-red-500", label: "Sai lần đầu" },
                            {
                              count: Math.max(0, s.fillPool - s.fillGreen - s.fillRed),
                              className: "bg-zinc-300 text-zinc-600",
                              label: "Chưa làm",
                            },
                          ]}
                          tail={`${s.fillEventual}/${s.fillPool}`}
                        />
                        {s.fillGreen + s.fillRed > 0 ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Đúng lần đầu: {s.fillGreen}/{s.fillGreen + s.fillRed} (
                            {Math.round((s.fillGreen / (s.fillGreen + s.fillRed)) * 100)}%)
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {s.dragPool === 0 ? (
                      !s.dragFinalized && s.fillPool > 0 ? (
                        <span className="text-xs text-zinc-400">chưa chốt</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Không có</span>
                      )
                    ) : (
                      <div className={!s.dragFinalized ? "opacity-60" : undefined}>
                        <SplitBar
                          segments={[
                            { count: s.dragGreen, className: "bg-green-500", label: "Đúng lần đầu" },
                            { count: s.dragRed, className: "bg-red-500", label: "Sai lần đầu" },
                            {
                              count: Math.max(0, s.dragPool - s.dragGreen - s.dragRed),
                              className: "bg-zinc-300 text-zinc-600",
                              label: "Chưa làm",
                            },
                          ]}
                          tail={`${s.dragEventual}/${s.dragPool}`}
                        />
                        {s.dragGreen + s.dragRed > 0 ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Đúng lần đầu: {s.dragGreen}/{s.dragGreen + s.dragRed} (
                            {Math.round((s.dragGreen / (s.dragGreen + s.dragRed)) * 100)}%)
                          </span>
                        ) : null}
                        {!s.dragFinalized ? (
                          <span className="mt-1 block text-xs text-zinc-400">chưa chốt</span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <SplitBar
                      segments={[
                        { count: s.quizCorrect, className: "bg-green-500", label: "Đúng" },
                        {
                          count: Math.max(0, s.quizAnswered - s.quizCorrect),
                          className: "bg-red-500",
                          label: "Sai",
                        },
                        {
                          count: Math.max(0, s.quizTotal - s.quizAnswered),
                          className: "bg-zinc-300 text-zinc-600",
                          label: "Chưa làm",
                        },
                      ]}
                      tail={`${s.quizCorrect}/${s.quizTotal} ô đúng${s.quizState === "doing" ? " (đang làm)" : ""}`}
                    />
                  </td>
                  <td className="py-3 pl-3 text-foreground">{s.retakesText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function QuestionStatLine({ q }: { q: QuestionStat }) {
  const typeLabel = q.type === "MC" ? "Trắc nghiệm" : q.type === "TF" ? "Đúng/Sai" : "Tự luận ngắn"
  const diffLabel =
    q.difficulty === "easy" ? "Dễ" : q.difficulty === "medium" ? "Vừa" : q.difficulty === "hard" ? "Khó" : null
  const discLabel =
    q.discrimination == null
      ? null
      : q.discrimination >= 0.3
        ? "Phân biệt tốt"
        : q.discrimination >= 0.1
          ? "Tạm"
          : "Kém"
  return (
    <div className="text-xs text-foreground">
      <p>
        <span className="font-semibold">
          Câu {q.questionNo} ({typeLabel})
        </span>
        {q.answered < 5 ? (
          <> — Chưa đủ dữ liệu ({q.answered}/5 em)</>
        ) : (
          <>
            {" "}
            — {Math.round(q.missRate * 100)}% sai ({q.totalSlots - q.correct}/{q.totalSlots} ô) · Độ khó: {diffLabel}
            {q.discrimination != null ? (
              <>
                {" "}
                · Phân biệt: {discLabel} ({q.discrimination >= 0 ? "+" : ""}
                {q.discrimination})
              </>
            ) : (
              <> · Phân biệt: Chưa đủ dữ liệu ({q.answered}/10 lượt)</>
            )}
            {q.medianSec != null ? <> · Trung vị {q.medianSec} giây/câu</> : null}
          </>
        )}
      </p>
      {q.type !== "SA" && q.answered >= 5 && q.options.length > 0 ? (
        <p className="mt-0.5 text-muted-foreground">
          {q.options
            .map(
              (o) => `${truncate(o.label, 30)}: ${Math.round(o.rate * 100)}%${q.type === "TF" ? " đúng" : ""} (${o.count})`,
            )
            .join(" · ")}
        </p>
      ) : null}
    </div>
  )
}

// ================= Màn 2 — Điểm kiến thức =================

function Screen2({
  data,
  namesByKpLevel,
  expandedKp,
  onToggleKp,
  onShowTooltip,
  onClearTooltip,
}: {
  data: LessonStatsDto
  namesByKpLevel: Map<string, Record<StatsLevel, string[]>>
  expandedKp: string | null
  onToggleKp: (id: string) => void
  onShowTooltip: (e: MouseEvent, title: string, lines: string[]) => void
  onClearTooltip: () => void
}) {
  const classSize = data.overview.classSize
  const commonQuestions = data.questionStats.filter((q) => q.kpId == null)
  return (
    <div className="flex flex-col gap-4">
      {data.kpStats.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Bài chưa có điểm kiến thức nào.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {data.kpStats.map((k) => {
            const names = namesByKpLevel.get(k.kpId)
            const expanded = expandedKp === k.kpId
            const kpQuestions = data.questionStats.filter((q) => q.kpId === k.kpId)
            return (
              <li key={k.kpId} className="rounded-lg border border-border p-4">
                <button type="button" onClick={() => onToggleKp(k.kpId)} className="w-full text-left">
                  <p className="text-sm text-foreground line-clamp-2">
                    <span className="font-semibold">Điểm kiến thức {k.kpNo}.</span> {k.content}
                  </p>
                </button>
                <p className="mt-1 flex flex-wrap gap-2 text-xs">
                  <span className="text-muted-foreground">{k.sourceTag}</span>
                  {k.noQuizQuestion ? (
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-700">Chưa có câu kiểm tra</span>
                  ) : null}
                  {k.fewQuestions ? (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-800">Ít câu</span>
                  ) : null}
                  {k.needsReview ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
                      Nên ôn lại cả lớp
                    </span>
                  ) : null}
                </p>
                <div className="mt-2 flex h-6 w-full overflow-hidden rounded-full bg-secondary">
                  {LEVEL_ORDER.map((level) => {
                    const count = k.counts[level]
                    if (count === 0 || classSize === 0) return null
                    const levelNames = names?.[level] ?? []
                    return (
                      <div
                        key={level}
                        className={cn("flex h-full items-center justify-center text-[11px] font-semibold text-white", LEVEL_BG[level])}
                        style={{ width: `${(count / classSize) * 100}%` }}
                        onMouseMove={(e) =>
                          onShowTooltip(e, `${LEVEL_LABEL[level]} — ${count} em`, [
                            levelNames.length > 0 ? levelNames.join(", ") : "Không có em nào",
                          ])
                        }
                        onMouseLeave={onClearTooltip}
                      >
                        {count}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Thành thạo {k.firstMastered} → {k.latestMastered} em{" "}
                    {k.latestMastered > k.firstMastered ? "▲" : k.latestMastered < k.firstMastered ? "▼" : "■"}
                  </span>
                  {k.fillFirstTry.total > 0 ? (
                    <span>
                      Điền khuyết đúng lần đầu: {k.fillFirstTry.correct}/{k.fillFirstTry.total}
                    </span>
                  ) : null}
                  {k.dragFirstTry.total > 0 ? (
                    <span>
                      Kéo thả đúng lần đầu: {k.dragFirstTry.correct}/{k.dragFirstTry.total}
                    </span>
                  ) : null}
                  {k.mostMissed ? (
                    <span>
                      Câu sai nhiều nhất: Câu {k.mostMissed.questionNo} —{" "}
                      {k.mostMissed.answeredCount < 5 ? (
                        <>Chưa đủ dữ liệu ({k.mostMissed.answeredCount}/5 em)</>
                      ) : (
                        <>
                          {Math.round(k.mostMissed.missRate * 100)}% sai ({k.mostMissed.wrongCount}/
                          {k.mostMissed.answeredCount})
                          {k.mostMissed.missRate >= 0.3 ? " · Nên xem lại câu hỏi" : ""}
                        </>
                      )}
                      {k.mostMissed.commonWrong && k.mostMissed.answeredCount >= 5
                        ? ` · Đáp án sai phổ biến: ${truncate(k.mostMissed.commonWrong, 40)}`
                        : ""}
                    </span>
                  ) : null}
                  <span>
                    Chủ quan sai: {k.overconfidentCount}/{k.knownAssessed} em tự nhận Biết
                  </span>
                  <span>Xem đáp án: {k.revealedCount} em</span>
                </div>
                {expanded ? (
                  <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3">
                    {LEVEL_ORDER.map((level) => {
                      const levelNames = names?.[level] ?? []
                      if (levelNames.length === 0) return null
                      return (
                        <p key={level} className="text-xs text-foreground">
                          <span className={cn("font-semibold", LEVEL_TEXT[level])}>
                            {LEVEL_LABEL[level]} ({levelNames.length}):
                          </span>{" "}
                          {levelNames.join(", ")}
                        </p>
                      )
                    })}
                    {kpQuestions.length > 0 ? (
                      <div className="mt-2 border-t border-border/60 pt-2">
                        <p className="mb-2 text-xs font-semibold text-foreground">Câu hỏi của điểm kiến thức này</p>
                        <div className="flex flex-col gap-2">
                          {kpQuestions.map((q) => (
                            <QuestionStatLine key={q.questionId} q={q} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {commonQuestions.length > 0 ? (
        <div className="rounded-lg border border-border p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            Câu hỏi chung của bài (chưa gắn vào điểm kiến thức)
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Các câu này chưa gắn vào điểm kiến thức nào nên không tính vào tầng của điểm nào; số liệu dưới đây để
            giáo viên xem lại câu hỏi.
          </p>
          <div className="flex flex-col gap-2">
            {commonQuestions.map((q) => (
              <QuestionStatLine key={q.questionId} q={q} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ================= Màn 3 — Ma trận =================

const CELL_SYMBOL: Record<StatsLevel, string> = {
  mastered: "✓",
  ok: "~",
  weak: "✗",
  unverified: "?",
  not_started: "·",
}

function Screen3({
  data,
  onlyWeak,
  onToggleOnlyWeak,
  matrixMode,
  onMatrixMode,
  matrixGroup,
  onMatrixGroup,
  cellDetail,
  onCellDetail,
  profileId,
  onProfile,
  onShowTooltip,
  onClearTooltip,
}: {
  data: LessonStatsDto
  onlyWeak: boolean
  onToggleOnlyWeak: () => void
  matrixMode: MatrixMode
  onMatrixMode: (m: MatrixMode) => void
  matrixGroup: number
  onMatrixGroup: (g: number) => void
  cellDetail: { studentId: string; kpId: string } | null
  onCellDetail: (d: { studentId: string; kpId: string } | null) => void
  profileId: string | null
  onProfile: (id: string | null) => void
  onShowTooltip: (e: MouseEvent, title: string, lines: string[]) => void
  onClearTooltip: () => void
}) {
  const allKps = data.matrixOrderedKps
  const groupCount = matrixMode === "groups" ? Math.max(1, Math.ceil(allKps.length / 10)) : 1
  const safeGroup = Math.min(matrixGroup, groupCount - 1)
  const visibleKps =
    matrixMode === "groups" ? allKps.slice(safeGroup * 10, safeGroup * 10 + 10) : allKps
  const kpNoById = new Map(allKps.map((kp, idx) => [kp.id, idx + 1]))

  const visibleStudents = onlyWeak
    ? data.students.filter((s) => s.weakCount > 0)
    : data.students

  const detailStudent = cellDetail ? data.rawStudents.find((r) => r.studentId === cellDetail.studentId) : undefined
  const detailRow = cellDetail ? data.students.find((r) => r.studentId === cellDetail.studentId) : undefined
  const detailKp = cellDetail ? allKps.find((k) => k.id === cellDetail.kpId) : undefined
  const detailCell = cellDetail ? data.matrixCells[cellDetail.studentId]?.[cellDetail.kpId] : undefined

  const profileRow = profileId ? data.students.find((r) => r.studentId === profileId) : undefined
  const profileGroups = profileRow
    ? {
        weak: allKps.filter((kp) => profileRow.tiersByKp[kp.id]?.level === "weak"),
        ok: allKps.filter((kp) => profileRow.tiersByKp[kp.id]?.level === "ok"),
        mastered: allKps.filter((kp) => profileRow.tiersByKp[kp.id]?.level === "mastered"),
        other: allKps.filter((kp) => {
          const level = profileRow.tiersByKp[kp.id]?.level
          return level === "unverified" || level === "not_started"
        }),
      }
    : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={onlyWeak} onChange={onToggleOnlyWeak} />
          Chỉ em còn điểm kiến thức đỏ
        </label>
        <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
        {(
          [
            ["compact", "Thu gọn"],
            ["detail", "Chi tiết"],
            ["groups", "Nhóm 10"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              onMatrixMode(mode)
              onMatrixGroup(0)
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              matrixMode === mode ? "border-primary text-primary" : "border-border text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
        {matrixMode === "groups" && groupCount > 1 ? (
          <span className="flex items-center gap-1 text-xs">
            <button
              type="button"
              disabled={safeGroup === 0}
              onClick={() => onMatrixGroup(safeGroup - 1)}
              className="rounded-md border border-border px-2 py-1 disabled:opacity-50"
            >
              ←
            </button>
            <span className="text-muted-foreground">
              Nhóm {safeGroup + 1}/{groupCount}
            </span>
            <button
              type="button"
              disabled={safeGroup >= groupCount - 1}
              onClick={() => onMatrixGroup(safeGroup + 1)}
              className="rounded-md border border-border px-2 py-1 disabled:opacity-50"
            >
              →
            </button>
          </span>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Cột xếp theo độ khó giảm dần (Điểm kiến thức 1 khó nhất). Rê chuột lên tên điểm kiến thức để xem toàn bộ nội dung. Ô gạch
        chéo là điểm kiến thức chưa có câu kiểm tra. Bấm vào một ô để xem chi tiết; bấm tên học sinh để xem hồ sơ.
      </p>

      {visibleStudents.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Không có học sinh nào khớp bộ lọc.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card pb-2 pr-3 font-medium">Học sinh</th>
                {visibleKps.map((kp) => (
                  <th
                    key={kp.id}
                    className="cursor-help px-2 pb-2 text-center font-medium"
                    title={kp.content}
                    onMouseMove={(e) => onShowTooltip(e, `Điểm kiến thức ${kpNoById.get(kp.id)}`, [kp.content])}
                    onMouseLeave={onClearTooltip}
                  >
                    Điểm kiến thức {kpNoById.get(kp.id)}
                  </th>
                ))}
                <th className="pb-2 pl-3 font-medium">Tổng kết</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((s) => {
                const cells = data.matrixCells[s.studentId] ?? {}
                const mastered = allKps.filter((kp) => cells[kp.id]?.level === "mastered").length
                const weak = allKps.filter((kp) => cells[kp.id]?.level === "weak").length
                return (
                  <tr key={s.studentId} className="border-b border-border/60 last:border-0">
                    <td className="sticky left-0 z-10 bg-card py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => onProfile(profileId === s.studentId ? null : s.studentId)}
                        className="font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {s.name}
                      </button>
                    </td>
                    {visibleKps.map((kp) => {
                      const cell = cells[kp.id]
                      if (!cell) return <td key={kp.id} className="px-2 py-2 text-center text-muted-foreground">·</td>
                      const hatched = cell.hatched
                      return (
                        <td key={kp.id} className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => onCellDetail({ studentId: s.studentId, kpId: kp.id })}
                            className={cn(
                              "inline-flex min-w-9 flex-col items-center rounded px-1 py-1",
                              cell.level === "mastered" && "bg-green-100 text-green-800",
                              cell.level === "ok" && "bg-yellow-100 text-yellow-800",
                              cell.level === "weak" && "bg-red-100 text-red-800",
                              cell.level === "unverified" && "bg-zinc-100 text-zinc-600",
                              cell.level === "not_started" && "text-zinc-400",
                            )}
                            style={
                              hatched
                                ? {
                                    backgroundImage:
                                      "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.06) 4px, rgba(0,0,0,0.06) 8px)",
                                  }
                                : undefined
                            }
                            title={
                              hatched
                                ? "Chưa có câu kiểm tra"
                                : `${LEVEL_LABEL[cell.level]}${cell.flags.length > 0 ? ` (${cell.flags.join(", ")})` : ""}`
                            }
                          >
                            <span className="text-sm font-semibold">
                              {CELL_SYMBOL[cell.level]}
                              {matrixMode !== "compact" && cell.source ? (
                                <span className="ml-0.5 text-[10px] font-normal">{cell.source}</span>
                              ) : null}
                            </span>
                            {matrixMode !== "compact" && cell.source === "Q" && cell.quizTotal != null ? (
                              <span className="text-[10px]">
                                {cell.quizCorrect ?? 0}/{cell.quizTotal} ô
                              </span>
                            ) : null}
                            {matrixMode !== "compact" && cell.flags.length > 0 ? (
                              <span className="text-[10px] text-muted-foreground">{cell.flags.join(" · ")}</span>
                            ) : null}
                          </button>
                        </td>
                      )
                    })}
                    <td className="py-2 pl-3 text-xs text-muted-foreground">
                      Thành thạo {mastered}/{allKps.length} · Chưa tốt {weak}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {cellDetail && detailStudent && detailRow && detailKp && detailCell ? (
        <div className="rounded-lg border border-border bg-secondary/40 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Chi tiết ô: {detailRow.name} — Điểm kiến thức {kpNoById.get(detailKp.id)}
            </h3>
            <button type="button" onClick={() => onCellDetail(null)} className="text-xs text-muted-foreground">
              Đóng
            </button>
          </div>
          <p className="mt-1 text-sm text-foreground">{detailKp.content}</p>
          <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            <span>
              Mức: {LEVEL_LABEL[detailCell.level]} (nguồn {detailCell.source ?? "—"})
              {detailCell.source === "Q" && detailCell.quizTotal != null
                ? ` · Quiz: ${detailCell.quizCorrect ?? 0}/${detailCell.quizTotal} ô`
                : ""}
            </span>
            {detailCell.flags.length > 0 ? <span>Cờ: {detailCell.flags.join(" · ")}</span> : null}
            {(() => {
              const prog = detailStudent.progressByKp[detailKp.id]
              if (!prog) return null
              return (
                <>
                  <span>
                    Tự nhận xét: {prog.self === "known" ? "Biết" : prog.self === "unknown" ? "Chưa biết" : "—"}
                  </span>
                  <span>
                    Điền khuyết: {prog.fill.status ?? "chưa làm"}
                    {prog.fill.firstTry ? ` (lần đầu: ${prog.fill.firstTry === "correct" ? "đúng" : "sai"})` : ""}
                    {prog.fill.attempts > 0 ? ` · ${prog.fill.attempts} lần thử` : ""}
                    {prog.fill.revealed ? " · đã xem đáp án" : ""}
                  </span>
                  <span>
                    Kéo thả: {prog.drag.status ?? "chưa làm"}
                    {prog.drag.firstTry ? ` (lần đầu: ${prog.drag.firstTry === "correct" ? "đúng" : "sai"})` : ""}
                    {prog.drag.attempts > 0 ? ` · ${prog.drag.attempts} lần thử` : ""}
                    {prog.drag.revealed ? " · đã xem đáp án" : ""}
                  </span>
                </>
              )
            })()}
            <span>
              Từng lượt kiểm tra:{" "}
              {detailStudent.submittedAttempts.length === 0
                ? "chưa nộp lượt nào"
                : detailStudent.submittedAttempts
                    .map((a) => {
                      const slots = a.slotsByKp[detailKp.id]
                      return slots ? `${slots.correct}/${slots.total} ô` : "không có câu của điểm kiến thức này"
                    })
                    .join(" · ")}
            </span>
          </div>
        </div>
      ) : null}

      {profileRow && profileGroups ? (
        <div className="rounded-lg border border-border bg-secondary/40 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Hồ sơ: {profileRow.name}</h3>
            <button type="button" onClick={() => onProfile(null)} className="text-xs text-muted-foreground">
              Đóng
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-2 text-sm">
            {(
              [
                ["Cần ôn lại", profileGroups.weak, "text-red-600"],
                ["Khá", profileGroups.ok, "text-yellow-700"],
                ["Thành thạo", profileGroups.mastered, "text-green-700"],
              ] as const
            ).map(([label, list, className]) => (
              <p key={label} className="text-foreground">
                <span className={cn("font-semibold", className)}>
                  {label} ({list.length}):
                </span>{" "}
                {list.length === 0
                  ? "—"
                  : list.map((kp) => `Điểm kiến thức ${kpNoById.get(kp.id)}`).join(", ")}
              </p>
            ))}
            <p className="text-xs text-muted-foreground">
              Chưa kiểm chứng / Chưa làm: {profileGroups.other.length} điểm kiến thức.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ================= Màn 4 — Tiến bộ =================

function MiniLineChart({ data }: { data: LessonStatsDto }) {
  const points = data.chart
  const W = 640
  const H = 240
  const padL = 40
  const padR = 20
  const padT = 20
  const padB = 44
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const x = (i: number) => (points.length <= 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW)
  const y = (score: number) => padT + (1 - score / 10) * plotH
  const line = (key: "firstAvg10" | "latestAvg10") =>
    points
      .map((p, i) => (p[key] == null ? null : `${x(i)},${y(p[key]!)}`))
      .filter((v): v is string => v != null)
      .join(" ")
  if (points.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chưa có bài nào để vẽ biểu đồ.</p>
  }
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" role="img" aria-label="Điểm trung bình lớp theo bài">
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#e4e4e7" strokeWidth={1} />
            <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#71717a">
              {v}
            </text>
          </g>
        ))}
        <polyline points={line("firstAvg10")} fill="none" stroke="#a1a1aa" strokeWidth={2} strokeDasharray="5 4" />
        <polyline points={line("latestAvg10")} fill="none" stroke="#16a34a" strokeWidth={2} />
        {points.map((p, i) => (
          <g key={p.lessonId}>
            {p.firstAvg10 != null ? <circle cx={x(i)} cy={y(p.firstAvg10)} r={4} fill="#a1a1aa" /> : null}
            {p.latestAvg10 != null ? <circle cx={x(i)} cy={y(p.latestAvg10)} r={4} fill="#16a34a" /> : null}
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#71717a">
              {truncate(p.title, 14)}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-zinc-400" /> Lượt đầu
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-green-600" /> Lượt gần nhất
        </span>
      </p>
    </div>
  )
}

const CLASSIFICATION_LABEL: Record<string, string> = {
  improving: "Tiến bộ",
  stable_good: "Ổn định tốt",
  stuck: "Ôn lại nhưng chưa tiến bộ",
  abandoned: "Bỏ dở",
  not_started: "Chưa bắt đầu",
  no_quiz: "—",
}

function Screen4({
  data,
  onShowTooltip,
  onClearTooltip,
}: {
  data: LessonStatsDto
  onShowTooltip: (e: MouseEvent, title: string, lines: string[]) => void
  onClearTooltip: () => void
}) {
  const namesByClass = new Map<string, string[]>()
  for (const row of data.progressTable) {
    const arr = namesByClass.get(row.classification) ?? []
    arr.push(row.name)
    namesByClass.set(row.classification, arr)
  }
  // Phân tán điểm + học được trong buổi (tính từ hàng học sinh, không đổi DTO).
  const latestScores = data.students.map((s) => s.latestScore10).filter((v): v is number => v != null)
  const scoreSpread =
    latestScores.length > 0
      ? {
          min: Math.min(...latestScores),
          max: Math.max(...latestScores),
          std: (() => {
            const mean = latestScores.reduce((a, b) => a + b, 0) / latestScores.length
            const variance =
              latestScores.reduce((a, b) => a + (b - mean) * (b - mean), 0) / latestScores.length
            return Math.sqrt(variance).toFixed(1)
          })(),
        }
      : null
  const inSessionTransferred = data.students.reduce((a, s) => a + s.inSessionTransferred, 0)
  const inSessionLearned = data.students.reduce((a, s) => a + s.inSessionLearned, 0)
  const submittedTotals = data.students.filter((s) => s.quizState === "done").map((s) => s.quizTotal)
  const samePaper = submittedTotals.length > 0 && submittedTotals.every((t) => t === submittedTotals[0])
  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-lg bg-secondary/40 p-3 text-sm text-muted-foreground">
        Cách đọc: “Điểm từng lượt” là điểm thang 10 các lượt kiểm tra đã nộp, theo thứ tự nộp. “Mức điểm
        (đầu → gần nhất)” đếm số điểm kiến thức có mức tăng (▲), giữ nguyên (■), giảm (▼) giữa lượt đầu và lượt
        gần nhất. Rê chuột lên chip phân loại để xem đủ tên học sinh trong nhóm.
      </p>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Điểm trung bình lớp theo bài (thang 10)</h3>
        <MiniLineChart data={data} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <h4 className="text-sm font-semibold text-foreground">Tiến bộ nhất</h4>
          {data.mostImproved.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Chưa có điểm kiến thức nào tăng số em Thành thạo.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1 text-xs text-foreground">
              {data.mostImproved.map((m) => (
                <li key={m.kpNo}>
                  Điểm kiến thức {m.kpNo}: +{m.delta} em Thành thạo
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border p-3">
          <h4 className="text-sm font-semibold text-foreground">Thụt lùi nhất</h4>
          {data.leastImproved.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Không có điểm kiến thức nào giảm số em Thành thạo.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1 text-xs text-foreground">
              {data.leastImproved.map((m) => (
                <li key={m.kpNo}>
                  Điểm kiến thức {m.kpNo}: {m.delta} em Thành thạo
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border p-3">
          <h4 className="text-sm font-semibold text-foreground">Yếu kéo dài (yếu từ 2 lượt trở lên)</h4>
          {data.persistentWeak.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Không có điểm kiến thức yếu kéo dài.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1 text-xs text-foreground">
              {data.persistentWeak.map((m) => (
                <li key={m.kpNo}>
                  Điểm kiến thức {m.kpNo}: {m.studentCount} em
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {scoreSpread || inSessionTransferred > 0 ? (
        <p className="text-sm text-foreground">
          {scoreSpread
            ? `Điểm dao động (lượt gần nhất): ${scoreSpread.min} – ${scoreSpread.max} (lệch chuẩn ${scoreSpread.std})${samePaper ? " — cả lớp cùng bộ câu hỏi" : ""}. `
            : ""}
          {inSessionTransferred > 0
            ? `Học được trong buổi: ${inSessionLearned}/${inSessionTransferred} điểm kiến thức chuyển từ điền khuyết sang kéo thả đã lên Khá/Thành thạo.`
            : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {["improving", "stable_good", "stuck", "abandoned", "not_started"].map((c) => {
          const names = namesByClass.get(c) ?? []
          if (names.length === 0) return null
          return (
            <span
              key={c}
              className="cursor-help rounded-full border border-border px-3 py-1 text-xs text-foreground"
              onMouseMove={(e) =>
                onShowTooltip(e, `${CLASSIFICATION_LABEL[c]} — ${names.length} em`, [names.join(", ")])
              }
              onMouseLeave={onClearTooltip}
            >
              {CLASSIFICATION_LABEL[c]} ({names.length})
            </span>
          )
        })}
      </div>

      {data.progressTable.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Chưa có học sinh nào.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Học sinh</th>
                <th className="pb-2 px-3 font-medium">Phân loại</th>
                <th className="pb-2 px-3 font-medium">Điểm từng lượt</th>
                <th className="pb-2 px-3 font-medium">Mức điểm (đầu → gần nhất)</th>
                <th className="pb-2 px-3 font-medium">Ngày học gần nhất</th>
                <th className="pb-2 pl-3 font-medium">Nhận xét tự sinh</th>
              </tr>
            </thead>
            <tbody>
              {data.progressTable.map((r) => {
                const noScores = r.classification === "abandoned" || r.classification === "not_started"
                return (
                  <tr key={r.studentId} className="border-b border-border/60 align-top last:border-0">
                    <td className="py-3 pr-3 font-medium text-foreground">{r.name}</td>
                    <td className="py-3 px-3 text-foreground">{CLASSIFICATION_LABEL[r.classification] ?? "—"}</td>
                    <td className="py-3 px-3 text-foreground">
                      {noScores || !r.hasScores ? "—" : r.scores10.join(" → ")}
                    </td>
                    <td className="py-3 px-3 text-foreground">
                      {noScores ? "—" : `▲${r.levelUp} ■${r.levelSame} ▼${r.levelDown}`}
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">{fmtDate(r.lastActivityAt)}</td>
                    <td className="py-3 pl-3 text-foreground">{r.note}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <h4 className="text-sm font-semibold text-foreground">Chuyên cần</h4>
          {data.attendance.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Chưa có học sinh nào.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1 text-xs text-foreground">
              {data.attendance.map((a) => (
                <li key={a.studentId}>
                  {a.name}: streak {a.streak} ngày
                  {a.longAbsent ? <span className="text-red-600"> · vắng dài (trên 7 ngày)</span> : ""}
                  {a.lastActivityAt == null ? <span className="text-muted-foreground"> · chưa hoạt động</span> : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border p-3">
          <h4 className="text-sm font-semibold text-foreground">Cờ chất lượng làm bài</h4>
          {data.qualityFlags.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Không có lượt nào làm quá nhanh (dưới 10 giây/câu) hay nhiều câu dưới 5 giây.
            </p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1 text-xs text-foreground">
              {data.qualityFlags.map((f, i) => (
                <li key={i}>
                  {f.studentName}: {f.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ================= Màn 5 — Tiêu chí đánh giá =================
// §41: bảng tra cứu toàn bộ luật tầng (24 dòng). Mỗi dòng là một trường
// hợp xảy ra và cách đánh giá của nó; nội dung bảng phải khớp
// tierForKp trong lib/lesson-stats.ts — sửa luật thì sửa cả bảng này.
// "Chuyển" = điểm Tab 1 tự nhận Biết nhưng điền sai chốt nên đánh giá
// lại thành Chưa biết, chuyển sang kéo thả.
const CRITERIA_A: [string, string, string, string, string][] = [
  ["Biết", "Đúng lần 1", "Không vào tab này", "Chưa hoàn thành", "Khá (F)"],
  ["Biết", "Đúng lần 2 (sau gợi ý)", "Không vào tab này", "Chưa hoàn thành", "Khá (F) · cờ “sau gợi ý”"],
  ["Biết", "Sai lần 1, đang chờ làm lại", "Chưa vào tab này", "Chưa hoàn thành", "Chưa kiểm chứng (F)"],
  ["Biết", "Sai chốt → chuyển", "Chưa kéo thả xong", "Chưa hoàn thành", "Chưa tốt (F)"],
  ["Biết", "Sai chốt → chuyển", "Đúng lần 1", "Chưa hoàn thành", "Khá (D) · cờ “đã chuyển”"],
  ["Biết", "Sai chốt → chuyển", "Đúng lần 2", "Chưa hoàn thành", "Chưa tốt (F) · cờ “đã chuyển”"],
  ["Biết", "Sai chốt → chuyển", "Sai (đã chốt)", "Chưa hoàn thành", "Chưa tốt (F) · cờ “đã chuyển”"],
  ["Biết", "Sai chốt → chuyển", "Sau khi đã xem đáp án", "Chưa hoàn thành", "Chưa tốt (D) · cờ “đã chuyển”"],
  ["Biết", "Chưa làm", "Chưa vào tab này", "Chưa hoàn thành", "Chưa kiểm chứng (S)"],
  ["Chưa biết", "Không vào tab này", "Đúng lần 1", "Chưa hoàn thành", "Khá (D)"],
  ["Chưa biết", "Không vào tab này", "Đúng lần 2 (sau 1 lần sai, chưa lộ)", "Chưa hoàn thành", "Khá (D)"],
  ["Chưa biết", "Không vào tab này", "Sai lần 1, đang chờ làm lại", "Chưa hoàn thành", "Chưa kiểm chứng (D)"],
  ["Chưa biết", "Không vào tab này", "Sai (đã chốt)", "Chưa hoàn thành", "Chưa tốt (D)"],
  ["Chưa biết", "Không vào tab này", "Sau khi đã xem đáp án", "Chưa hoàn thành", "Chưa tốt (D)"],
  ["Chưa tự nhận", "Chưa vào tab này", "Chưa vào tab này", "Chưa hoàn thành", "Chưa làm"],
]
const CRITERIA_B: [string, string, string, string, string][] = [
  ["Đã hoàn thành", "Đã hoàn thành", "Đã hoàn thành", "Đúng ≥ 75% và đủ ≥ 2 ô đúng", "Thành thạo (Q)"],
  ["Đã hoàn thành", "Đã hoàn thành", "Đã hoàn thành", "Đúng 50% đến dưới 75%", "Khá (Q)"],
  ["Đã hoàn thành", "Đã hoàn thành", "Đã hoàn thành", "Đúng dưới 50%", "Chưa tốt (Q)"],
  ["Biết", "Điền khuyết đúng (lần 1 hoặc sau gợi ý)", "Đã hoàn thành", "Quiz chỉ có 1 ô và đúng", "Thành thạo (Q) — vì đã có Biết + điền khuyết đúng làm bằng chứng, cộng 1 ô quiz đúng là đủ"],
  ["Biết", "Điền khuyết đúng (lần 1 hoặc sau gợi ý)", "Đã hoàn thành", "Quiz chỉ có 1 ô và sai", "Khá (Q) — Biết + điền khuyết đúng đỡ cho 1 ô quiz sai"],
  ["Chưa biết, chưa làm, hoặc đã chuyển", "Theo Tab 1", "Đã hoàn thành", "Quiz chỉ có 1 ô và đúng", "Khá (Q) — chỉ 1 ô đúng thì chưa đủ lên Thành thạo"],
  ["Đã hoàn thành", "Đã hoàn thành", "Đã xem đáp án kéo thả", "Đúng 100% và đủ ≥ 2 ô đúng", "Thành thạo (Q)"],
  ["Đã hoàn thành", "Đã hoàn thành", "Đã xem đáp án kéo thả", "Đúng từ 50% (trừ dòng 7)", "Khá (Q)"],
  ["Đã hoàn thành", "Đã hoàn thành", "Đã xem đáp án kéo thả", "Đúng dưới 50%", "Chưa tốt (Q)"],
]

function Screen5({ data }: { data: LessonStatsDto }) {
  const rows = [...CRITERIA_B, ...CRITERIA_A]
  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Thứ bậc bằng chứng: </span>
          Q (trắc nghiệm) &gt; F (điền khuyết) &gt; D (kéo thả) &gt; S (tự nhận). Khi một điểm kiến thức có nhiều loại
          bằng chứng, loại đứng trước quyết định mức; chữ cái trong ô ma trận cho biết nguồn nào đã quyết định.
        </p>
      </div>
      <p className="text-sm font-semibold text-red-600">tiêu chí đánh giá chỉ đúng khi câu hỏi trắc nghiệm đã gắn vào các điểm kiến thức</p>
      <p className="text-sm text-muted-foreground">Bảng mô tả luồng chuẩn Tab 1 → Tab 2 → Tab 3 → Tab 4: mỗi dòng là trạng thái của học sinh ở từng tab và mức tương ứng.</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-2 py-2 font-medium">STT</th>
              <th className="px-2 py-2 font-medium">Tab 1</th>
              <th className="px-2 py-2 font-medium">Tab 2</th>
              <th className="px-2 py-2 font-medium">Tab 3</th>
              <th className="px-2 py-2 font-medium">Tab 4</th>
              <th className="px-2 py-2 font-medium">Đánh giá</th>
            </tr>
          </thead>
                    <tbody>
            <tr className="border-b border-border bg-muted/30">
              <td colSpan={6} className="px-2 py-1.5 text-xs font-semibold text-foreground">
                Có trắc nghiệm
                <br />
                <span className="font-normal text-muted-foreground">
                  Xét dòng đặc biệt (4–9) trước; dòng 1–3 chỉ dùng khi không thuộc dòng đặc biệt.
                </span>
              </td>
            </tr>
            {CRITERIA_B.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                <td className="px-2 py-1.5">{r[0]}</td>
                <td className="px-2 py-1.5">{r[1]}</td>
                <td className="px-2 py-1.5">{r[2]}</td>
                <td className="px-2 py-1.5">{r[3]}</td>
                <td className="px-2 py-1.5 font-medium">{r[4]}</td>
              </tr>
            ))}
            <tr className="border-b border-border bg-muted/30">
              <td colSpan={6} className="px-2 py-1.5 text-xs font-semibold text-foreground">
                Nếu học sinh chưa hoàn thành tab trắc nghiệm
              </td>
            </tr>
            {CRITERIA_A.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-2 py-1.5 text-muted-foreground">{CRITERIA_B.length + i + 1}</td>
                <td className="px-2 py-1.5">{r[0]}</td>
                <td className="px-2 py-1.5">{r[1]}</td>
                <td className="px-2 py-1.5">{r[2]}</td>
                <td className="px-2 py-1.5">{r[3]}</td>
                <td className="px-2 py-1.5 font-medium">{r[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Tổng cộng {rows.length} dòng.</p>
    </div>
  )
}

// ================= Màn 6 — Trợ lý AI (#1 bản tin, #11 hỏi đáp) =================

const AI_JOB_STATUS: Record<string, string> = {
  pending: "Đang chờ AI xử lý",
  detecting: "AI đang xử lý",
  processing: "AI đang viết",
  ready: "Đã xong",
  failed: "Không xử lý được",
}

function Screen6({ data }: { data: LessonStatsDto }) {
  const [jobs, setJobs] = useState<AiStatsJobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<"newsletter" | "qa" | null>(null)
  const [question, setQuestion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!data.lessonId) return
    try {
      setJobs(await listAiStatsJobs(data.classId, data.lessonId))
    } catch {
      // Tải lại lỗi (mạng chập chờn) thì giữ danh sách cũ.
    }
    setLoading(false)
  }, [data.classId, data.lessonId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const hasBusy = jobs.some((j) => j.status === "pending" || j.status === "processing")
  useEffect(() => {
    if (!hasBusy) return
    const t = setInterval(refresh, 15000)
    return () => clearInterval(t)
  }, [hasBusy, refresh])

  // Mã HS01.. trong số liệu ẩn danh theo đúng thứ tự học sinh của tab (tên A→Z);
  // bản AI viết chỉ có mã, panel đổi mã thành tên để giáo viên đọc cho tiện.
  const nameByCode = useMemo(() => {
    const m = new Map<string, string>()
    data.students.forEach((s, i) => m.set(`HS${String(i + 1).padStart(2, "0")}`, s.name))
    return m
  }, [data.students])
  const withNames = (text: string) => text.replace(/HS\d+/g, (code) => nameByCode.get(code) ?? code)

  const newsletters = jobs.filter((j) => j.kind === "newsletter")
  const qas = jobs.filter((j) => j.kind === "qa")
  const latestNewsletter = newsletters.find((j) => j.status === "ready")
  const busyNewsletter = newsletters.some((j) => j.status === "pending" || j.status === "processing")
  const olderNewsletters = newsletters.filter((j) => j.id !== latestNewsletter?.id)

  const createNewsletter = async () => {
    if (!data.lessonId || creating) return
    setCreating("newsletter")
    setError(null)
    try {
      await createAiStatsJob("newsletter", data.classId, data.lessonId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được việc")
    }
    setCreating(null)
  }

  const ask = async (q: string) => {
    if (!data.lessonId || creating || !q.trim()) return
    setCreating("qa")
    setError(null)
    try {
      await createAiStatsJob("qa", data.classId, data.lessonId, q.trim())
      setQuestion("")
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được việc")
    }
    setCreating(null)
  }

  const renderJobBody = (job: AiStatsJobRow) => {
    if (job.status === "ready" && job.resultText) {
      return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{withNames(job.resultText)}</p>
    }
    if (job.status === "failed") {
      return <p className="text-sm text-red-600">{job.error ?? "AI không xử lý được việc này."}</p>
    }
    return (
      <p className="text-sm text-muted-foreground">
        {AI_JOB_STATUS[job.status] ?? job.status}
        {job.stage ? ` — ${job.stage}` : ""}…
      </p>
    )
  }

  const fmtJobTime = (iso: string) =>
    new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

  if (!data.lessonId) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chưa chọn bài để thống kê.</p>
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground">
        Trợ lý AI chỉ đọc số liệu đã ẩn danh (học sinh chỉ còn mã HS01, HS02… theo thứ tự tên trong tab), không thấy
        tên thật; bản hiển thị dưới đây đã đổi mã thành tên để giáo viên dễ đọc. AI không chấm điểm, không đổi tầng
        của học sinh — chỉ viết bản tin và trả lời từ số liệu.
      </p>
      {error ? <p className="rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Bản tin lớp</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Tóm tắt tình hình lớp cho giáo viên: em nào cần hỗ trợ, điểm kiến thức nào yếu, câu nào nên xem lại.
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Đang tải…</p>
        ) : busyNewsletter ? (
          <p className="mt-3 text-sm text-muted-foreground">AI đang viết bản tin… (tự cập nhật khoảng 15 giây một lần)</p>
        ) : latestNewsletter ? (
          <div className="mt-3 rounded-lg bg-secondary/40 p-4">{renderJobBody(latestNewsletter)}</div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Chưa có bản tin nào cho bài này.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={createNewsletter}
            disabled={creating === "newsletter" || busyNewsletter}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {creating === "newsletter" ? "Đang tạo…" : latestNewsletter || busyNewsletter ? "Tạo bản tin mới" : "Tạo bản tin"}
          </button>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Làm mới
          </button>
        </div>
        {olderNewsletters.length > 0 ? (
          <div className="mt-4 border-t border-border/60 pt-3">
            <p className="mb-2 text-xs font-semibold text-foreground">Bản tin trước</p>
            <div className="flex flex-col gap-2">
              {olderNewsletters.map((job) => (
                <div key={job.id} className="rounded-lg bg-secondary/40 p-3">
                  <button
                    type="button"
                    onClick={() => setExpandedJob((cur) => (cur === job.id ? null : job.id))}
                    className="w-full text-left text-xs text-foreground"
                  >
                    <span className="font-semibold">{fmtJobTime(job.createdAt)}</span> ·{" "}
                    {AI_JOB_STATUS[job.status] ?? job.status}
                  </button>
                  {expandedJob === job.id ? <div className="mt-2">{renderJobBody(job)}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Hỏi đáp số liệu</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Hỏi về lớp, bài, điểm kiến thức, học sinh — AI trả lời từ số liệu, kèm con số cụ thể; chưa đủ dữ liệu thì
          nói rõ là chưa đủ, không đoán.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Điểm kiến thức nào yếu nhất?", "Em nào cần hỗ trợ?", "Câu nào nên xem lại?", "Lớp tiến bộ ra sao?"].map(
            (s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuestion(s)}
                className="rounded-full border border-border px-3 py-1 text-xs hover:bg-secondary"
              >
                {s}
              </button>
            ),
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask(question)
            }}
            placeholder="Vd: Điểm kiến thức nào yếu nhất?"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => ask(question)}
            disabled={creating === "qa" || !question.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {creating === "qa" ? "Đang gửi…" : "Hỏi"}
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {qas.map((job) => (
            <div key={job.id} className="rounded-lg bg-secondary/40 p-3">
              <p className="text-sm font-semibold text-foreground">{job.question ?? "Câu hỏi"}</p>
              <div className="mt-1">{renderJobBody(job)}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {AI_JOB_STATUS[job.status] ?? job.status} · {fmtJobTime(job.createdAt)}
              </p>
            </div>
          ))}
          {qas.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">Chưa có câu hỏi nào.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
