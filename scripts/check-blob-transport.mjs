import {
  BLOB_JSON_BODY_LIMIT,
  BLOB_TRANSPORT_THRESHOLD,
  fetchTransportBuffer,
  isAllowedUploadFilename,
  isTransportBlobUrl,
} from "@/lib/blob-transport"

let pass = 0
let fail = 0
function check(name, cond, extra) {
  if (cond) {
    pass++
    console.log(`PASS ${name}`)
  } else {
    fail++
    console.log(`FAIL ${name}${extra ? ` :: ${extra}` : ""}`)
  }
}

async function rejectsWith(fn, re, name) {
  try {
    await fn()
    check(name, false, "khong nem loi")
  } catch (e) {
    check(name, re.test(e instanceof Error ? e.message : ""), e instanceof Error ? e.message : "")
  }
}

// Ngưỡng vận chuyển: dưới 4,5MB (giới hạn request Vercel) nhưng đủ lớn
// để file thường vẫn đi đường cũ.
check("nguong 4MB", BLOB_TRANSPORT_THRESHOLD === 4 * 1024 * 1024, String(BLOB_TRANSPORT_THRESHOLD))
check("gioi han body JSON 64KB", BLOB_JSON_BODY_LIMIT === 64 * 1024, String(BLOB_JSON_BODY_LIMIT))

// Host Blob hợp lệ / không hợp lệ.
check(
  "URL Blob public hop le",
  isTransportBlobUrl("https://ontapsinhhoc-blob.public.blob.vercel-storage.com/uploads/abc.docx"),
)
check("URL http bi chan", !isTransportBlobUrl("http://ontapsinhhoc-blob.public.blob.vercel-storage.com/x.docx"))
check("URL host la bi chan", !isTransportBlobUrl("https://evil.example.com/x.docx"))
check("URL host na na bi chan", !isTransportBlobUrl("https://ontapsinhhoc-blob.public.blob.vercel-storage.com.evil.com/x.docx"))
check("URL khong parse duoc bi chan", !isTransportBlobUrl("not-a-url"))

// Đuôi file.
check("docx duoc", isAllowedUploadFilename("BAI_2.docx"))
check("pdf duoc", isAllowedUploadFilename("bai.pdf"))
check("txt duoc", isAllowedUploadFilename("bai.txt"))
check("exe bi chan", !isAllowedUploadFilename("bai.exe"))
check("docx.exe bi chan", !isAllowedUploadFilename("bai.docx.exe"))
check("khong duoi bi chan", !isAllowedUploadFilename("bai"))

// fetchTransportBuffer: chặn trước khi fetch (không cần mạng).
await rejectsWith(
  () => fetchTransportBuffer("https://evil.example.com/x.docx", "x.docx"),
  /không hợp lệ/,
  "fetch: host la bi chan truoc khi fetch",
)
await rejectsWith(
  () => fetchTransportBuffer("https://a.public.blob.vercel-storage.com/x.docx", "x.exe"),
  /Chỉ chấp nhận file/,
  "fetch: duoi file bi chan truoc khi fetch",
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
