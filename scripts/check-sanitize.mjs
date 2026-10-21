// SEC-02 (sualogic.md mục 12): sanitize HTML bằng thư viện allowlist
// (server: sanitize-html qua lib/sanitize.ts; hiển thị: DOMPurify qua
// components/question/question-stem.tsx) — mọi payload tái hiện của spec
// phải cho đầu ra sạch; ảnh công thức và bảng hợp lệ còn nguyên.
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

function fail(msg) {
  console.error("THAT BAI:", msg)
  process.exit(1)
}
function assert(cond, msg) {
  if (!cond) fail(msg)
}
function readSrc(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

const { sanitizeBodyHtml } = await import("../lib/sanitize.ts")
const { SANITIZE_ALLOWED_TAGS, DATA_IMAGE_SRC_RE } = await import("../lib/sanitize-shared.ts")

const svgSrc =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" height="2ex" viewBox="0 -100 1000 2000"><path d="M0 0"/></svg>',
  ).toString("base64")
const pngSrc =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

// --- Payload từ mục tái hiện + nghiệm thu SEC-02 ---
const payloads = [
  "<p/onclick=alert(1)>x</p>",
  "<u/onmouseover=alert(1)>y</u>",
  "<table/onfocus=alert(1) tabindex=1><tr><td>a</td></tr></table>",
  '<p/style="animation:spin 1s"/onanimationstart=alert(document.domain)>z</p>',
  '<img src="//attacker.example/p.png">',
  "<P/ONCLICK=alert(1)>UP</P>",
  '<IMG SRC="https://evil.example/x.png" ONERROR="alert(1)">',
  "<svg onload=alert(1)></svg>",
  '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
  '<iframe src="https://evil.example"></iframe>',
  '<a href="javascript:alert(1)">click</a>',
  '<a href="https://example.com" onclick="alert(1)">link</a>',
  '<div onclick="alert(1)"><p>nested</p></div>',
  '<p title="&quot; onmouseover=&quot;alert(1)">entity</p>',
  '<img src="x" onerror="alert(1)">',
  '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">',
  '<table><tr><td style="background:url(javascript:alert(1))">c</td></tr></table>',
  "<script>alert(1)</script><p>ok</p>",
  '<p onanimationstart="alert(1)" style="animation-name:spin">s</p>',
  '<form action="javascript:alert(1)"><button>go</button></form>',
  '<math><mi//xlink:href="data:x,<script>alert(4)</script>">',
]
for (const p of payloads) {
  const out = sanitizeBodyHtml(p) ?? ""
  assert(!/\son[a-z]+\s*=/i.test(out), `payload còn thuộc tính on*: ${p} -> ${out}`)
  assert(!/javascript:/i.test(out), `payload còn javascript:: ${p} -> ${out}`)
  assert(!/<script/i.test(out), `payload còn <script: ${p} -> ${out}`)
  assert(!/<iframe/i.test(out), `payload còn <iframe: ${p} -> ${out}`)
  assert(!/<svg/i.test(out), `payload còn <svg: ${p} -> ${out}`)
  assert(!/<a[\s>]/i.test(out), `payload còn <a>: ${p} -> ${out}`)
  // style chỉ được phép là style do app tự sinh cho img.eq-inline
  const styles = out.match(/style="[^"]*"/gi) ?? []
  for (const st of styles) {
    assert(/^style="--eq-h:[\d.]+em;height:[\d.]+em;width:auto"$/.test(st), `style lạ trong đầu ra: ${st} (payload: ${p})`)
  }
  assert(!/src="(?!data:image\/)/i.test(out), `src lạ trong đầu ra: ${p} -> ${out}`)
}

// --- Nội dung hợp lệ phải còn nguyên ---
const eqImg = sanitizeBodyHtml(`<img src="${svgSrc}" class="eq-inline" alt="">`)
assert(eqImg && eqImg.includes(`src="${svgSrc}"`), "ảnh công thức eq-inline bị mất src")
assert(eqImg.includes('class="eq-inline"'), "ảnh công thức mất class eq-inline")
assert(/style="--eq-h:[\d.]+em;height:[\d.]+em;width:auto"/.test(eqImg), "ảnh eq-inline thiếu style chiều cao do app tính")

const bareSvg = sanitizeBodyHtml(`<img src="${svgSrc}">`)
assert(bareSvg && bareSvg.includes('class="eq-inline"'), "ảnh SVG không class phải được gán eq-inline như hành vi cũ")

const figure = sanitizeBodyHtml(`<img src="${pngSrc}" class="eq-figure" alt="hình">`)
assert(figure && figure.includes('class="eq-figure"') && figure.includes('alt="hình"'), "ảnh eq-figure hợp lệ bị hỏng")

const table = sanitizeBodyHtml(
  '<table><thead><tr><th colspan="2">H</th></tr></thead><tbody><tr><td rowspan="2">1</td><td>2</td></tr></tbody></table>',
)
assert(table && table.includes('colspan="2"') && table.includes('rowspan="2"'), "bảng hợp lệ mất colspan/rowspan")
assert(sanitizeBodyHtml('<td colspan="abc">x</td>')?.includes("<td>") ?? true, "colspan không phải số phải bị bỏ")

const text = sanitizeBodyHtml("<p>Câu hỏi có <u>gạch chân</u></p>")
assert(text && text.includes("<u>gạch chân</u>"), "thẻ u/p hợp lệ bị mất")

assert(sanitizeBodyHtml(null) === null && sanitizeBodyHtml("") === null, "null/rỗng phải trả null")
assert(DATA_IMAGE_SRC_RE.test(svgSrc) && DATA_IMAGE_SRC_RE.test(pngSrc), "regex data URI không khớp ảnh hợp lệ")
assert(!DATA_IMAGE_SRC_RE.test("//attacker.example/p.png"), "regex data URI vẫn cho //host")

// --- Phía hiển thị dùng DOMPurify + cùng allowlist dùng chung ---
const stem = readSrc("components/question/question-stem.tsx")
assert(stem.includes('from "dompurify"'), "question-stem.tsx chưa dùng dompurify")
assert(stem.includes("SANITIZE_ALLOWED_TAGS"), "question-stem.tsx chưa dùng allowlist dùng chung")
assert(!/function sanitizeStemHtml[\s\S]*?replace\(/.test(stem) || stem.includes("DOMPurify.sanitize"), "question-stem.tsx còn lọc bằng regex")
assert(SANITIZE_ALLOWED_TAGS.includes("table") && SANITIZE_ALLOWED_TAGS.includes("img"), "allowlist dùng chung thiếu thẻ")

// --- Đường ghi đều qua sanitize phía server ---
const questions = readSrc("app/actions/questions.ts")
assert((questions.match(/sanitizeBodyHtml\(/g) ?? []).length >= 4, "questions.ts chưa sanitize đủ các đường ghi bodyHtml")
const wsImport = readSrc("lib/worksheet-import.ts")
assert(wsImport.includes("sanitizeBodyHtml(pQ.bodyHtml)"), "worksheet-import chưa sanitize bodyHtml câu hỏi khi lưu")
assert(wsImport.includes("sanitizeBodyHtml(o.bodyHtml)"), "worksheet-import chưa sanitize bodyHtml lựa chọn khi lưu")
assert(wsImport.includes("MAX_MEDIA_ITEMS") && wsImport.includes("MAX_MEDIA_ITEM_LENGTH"), "parseMediaArray chưa giới hạn số phần tử/độ dài")

console.log("PASS check-sanitize (SEC-02)")
