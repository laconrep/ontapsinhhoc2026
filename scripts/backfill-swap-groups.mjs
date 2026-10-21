// Backfill swapGroupId cho các KP đã import TRƯỚC khi SWAP_GROUP_JOIN_RE
// nhận "và"/"hoặc" có dấu (sualogic.md mục 10).
//
// Cách dùng: DATABASE_URL=... node scripts/backfill-swap-groups.mjs [csvPath]
// Không có DATABASE_URL -> in bỏ qua (giống backfill-term-offsets.mjs).
//
// Nguyên tắc (như phiên 2): KHÔNG đoán. Chỉ tính lại nhóm khi mọi term có
// start/end hợp lệ (content.slice(start, end) === text). KP nào thiếu/lệch
// offset -> ghi CSV needsReview để GV mở sửa và lưu lại (extractBlanks sẽ
// tính lại nhóm khi lưu), không tự sửa.

import { writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

// PHẢI khớp SWAP_GROUP_JOIN_RE trong lib/worksheet-parser.ts
export const SWAP_GROUP_JOIN_RE = /^\s*(?:(?:[,\/\-–→]|và|hoặc|va|hoac)\s*)*$/i
export const MAX_SWAP_GROUP_SIZE = 8

function offsetsValid(content, term) {
  return (
    typeof term.start === "number" &&
    typeof term.end === "number" &&
    Number.isInteger(term.start) &&
    Number.isInteger(term.end) &&
    term.start >= 0 &&
    term.end <= content.length &&
    term.end >= term.start &&
    content.slice(term.start, term.end) === term.text
  )
}

/** Tính lại swapGroupId từ content + terms đã có offset. Trả { terms, changed, unmatched }. */
export function recomputeSwapGroupIds(content, terms) {
  const ordered = [...terms].sort((a, b) => a.slotIndex - b.slotIndex)
  if (ordered.some((t) => t.allowSwap && !offsetsValid(content, t))) {
    return { terms, changed: false, unmatched: true }
  }
  const next = ordered.map((t) => ({ ...t }))
  let groupCounter = 0
  let currentGroup = null
  let currentGroupSize = 0
  let prevEnd = -1
  let prevWasSwap = false
  for (const t of next) {
    let swapGroupId = null
    if (t.allowSwap) {
      const between = prevEnd >= 0 ? content.slice(prevEnd, t.start) : "."
      const canJoin = prevWasSwap && currentGroup != null && SWAP_GROUP_JOIN_RE.test(between)
      if (canJoin && currentGroupSize < MAX_SWAP_GROUP_SIZE) {
        swapGroupId = currentGroup
        currentGroupSize += 1
      } else {
        groupCounter += 1
        currentGroup = `g${groupCounter}`
        swapGroupId = currentGroup
        currentGroupSize = 1
      }
    } else {
      currentGroup = null
      currentGroupSize = 0
    }
    t.swapGroupId = swapGroupId
    prevEnd = t.end
    prevWasSwap = Boolean(t.allowSwap)
  }
  // Nhóm 1 thành viên -> null (chấm như ô thường), như extractBlanks.
  const groupCount = new Map()
  for (const t of next) {
    if (t.swapGroupId) groupCount.set(t.swapGroupId, (groupCount.get(t.swapGroupId) ?? 0) + 1)
  }
  for (const t of next) {
    if (t.swapGroupId && (groupCount.get(t.swapGroupId) ?? 0) < 2) t.swapGroupId = null
  }
  const changed = next.some((t, i) => (t.swapGroupId ?? null) !== (ordered[i].swapGroupId ?? null))
  return { terms: next, changed, unmatched: false }
}

function csvEscape(value) {
  const s = String(value ?? "")
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function snippet(content) {
  return String(content ?? "").replace(/\s+/g, " ").trim().slice(0, 80)
}

const isMain =
  Boolean(process.argv[1]) && pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log("Khong co DATABASE_URL — bo qua backfill swap groups")
    process.exit(0)
  }

  const pg = await import("pg")
  const Pool = pg.Pool ?? pg.default?.Pool ?? pg.default
  const pool = new Pool({ connectionString: url })
  try {
    const { rows } = await pool.query(
      `SELECT id, "lessonId", content, "underlinedTerms" FROM knowledge_points`,
    )
    const review = []
    let updated = 0
    let skipped = 0
    for (const row of rows) {
      const terms = Array.isArray(row.underlinedTerms) ? row.underlinedTerms : []
      const content = typeof row.content === "string" ? row.content : ""
      if (terms.length === 0 || !terms.some((t) => t.allowSwap)) {
        skipped += 1
        continue
      }
      const result = recomputeSwapGroupIds(content, terms)
      if (result.unmatched) {
        review.push({ kpId: row.id, lessonId: row.lessonId, snippet: snippet(content) })
        skipped += 1
        continue
      }
      if (!result.changed) {
        skipped += 1
        continue
      }
      await pool.query(`UPDATE knowledge_points SET "underlinedTerms" = $1::jsonb WHERE id = $2`, [
        JSON.stringify(result.terms),
        row.id,
      ])
      updated += 1
    }

    const outPath = process.argv[2]
      ? resolve(process.argv[2])
      : resolve(dirname(fileURLToPath(import.meta.url)), "needs-review-swap-groups.csv")
    if (review.length > 0) {
      const lines = [
        "kpId,lessonId,content snippet",
        ...review.map((r) => [csvEscape(r.kpId), csvEscape(r.lessonId), csvEscape(r.snippet)].join(",")),
      ]
      writeFileSync(outPath, lines.join("\n") + "\n", "utf8")
    }

    console.log(
      `backfill swap groups xong: ${rows.length} KP, cap nhat ${updated}, bo qua ${skipped}, needsReview ${review.length}`,
    )
    if (review.length > 0) console.log(`CSV: ${outPath}`)
  } finally {
    await pool.end()
  }
}
