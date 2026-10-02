import { readFileSync } from "node:fs"
import { atRiskRowClass, studentStatusLabel } from "../lib/class-stats-ui.ts"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(studentStatusLabel("not_started") === "Chưa làm", "not_started label")
assert(studentStatusLabel("in_progress") === "Đang làm", "in_progress label")
assert(studentStatusLabel("completed") === "Hoàn thành", "completed label")
assert(studentStatusLabel("overdue") === "Quá hạn", "overdue label")
assert(studentStatusLabel(undefined) === "Chưa làm", "thieu status")
assert(atRiskRowClass(true) === "bg-destructive/10", "atRisk tone")
assert(atRiskRowClass(false) === "", "khong atRisk khong to")
console.log("OK status/atRisk helpers")

const panel = readFileSync("components/teacher/class-stats-panel.tsx", "utf8")
assert(panel.includes("Hoàn thành"), "thieu the hoan thanh")
assert(panel.includes("Nắm vững"), "thieu the nam vung")
assert(panel.includes("Quiz TB"), "thieu the quiz TB")
assert(panel.includes("Trung vị"), "thieu the trung vi")
assert(panel.includes("Cần chú ý"), "thieu the can chu y")
assert(panel.includes("Tuần này"), "thieu the tuan nay")
assert(panel.includes("Theo bài giao"), "thieu khoi theo bai giao")
assert(panel.includes("Theo học sinh"), "thieu khoi theo hoc sinh")
assert(panel.includes("StatBar"), "thieu StatBar")
assert(panel.includes("TrendArrow"), "thieu TrendArrow")
assert(panel.includes("ArrowUp"), "thieu ArrowUp")
assert(panel.includes("ArrowDown"), "thieu ArrowDown")
assert(panel.includes("Minus"), "thieu Minus")
assert(panel.includes("atRiskRowClass"), "thieu to do atRisk")
assert(panel.includes("firstTryPercent"), "thieu cot firstTryPercent")
assert(panel.includes("hardFlag"), "thieu hardFlag")
assert(panel.includes("Đúng lần đầu"), "thieu nhan dung lan dau")
assert(panel.includes("Chưa có dữ liệu thống kê"), "thieu empty state")
console.log("OK class-stats-panel")

const tabs = readFileSync("components/teacher/class-tabs.tsx", "utf8")
assert(tabs.includes("ClassStatsPanel"), "tabs khong truyen ClassStatsPanel")
assert(tabs.includes("stats={stats}"), "tabs khong truyen stats")
console.log("OK class-tabs")

const page = readFileSync("app/teacher/classes/[id]/page.tsx", "utf8")
assert(page.includes("emptyClassStats"), "page fallback rong")
assert(page.includes("stats={stats}"), "page khong truyen stats")
console.log("OK page")

console.log("OK phien 5")
