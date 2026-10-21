// SEC-06 (sualogic.md mục 12): chống DoS khi upload — duyệt entry zip
// trước khi xử lý, timeout phân tích 20s, Content-Length + rate limit ở route.
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

const JSZip = (await import("jszip")).default
const { assertDocxZipSafe, MAX_ZIP_ENTRIES, MAX_DOCUMENT_XML_SIZE, MAX_SINGLE_IMAGE_SIZE, MAX_IMAGE_COUNT } = await import("../lib/docx-omml.ts")

function fakeZip(entries) {
  // entries: [{name, size}] -> cấu trúc giống JSZip sau loadAsync
  const files = {}
  for (const e of entries) files[e.name] = { name: e.name, dir: false, _data: { uncompressedSize: e.size } }
  return { files }
}
function expectThrow(zip, label) {
  let threw = false
  try { assertDocxZipSafe(zip) } catch (e) { threw = String(e.message).includes("File tải lên bị từ chối:") }
  assert(threw, `zip guard không từ chối: ${label}`)
}

// File bình thường: qua
assertDocxZipSafe(fakeZip([
  { name: "word/document.xml", size: 100_000 },
  { name: "word/media/image1.png", size: 200_000 },
  { name: "[Content_Types].xml", size: 2000 },
]))
// Quá nhiều entry
expectThrow(fakeZip(Array.from({ length: MAX_ZIP_ENTRIES + 1 }, (_, i) => ({ name: `word/x${i}.xml`, size: 10 }))), ">2000 entry")
// document.xml quá lớn (zip bomb cổ điển)
expectThrow(fakeZip([{ name: "word/document.xml", size: MAX_DOCUMENT_XML_SIZE + 1 }]), "document.xml >20MB")
// Tổng giải nén quá lớn
expectThrow(fakeZip(Array.from({ length: 100 }, (_, i) => ({ name: `word/rels/r${i}.xml`, size: 600_000 }))), "tổng >50MB")
// Một ảnh quá lớn
expectThrow(fakeZip([{ name: "word/media/big.png", size: MAX_SINGLE_IMAGE_SIZE + 1 }]), "1 ảnh >5MB")
// Quá nhiều ảnh
expectThrow(fakeZip(Array.from({ length: MAX_IMAGE_COUNT + 1 }, (_, i) => ({ name: `word/media/i${i}.png`, size: 100 }))), ">200 ảnh")

// Zip thật nhỏ qua JSZip: guard không ném và preprocessOmml chạy được
const realZip = new JSZip()
realZip.file("word/document.xml", "<w:document></w:document>")
const buf = await realZip.generateAsync({ type: "nodebuffer" })
const loaded = await JSZip.loadAsync(buf)
assertDocxZipSafe(loaded)
const { preprocessOmml } = await import("../lib/docx-omml.ts")
const pre = await preprocessOmml(buf)
assert(Buffer.isBuffer(pre.buffer), "preprocessOmml với docx thường phải trả buffer")

// Timeout phân tích
const extractSrc = readSrc("lib/extract-file.ts")
assert(extractSrc.includes("EXTRACT_TIMEOUT_MS = 20_000"), "extract-file thiếu timeout 20s")
assert(extractSrc.includes("Promise.race"), "extract-file chưa bọc Promise.race cho timeout")

// Route: Content-Length trước khi đọc + 413 + rate limit 429
const validateRoute = readSrc("app/api/worksheet/validate/route.ts")
assert(validateRoute.includes('headers.get("content-length")'), "route validate chưa kiểm Content-Length")
assert(validateRoute.includes("status: 413"), "route validate chưa trả 413 khi vượt giới hạn")
assert(validateRoute.includes("hitRateLimit") && validateRoute.includes("status: 429"), "route validate chưa giới hạn tần suất upload")
assert(validateRoute.indexOf('headers.get("content-length")') < validateRoute.indexOf("req.formData()"), "kiểm Content-Length phải đứng TRƯỚC req.formData()")
const saveRoute = readSrc("app/api/worksheet/save/route.ts")
assert(saveRoute.includes('headers.get("content-length")') && saveRoute.includes("status: 413"), "route save chưa kiểm Content-Length/413")
assert(saveRoute.includes("hitRateLimit") && saveRoute.includes("status: 429"), "route save chưa giới hạn tần suất upload")

// bufferFromFormData có giới hạn cứng
const wsImport = readSrc("lib/worksheet-import.ts")
assert(wsImport.includes("file.size > MAX_FILE_SIZE"), "bufferFromFormData chưa chặn theo file.size")

console.log("PASS check-upload-guards (SEC-06)")
