// Backfill swapGroupId cho các KP đã import TRƯỚC khi SWAP_GROUP_JOIN_RE
// nhận "và"/"hoặc" có dấu (sualogic.md mục 10) và trước heuristic nhãn lặp
// (mục 11, BUG-04).
//
// Cách dùng:
//   DATABASE_URL=... node scripts/backfill-swap-groups.mjs [--dry-run] [csvPath]
// Không có DATABASE_URL -> in bỏ qua (giống backfill-term-offsets.mjs).
//
// --dry-run: chỉ in số KP sẽ cập nhật và vẫn xuất CSV needsReview, KHÔNG
// ghi DB. Hãy chạy dry-run, kiểm kết quả rồi mới chạy thật.
//
// Nguyên tắc (như phiên 2): KHÔNG đoán. swapGroupId được tính bằng ĐÚNG
// hàm assignSwapGroupIds của lib/worksheet-parser.ts (một nguồn sự thật
// duy nhất — trước đây script này chép tay regex nên dễ lệch). Chỉ tính
// lại khi mọi term có start/end hợp lệ (content.slice(start, end) ===
// text). KP nào thiếu/lệch offset -> ghi CSV needsReview để GV mở sửa và
// lưu lại (extractBlanks sẽ tính lại nhóm khi lưu), không tự sửa.

import { writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { register } from "node:module"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const rootUrl = pathToFileURL(root.endsWith("/") ? root : root + "/").href

const loader = `
export async function resolve(specifier, context, nextResolve) {
  let spec = specifier
  if (spec.startsWith("@/")) spec = ${JSON.stringify(rootUrl)} + spec.slice(2)
  try {
    return await nextResolve(spec, context)
  } catch (err) {
    if (typeof spec === "string" && !spec.endsWith(".ts") && (spec.startsWith(".") || spec.startsWith("file:"))) {
      return nextResolve(spec + ".ts", context)
    }
    throw err
  }
}
`

register("data:text/javascript," + encodeURIComponent(loader), import.meta.url)

const { assignSwapGroupIds, SWAP_GROUP_JOIN_RE, MAX_SWAP_GROUP_SIZE } = await import(
  "../lib/worksheet-parser.ts"
)

export { SWAP_GROUP_JOIN_RE, MAX_SWAP_GROUP_SIZE }

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
  assignSwapGroupIds(content, next)
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
  const argv = process.argv.slice(2)
  const dryRun = argv.includes("--dry-run")
  const csvArg = argv.find((a) => a !== "--dry-run")

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
      if (!dryRun) {
        await pool.query(`UPDATE knowledge_points SET "underlinedTerms" = $1::jsonb WHERE id = $2`, [
          JSON.stringify(result.terms),
          row.id,
        ])
      }
      updated += 1
    }

    const outPath = csvArg
      ? resolve(csvArg)
      : resolve(dirname(fileURLToPath(import.meta.url)), "needs-review-swap-groups.csv")
    if (review.length > 0) {
      const lines = [
        "kpId,lessonId,content snippet",
        ...review.map((r) => [csvEscape(r.kpId), csvEscape(r.lessonId), csvEscape(r.snippet)].join(",")),
      ]
      writeFileSync(outPath, lines.join("\n") + "\n", "utf8")
    }

    console.log(
      `backfill swap groups ${dryRun ? "(DRY-RUN — không ghi DB) " : ""}xong: ${rows.length} KP, ${dryRun ? "sẽ cập nhật" : "cap nhat"} ${updated}, bo qua ${skipped}, needsReview ${review.length}`,
    )
    if (review.length > 0) console.log(`CSV: ${outPath}`)
  } finally {
    await pool.end()
  }
}
