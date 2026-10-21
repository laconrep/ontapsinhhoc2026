// SEC-02: quét lại bodyHtml ĐÃ LƯU trong DB bằng bộ lọc allowlist mới
// (lib/sanitize.ts) — dọn các payload XSS có thể đã lọt trước khi sửa.
//
// Cách dùng:
//   DATABASE_URL=<url> node scripts/resanitize-body-html.mjs            (mặc định --dry-run: chỉ liệt kê)
//   DATABASE_URL=<url> node scripts/resanitize-body-html.mjs --write    (ghi lại bản đã lọc)
//
// Mặc định DRY-RUN: in danh sách bản ghi (bảng, id) mà sanitize làm thay
// đổi nội dung, KHÔNG ghi DB. Hãy xem trước danh sách và đối chiếu mẫu
// (ảnh công thức/bảng hợp lệ phải giữ nguyên) rồi mới chạy --write.
// Không có DATABASE_URL -> in bỏ qua (giống các backfill khác).

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

const write = process.argv.includes("--write")
const url = process.env.DATABASE_URL
if (!url) {
  console.log("Khong co DATABASE_URL — bo qua resanitize bodyHtml")
  process.exit(0)
}

const { sanitizeBodyHtml } = await import("../lib/sanitize.ts")

const pg = await import("pg")
const Pool = pg.Pool ?? pg.default?.Pool ?? pg.default
const pool = new Pool({ connectionString: url })

const TARGETS = [
  { table: "questions", column: "bodyHtml" },
  { table: "question_options", column: "bodyHtml" },
]

try {
  let totalChanged = 0
  for (const { table, column } of TARGETS) {
    const { rows } = await pool.query(
      `SELECT id, "${column}" AS html FROM "${table}" WHERE "${column}" IS NOT NULL`,
    )
    let changed = 0
    for (const row of rows) {
      const clean = sanitizeBodyHtml(row.html)
      if (clean !== row.html) {
        changed += 1
        console.log(`[${table}] id=${row.id} sẽ bị thay đổi bởi sanitize`)
        if (write) {
          await pool.query(`UPDATE "${table}" SET "${column}" = $1 WHERE id = $2`, [
            clean,
            row.id,
          ])
        }
      }
    }
    console.log(`[${table}] ${rows.length} bản ghi có bodyHtml, ${changed} bản ghi bị thay đổi`)
    totalChanged += changed
  }
  console.log(
    write
      ? `Đã ghi lại ${totalChanged} bản ghi đã lọc.`
      : `DRY-RUN: ${totalChanged} bản ghi sẽ thay đổi. Chạy lại với --write để ghi.`,
  )
} finally {
  await pool.end()
}
