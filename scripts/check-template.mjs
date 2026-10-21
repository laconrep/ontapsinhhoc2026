// Test BUG-03 (sualogic.md mục 11): hai file mẫu chính thức trong
// public/templates phải parse ra tài liệu HỢP LỆ (isValid = true) và mọi
// KP có ít nhất 1 ô trống — giáo viên làm đúng theo mẫu thì không bị chặn.
import { register } from "node:module"
import { pathToFileURL } from "node:url"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"

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

const { extractAndParse } = await import("../lib/extract-file.ts")
const { validateDocument } = await import("../lib/worksheet-parser.ts")

function fail(msg) {
  console.error("THAT BAI:", msg)
  process.exit(1)
}
function assert(cond, msg) {
  if (!cond) fail(msg)
}

for (const filename of ["mau-cau-hoi.txt", "mau-cau-hoi.docx"]) {
  const buffer = readFileSync(resolve(root, "public", "templates", filename))
  const { parseResult } = await extractAndParse(buffer, filename)
  const v = validateDocument(parseResult)
  assert(
    v.isValid,
    `BUG-03: ${filename} phải hợp lệ, lỗi: ${JSON.stringify(v.errors)}`,
  )
  const kps = parseResult.chapters.flatMap((c) =>
    c.lessons.flatMap((l) => l.knowledgePoints),
  )
  assert(kps.length > 0, `BUG-03: ${filename} phải có ít nhất 1 KP`)
  for (const kp of kps) {
    assert(
      kp.underlinedTerms.length >= 1,
      `BUG-03: ${filename} — KP "${kp.content.slice(0, 40)}" phải có ít nhất 1 ô trống`,
    )
  }
}

console.log("template OK")
