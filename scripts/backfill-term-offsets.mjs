import { writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

function isWordChar(ch) {
  if (!ch) return false
  return /[\p{L}\p{N}_]/u.test(ch)
}

export function findWordBoundaryOccurrences(content, text) {
  const hits = []
  if (!text) return hits
  let from = 0
  while (from <= content.length) {
    const idx = content.indexOf(text, from)
    if (idx < 0) break
    const before = idx === 0 ? "" : content[idx - 1]
    const after = idx + text.length >= content.length ? "" : content[idx + text.length]
    if (!isWordChar(before) && !isWordChar(after)) {
      hits.push({ start: idx, end: idx + text.length })
    }
    from = idx + 1
  }
  return hits
}

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

export function assignOffsetsByWordBoundary(content, terms) {
  const next = terms.map((t) => ({ ...t }))
  const byText = new Map()
  for (const t of next) {
    const list = byText.get(t.text) ?? []
    list.push(t)
    byText.set(t.text, list)
  }
  let assigned = 0
  let unmatched = false
  for (const [text, group] of byText) {
    const hits = findWordBoundaryOccurrences(content, text)
    if (hits.length !== group.length) {
      unmatched = true
      continue
    }
    const ordered = [...group].sort((a, b) => a.slotIndex - b.slotIndex)
    for (let i = 0; i < ordered.length; i++) {
      ordered[i].start = hits[i].start
      ordered[i].end = hits[i].end
      assigned += 1
    }
  }
  return { terms: next, assigned, unmatched }
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
    console.log("Khong co DATABASE_URL — bo qua backfill")
    process.exit(0)
  }

  const pg = await import("pg")
  const Pool = pg.Pool ?? pg.default?.Pool ?? pg.default
  const pool = new Pool({ connectionString: url })
  try {
    const { rows } = await pool.query(`SELECT id, "lessonId", content, "underlinedTerms" FROM knowledge_points`)
    const review = []
    let updated = 0
    let skipped = 0
    for (const row of rows) {
      const terms = Array.isArray(row.underlinedTerms) ? row.underlinedTerms : []
      const content = typeof row.content === "string" ? row.content : ""
      if (terms.length === 0) {
        skipped += 1
        continue
      }
      if (terms.every((t) => offsetsValid(content, t))) {
        skipped += 1
        continue
      }
      const result = assignOffsetsByWordBoundary(content, terms)
      if (result.unmatched) {
        review.push({
          kpId: row.id,
          lessonId: row.lessonId,
          snippet: snippet(content),
        })
      }
      if (result.assigned > 0) {
        await pool.query(`UPDATE knowledge_points SET "underlinedTerms" = $1::jsonb WHERE id = $2`, [
          JSON.stringify(result.terms),
          row.id,
        ])
        updated += 1
      } else if (result.unmatched) {
        skipped += 1
      }
    }

    const outPath = process.argv[2]
      ? resolve(process.argv[2])
      : resolve(dirname(fileURLToPath(import.meta.url)), "needs-review-offsets.csv")
    const header = "kpId,lessonId,content snippet"
    const lines = [header, ...review.map((r) => [csvEscape(r.kpId), csvEscape(r.lessonId), csvEscape(r.snippet)].join(","))]
    if (review.length > 0) writeFileSync(outPath, lines.join("\n") + "\n", "utf8")

    console.log(`backfill xong: ${rows.length} KP, cap nhat ${updated}, bo qua ${skipped}, needsReview ${review.length}`)
    if (review.length > 0) console.log(`CSV: ${outPath}`)
  } finally {
    await pool.end()
  }
}
