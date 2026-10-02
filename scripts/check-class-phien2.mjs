import { readFileSync } from "node:fs"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const actions = readFileSync("app/actions/assignments.ts", "utf8")
assert(actions.includes("export async function getAssignableLessons"), "thieu getAssignableLessons")
assert(actions.includes('eq(lessons.status, "ready")'), "getAssignableLessons khong loc ready")
console.log("OK getAssignableLessons")

const assignUi = readFileSync("components/teacher/class-assignments.tsx", "utf8")
assert(assignUi.includes('"use client"'), "class-assignments khong client")
assert(assignUi.includes("type=\"checkbox\""), "thieu checkbox")
assert(assignUi.includes("datetime-local"), "thieu dueAt datetime-local")
assert(assignUi.includes("assignLessons"), "thieu goi assignLessons")
assert(assignUi.includes("Giao bài giảng"), "thieu nut Giao bai giang")
assert(assignUi.includes("Sửa hạn"), "thieu menu Sua han")
assert(assignUi.includes("Thu hồi"), "thieu menu Thu hoi")
assert(assignUi.includes("bg-destructive"), "thieu badge qua han")
assert(assignUi.includes("amber"), "thieu badge sap het han")
console.log("OK class-assignments")

const tabs = readFileSync("components/teacher/class-tabs.tsx", "utf8")
assert(tabs.includes('"use client"'), "class-tabs khong client")
assert(tabs.includes("Tổng quan"), "thieu tab Tong quan")
assert(tabs.includes("Bài tập đã giao"), "thieu tab Bai tap da giao")
assert(tabs.includes("Thống kê"), "thieu tab Thong ke")
assert(tabs.includes("ClassAssignments"), "thieu ClassAssignments")
assert(tabs.includes("ClassStatsPanel"), "thieu ClassStatsPanel")
assert(tabs.includes("ClassDetail"), "thieu ClassDetail")
console.log("OK class-tabs")

const page = readFileSync("app/teacher/classes/[id]/page.tsx", "utf8")
assert(page.includes("getClassAssignments"), "page khong goi getClassAssignments")
assert(page.includes("ClassTabs"), "page khong dung ClassTabs")
assert(page.includes("SessionControl"), "page mat SessionControl")
assert(!page.includes("<ClassDetail"), "page van render ClassDetail truc tiep")
assert(!page.includes("<ClassStatsPanel"), "page van render ClassStatsPanel truc tiep")
console.log("OK page")

console.log("OK phien 2")
