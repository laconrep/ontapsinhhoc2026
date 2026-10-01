# Kế hoạch sửa parser upload file của giáo viên (8 phiên)

Mục tiêu: đổi nguyên tắc parser luồng upload file của giáo viên, và cứu công thức Word
(MathType OLE + OMML) để lựa chọn A-D không còn rỗng.

Trạng thái: **chưa code**. Đây là nguồn sự thật cho 8 phiên. Phiên sau chỉ cần đọc file này
+ đúng các file được nêu trong phiên đó, KHÔNG đọc lại toàn repo.

File đối chiếu bắt buộc dùng để kiểm thử: `BAI 1 - GENE VA SU TAI BAN DNA.docx` (ở gốc repo,
người dùng gọi tắt là "gene va tai ban DNA.docx").

---

## 0. Quy tắc parser mới (đã chốt với người dùng)

Khung tài liệu giữ nguyên: `{...}` chương, `[...]` bài, `-` điểm kiến thức.

### Mốc nhóm (sticky)
- `#` = nhóm MC (1 đáp án đúng).
- `##` = nhóm TF.
- `###` = nhóm SA.
- Nhóm giữ hiệu lực đến mốc nhóm MỚI, hoặc hết file. Một mốc chỉ đặt loại, KHÔNG tạo câu.

### Một câu hỏi
- Bắt đầu: `Câu 1.` / `câu 1.` / `Câu 1:` / `câu 1:` (số bất kỳ, không phân biệt hoa/thường).
- Kết thúc khi gặp: `Câu` tiếp theo, `#`/`##`/`###`, `{`, `[`, `-`, hoặc mục
  `ĐÁP ÁN` / `ĐÁP ÁN TRẮC NGHIỆM...` / `HƯỚNG DẪN GIẢI`.
- Dòng trống KHÔNG cắt câu.

### Đề (stem)
- Mọi dòng sau `Câu n.` cho đến lựa chọn đầu tiên (A/a với MC/TF) hoặc `Đáp án:` (SA).
- `1.` `(1)` `1)` `(a)` `(b)` ... là ý trong đề, KHÔNG phải đáp án.
- Hình, bảng, chuỗi nucleotide, token `@@IMGn@@`/`@@TBLn@@` thuộc đề (nếu đứng trước lựa chọn đầu).

### Lựa chọn MC (sau `#`)
- Chỉ nhận chữ cái A-D: `A.` `A)` `a.` `a)`.
- KHÔNG nhận `1.` `(1)` `1)` làm lựa chọn.
- 3 kiểu thật, phải nhận cả 3:
  1. Mỗi lựa chọn 1 dòng.
  2. Cả 4 trên 1 dòng: `A. ...B. ...C. ...D. ...`.
  3. Gộp 2+2: `A. ...B. ...` rồi dòng sau `C. ...D. ...`.
- Tách khi cùng dòng: cắt theo mốc A. B. C. D. theo thứ tự, KHÔNG cắt theo Enter.
- Chuẩn hóa nhãn `A. B. C. D.`; phải đủ 4. Đáp án đúng = gạch chân (`__...__`).

### Lựa chọn TF (sau `##`)
- Chỉ `a.` `a)` `A.` `A)` ... đến `d`.
- Thường mỗi ý 1 dòng; nếu 4 ý 1 dòng thì tách như MC.
- Chuẩn hóa `a) b) c) d)`. Gạch chân = Đúng.

### SA (sau `###`)
- Đề = mọi dòng sau `Câu n.` đến `Đáp án:` / `dap an:`.
- `1)` `2)` trong đề vẫn là đề.
- Phần sau `Đáp án:` là đáp án. Thiếu `Đáp án:` báo lỗi rõ số dòng.

### Cắt đuôi file (rất quan trọng)
- Gặp dòng `ĐÁP ÁN`, `ĐÁP ÁN TRẮC NGHIỆM...`, `HƯỚNG DẪN GIẢI` thì DỪNG parse phần câu và bỏ
  hết phần còn lại. Nếu không, phần đáp án + hướng dẫn bị nuốt thành hàng chục câu giả.

### Công thức Word (MathType OLE + OMML)
- OLE MathType: lấy ảnh preview WMF/EMF, đổi sang SVG (hoặc PNG), chèn đúng chỗ thành `<img>`.
- OMML `m:oMath`: render ra ảnh (OMML -> MathML -> SVG).
- Ảnh công thức đi theo token `@@IMGn@@` như hình thường. Token nằm trong A/B/C/D thì thuộc
  lựa chọn, không phải đề. Lựa chọn không còn rỗng vì có ảnh.
- Khi không ra ảnh: KHÔNG fail cả file. Lựa chọn rỗng báo lỗi rõ:
  "Lựa chọn A thiếu nội dung (công thức Word không đọc được)".
- KHÔNG parse `oleObject*.bin` MathType thành LaTeX. KHÔNG bắt GV gõ LaTeX. KHÔNG bỏ WMF preview.

---

## 1. Phát hiện đã kiểm chứng trên file đối chiếu (khỏi điều tra lại)

Chạy mammoth + `parseHtmlToResultAndText` hiện tại trên file đối chiếu (đã làm):
- Kết quả hiện tại: `chapters:1, lessons:1, kps:29, questions:107, errors:341`.
- `images:37`, `tables:12`. Phần `ĐÁP ÁN` + `HƯỚNG DẪN GIẢI` sinh ra ~70 câu giả.

Đặc điểm sourceText (do mammoth + pipeline hiện tại tạo ra) mà parser mới PHẢI xử lý:
- Mốc nhóm bị gạch chân trong Word nên thành `__##__`, `__###__`. Mốc MC là `#` (không gạch chân).
  => Phải `stripUnderline` rồi mới nhận diện mốc.
- Lựa chọn đúng bị gạch chân ở nhãn hoặc cả câu: `__C.__ ...`, `__a.____ ... __`.
- Ảnh được đẩy ra dòng riêng dạng token vì pipeline bọc `\n@@IMGn@@\n`. Ví dụ Câu 5:
  ```
  Câu 5. ... Tỉ lệ
  @@IMG0@@
   ở mạch thứ 2 ...?
  A.
  @@IMG1@@
  .				B. 1.				__C.__
  @@IMG2@@
  .				D. 2.
  ```
  => Lựa chọn có thể trải nhiều dòng, token ảnh nằm giữa chữ và dấu `.`.
- Bảng bị gom thành token `@@TBLn@@` (bảng trong TF Câu 4, 5; SA Câu 5, 7, 9).
- TF Câu 4/5: chỉ còn đúng 4 ý a-d SAU token bảng (các a-d nằm trong bảng đã bị gom vào TBL).
- TF sau Câu 6 có thêm một khối a-d ("Gene A/Gene a") không có `Câu 7.` đi kèm (lỗi nguồn).
  => Chấp nhận: lấy 4 ý a-d đầu của câu đang mở; khối dư báo lỗi rõ hoặc bỏ.
- SA: `Đáp án:` có thể có khoảng trắng đầu dòng (` Đáp án: 5`).
- Dòng lạ trong mục KP: `3. Kết quả: ...` (không bắt đầu bằng `-`). Xử lý ở phiên 3/6.
- Dòng mở đầu `PHẦN V – DI TRUYỀN HỌC` đứng trước `{CHỦ ĐỀ...}` (preamble) => bỏ qua, không lỗi.

---

## 2. Điểm mốc code hiện tại (không đọc lại file dài)

### `lib/worksheet-parser.ts` (697 dòng)
- Dòng 1: `import type { UnderlinedTerm } from "@/types"`.
- Dòng 5-60: types `ParsedQuestionType`, `ParsedOption {content,isCorrect}`, `ParsedQuestion
  {type,content,options,correctAnswer?,bodyHtml?,line}`, `ParsedKnowledgePoint`, `ParsedLesson`,
  `ParsedChapter`, `ParseError {line?,message}`, `ParseResult {chapters,errors}`,
  `ValidationError`, `ValidationResult`.
- Dòng 81 `extractBlanks(raw)` -> `{content, underlinedTerms}` (tách `__từ__` và `"từ"`). GIỮ NGUYÊN.
- Dòng 182-186: regex `CAU_RE`, `DAP_AN_RE`, `CHOICE_RE`, `BULLET_RE`.
- Dòng 188 `normalizeParseText`, 199 `stripUnderline`, 203 `hasUnderline`, 207 `parseChoiceLine`,
  216 `parseCauLine`, 221 `isCauHeading`, 225 `parseDapAnLine`.
- Dòng 251 `parseTextContent(text): ParseResult` — hàm chính cần viết lại vòng lặp.
- Dòng 459 `normalizeHtml`, 485 `imgTagToPlaceholder(tag, images)` (nhận `data:image/...;base64,`
  hoặc `/...`), 494 `sanitizeTableHtml`, 512 `tableToPlaceholder`, 522 `lineWithRichToHtml`,
  546 `convertHtmlLists`, 574 `attachBodyHtml(result, images, tables)`,
  593 `sourceTextToPreviewHtml`, 605 `parseHtmlToResultAndText(html)`.
- Dòng 635 `validateDocument(result): ValidationResult`: MC đúng 4 lựa chọn + đúng 1 đúng;
  TF đúng 4 ý; SA có `correctAnswer`; KP có underlinedTerms; bài có KP.
- Dòng 680 `summarize(result)`.
- `parseChoiceLine` hiện nhận cả `1.`/`(1)` -> PHẢI siết lại cho MC.

### `lib/extract-file.ts` (74 dòng)
- Dòng 16 `detectKind`, 37 `extractAndParse(buffer, filename)`.
- Dòng 51-63 nhánh `docx`: `mammoth.convertToHtml({buffer}, { styleMap:["u => u"],
  convertImage: mammoth.images.imgElement(async image => ({ src:
  "data:"+image.contentType+";base64,"+await image.readAsBase64String() })) })` -> `parseHtmlToResultAndText(html)`.
- `image.read()` trả `Buffer`; `image.readAsBase64String()` trả base64.

### API + lưu
- `app/api/worksheet/validate/route.ts` -> `validateWorksheetBuffer`.
- `app/api/worksheet/save/route.ts` -> `saveWorksheetBuffer` hoặc `saveWorksheetFromText`.
- `lib/worksheet-import.ts`: dòng 59 `validateWorksheetBuffer`, 77 `persistParseResult`
  (lưu `bodyHtml` cho `questions`, `questionOptions.content` chỉ có text), 204 `saveWorksheetBuffer`,
  213 `saveWorksheetFromText`.
- `lib/db/index.ts` dòng 18 `ensureSchema()` — có thể thêm cột bằng
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- `lib/db/schema.ts` dòng 141 `questions`, 154 `questionOptions {content,isCorrect,order}`.

### UI
- `components/teacher/worksheet-importer.tsx`: `PreviewPanel` dòng 274 render lựa chọn bằng
  `{o.content}` (text thuần) dòng 352-359; `QuestionStem` cho đề.
- `components/teacher/import-error-fix.tsx`: dòng 215 dùng `sourceTextToPreviewHtml` render ảnh/bảng.
- `components/question/question-stem.tsx`: sanitize HTML, cho phép `img`, `table`, `u`, `p`, `br`...
- `components/teacher/question-editor.tsx` dòng 198 `{o.content}`; `components/student/tab4-quiz.tsx`
  dòng 214,234 `{o.content}`; `components/live/quiz-stage.tsx` dòng 110.

---

## 3. Phụ thuộc kỹ thuật (chốt trước khi code)

### WMF (MathType OLE) -> SVG
- Chọn chính: `wmf2svg` (gói apt `libwmf-bin`). Đã kiểm chứng convert sạch 20/20 file WMF của
  file đối chiếu (có `<line>` cho gạch phân số và `<text>` cho ký hiệu).
  - Cách gọi: ghi WMF ra file tạm, chạy `wmf2svg <file.wmf>` (in SVG ra stdout), đọc stdout.
  - WMF MathType có "placeable header" 22 byte (magic `0x9AC6CDD7`) — `wmf2svg` tự xử lý file gốc,
    nhưng nếu cần thì tự strip trước.
  - Kết quả nhúng: `data:image/svg+xml;base64,<svg>` (khớp regex `data:image/...;base64,` sẵn có).
- Dự phòng khi thiếu `wmf2svg`: KHÔNG fail file. Dùng gói npm `wmf` (đã cài) + bỏ record
  `META_ESCAPE(1574)` để lấy text, tự dựng SVG tối giản (có thể thiếu gạch phân số). Nếu vẫn lỗi:
  giữ nguyên WMF (không hiển thị) và để phiên 6 báo lỗi "công thức Word không đọc được".
- Cài đặt (chạy 1 lần, unattended):
  ```
  # Cài libwmf-bin (có wmf2svg)
  DEBIAN_FRONTEND=noninteractive apt-get install -y libwmf-bin
  ```

### OMML `m:oMath` -> SVG
- Thêm dependency: `jszip`, `@xmldom/xmldom`, `omml2mathml`, `mathjax-full`.
- Chuỗi: unzip docx -> lấy `word/document.xml` -> thay mỗi `<m:oMath>...</m:oMath>` bằng run
  `<w:r><w:t>@@MATHn@@</w:t></w:r>` -> rezip -> mammoth -> HTML -> thay `@@MATHn@@` bằng `<img>`.
- Chuyển từng OMML:
  - Wrap fragment bằng `<w:document xmlns:m=".../math" xmlns:w=".../wordprocessingml/2006/main">`.
  - `new DOMParser().parseFromString(wrapped,"text/xml")` (@xmldom/xmldom),
    `doc.getElementsByTagNameNS(mathNS,"oMath")[0]`.
  - `mathEl = omml2mathml(oMathEl)`; serialize bằng `mathEl.outerHTML` (KHÔNG dùng XMLSerializer
    của xmldom vì lỗi `lookupPrefix`).
  - MathML -> SVG bằng `mathjax-full` (`liteAdaptor` + `RegisterHTMLHandler` + `MathML` + `SVG`),
    lấy `adaptor.outerHTML(node)`, tách phần `<svg ...>...</svg>` bên trong `mjx-container`,
    nhúng `data:image/svg+xml;base64,...`.
- Nếu 1 công thức lỗi: thay bằng text `[công thức]` (không fail).

---

## 4. Tám phiên code

Quy ước commit mỗi phiên: `wip(parser): phien N - <tom tat>`.
Mỗi phiên: làm -> tự kiểm (script/node) -> điền "Báo cáo phiên N" -> commit + push.

---

### Phiên 1 — MathType OLE (WMF) -> SVG khi extract .docx

**Mục tiêu:** ảnh công thức MathType không còn là `data:image/x-wmf` (browser không hiện);
chuyển thành SVG ngay trong `convertImage` của mammoth.

**Việc làm**
1. Tạo `lib/docx-equations.ts` (server-only, chỉ dùng Node APIs):
   - `export async function wmfToSvg(buffer: Buffer): Promise<string | null>`
     - Nếu buffer rỗng -> null.
     - Ghi `buffer` ra `os.tmpdir()/...wmf` (dùng `fs.mkdtemp`).
     - `execFile("wmf2svg", [inPath])` với `maxBuffer` lớn; lấy stdout.
     - Nếu stdout chứa `<svg` -> `return "data:image/svg+xml;base64," + stdout.toString("base64")`.
     - Nếu `wmf2svg` không tồn tại / lỗi -> fallback `wmfToSvgFallback(buffer)`.
     - `finally` xoá file tạm (dùng `fs.rm`).
   - `function wmfToSvgFallback(buffer): string | null`
     - Strip placeable header 22 byte nếu `readUInt32LE(0)===0x9AC6CDD7`.
     - Loại record `META_ESCAPE` (function 1574) bằng cách quét record
       (`size = readUInt32LE(pos)` đơn vị word, `total = size*2`, `fn = readUInt16LE(pos+4)`).
     - `require("wmf").get_actions(sanitized)` -> lấy action `text` (`v`, `p:[x,y]`) và
       `s.Extent/s.Origin` để scale; dựng SVG tối giản (`<text>` + `<line>` nếu có action poly).
     - Bọc `try/catch`, lỗi -> null.
   - `export function isConvertibleMetafile(contentType: string): boolean`
     -> `image/x-wmf`, `image/x-emf`, `image/wmf`, `image/emf`.
2. Sửa `lib/extract-file.ts` nhánh docx:
   - Trong `convertImage`, nếu `isConvertibleMetafile(image.contentType)`:
     `const svg = await wmfToSvg(await image.read()); if (svg) return { src: svg };`
   - Nếu không -> giữ nguyên hành vi cũ.
   - `import` từ `./docx-equations`.
3. Thêm `wmf` vào `package.json` dependencies nếu fallback dùng (nếu chỉ fallback text thì vẫn cần).
4. Script kiểm tra tạm `scripts/check-docx-equations.mjs`: đọc file đối chiếu, gọi
   `extractAndParse`, in ra `images.length` và xác nhận KHÔNG còn `data:image/x-wmf` trong
   `images`; in số ảnh bắt đầu bằng `data:image/svg+xml`.

**File:** tạo `lib/docx-equations.ts`, `scripts/check-docx-equations.mjs`; sửa `lib/extract-file.ts`,
`package.json`, `pnpm-lock.yaml`.

**Kiểm thử:** chạy script trên `BAI 1 - GENE VA SU TAI BAN DNA.docx`; kỳ vọng không còn WMF,
số ảnh SVG >= 20.

**Commit:** `wip(parser): phien 1 - MathType WMF sang SVG`

**Báo cáo phiên 1 (đã làm):**
- Đã làm:
  - Tạo `lib/docx-equations.ts`: `wmfToSvg(buffer)` ưu tiên `wmf2svg` (ghi WMF ra tmp rồi
    `execFile("wmf2svg", [inPath])`), fallback thuần JS bằng gói `wmf` (strip placeable header
    22 byte, bỏ record `META_ESCAPE` 1574, dựng SVG tối giản từ text/poly);
    `isConvertibleMetafile`; `ensureSvgNamespace`.
  - Sửa `lib/extract-file.ts` nhánh docx: trong `convertImage`, nếu là WMF/EMF thì gọi
    `wmfToSvg`; thành công trả `data:image/svg+xml;base64,...`, thất bại giữ base64 gốc.
  - Thêm dependency `wmf@^1.0.2` + `types/wmf.d.ts`.
  - Script kiểm thử `scripts/check-docx-equations.mjs` (chạy bằng `tsx`).
- File đã sửa/tạo: `lib/docx-equations.ts` (mới), `lib/extract-file.ts`, `package.json`,
  `pnpm-lock.yaml`, `types/wmf.d.ts` (mới), `scripts/check-docx-equations.mjs` (mới).
- Kiểm thử:
  - `tsx scripts/check-docx-equations.mjs` trên file đối chiếu: `images:37, svg:20, wmf:0, png:17`
    -> KHÔNG còn WMF, đủ 20 ảnh SVG, có default `xmlns`.
  - Ép `PATH` không có `wmf2svg` -> fallback JS vẫn cho data URI SVG hợp lệ.
  - `npx tsc --noEmit` exit 0.
- Ghi chú quan trọng: `wmf2svg` (apt `libwmf-bin`) đã cài trong môi trường. Output của `wmf2svg`
  KHÔNG có `xmlns` mặc định -> phải tự thêm `xmlns="http://www.w3.org/2000/svg"`, nếu không browser
  không render ảnh SVG (bug tiềm ẩn của kế hoạch gốc).
- Việc tiếp theo (phiên 2): OMML -> SVG. Chỉ cần thêm `lib/docx-omml.ts` + tiền xử lý docx
  trong `extract-file.ts`. Không đọc lại parser.

---

### Phiên 2 — OMML `m:oMath` -> SVG

**Mục tiêu:** công thức Word native (23 cái) không còn bị mất; hiện thành ảnh.

**Việc làm**
1. Thêm dependency: `jszip`, `@xmldom/xmldom`, `omml2mathml`, `mathjax-full`.
2. Tạo `lib/docx-omml.ts`:
   - `export function ommlToSvgDataUri(ommlFragment: string): string | null`
     - Wrap namespace, parse, lấy `oMath`, `omml2mathml`, `outerHTML` -> MathML.
     - MathML -> SVG bằng MathJax (khởi tạo 1 lần, module-level).
     - Tách inner `<svg ...>...</svg>`, trả `data:image/svg+xml;base64,...`.
   - `export async function preprocessOmml(buffer: Buffer): Promise<{ buffer: Buffer; maths: string[] }>`
     - `JSZip.loadAsync(buffer)`; đọc `word/document.xml` (string).
     - Regex `/m:oMath\b[^>]*>[\s\S]*?<\/m:oMath>/g` (và `m:oMathPara` nếu có) lần lượt:
       lấy fragment làm `maths[n]` = SVG data URI (hoặc `null`).
     - Thay fragment bằng `<w:r><w:t xml:space="preserve">@@MATHn@@</w:t></w:r>`.
     - Ghi lại zip (`zip.generateAsync({type:"nodebuffer"})`).
     - Nếu không có oMath -> trả buffer gốc, `maths: []`.
3. Sửa `lib/extract-file.ts` nhánh docx:
   - `const { buffer: buf2, maths } = await preprocessOmml(buffer)`
   - mammoth trên `buf2`.
   - Sau khi có `html`: `html = html.replace(/@@MATH(\d+)@@/g, (_, n) => maths[+n] ? `<img src="${maths[+n]}">` : "[công thức]")`.
   - Rồi mới `parseHtmlToResultAndText(html)`.
4. Mở rộng script kiểm tra: xác nhận Câu 35 lựa chọn A, TF Câu 7 (nếu có) / TF Câu 9 option a,
   SA Câu 1/8 có `@@IMG` thay vì rỗng.

**File:** tạo `lib/docx-omml.ts`; sửa `lib/extract-file.ts`, `scripts/check-docx-equations.mjs`,
`package.json`, `pnpm-lock.yaml`.

**Kiểm thử:** script tạm parse file đối chiếu; đếm `@@MATH` đã thay; không crash.

**Commit:** `wip(parser): phien 2 - OMML sang SVG`

**Báo cáo phiên 2 (đã làm):**
- Đã làm:
  - Thêm dependency `jszip`, `@xmldom/xmldom`, `omml2mathml`, `mathjax-full`.
  - Tạo `lib/docx-omml.ts`: `ommlToSvgDataUri(fragment)` (wrap namespace, xmldom,
    `omml2mathml` lấy `outerHTML`, MathJax `liteAdaptor` + `MathML` + `SVG` fontCache none,
    tách inner `<svg>`, thêm xmlns nếu thiếu, trả `data:image/svg+xml;base64,...`);
    `preprocessOmml(buffer)` unzip `word/document.xml`, thay `m:oMathPara` rồi `m:oMath`
    bằng `<w:r><w:t xml:space="preserve">@@MATHn@@</w:t></w:r>`, rezip. 1 công thức lỗi
    -> null, không fail file.
  - Sửa `lib/extract-file.ts` nhánh docx: `preprocessOmml` trước mammoth; sau HTML thay
    `@@MATHn@@` bằng `<img src="...">` hoặc `[công thức]` rồi `parseHtmlToResultAndText`.
  - Mở rộng `scripts/check-docx-equations.mjs` đếm OMML SVG + token `@@MATH` sót.
  - Type `types/omml2mathml.d.ts`.
- File đã sửa/tạo: `lib/docx-omml.ts` (mới), `lib/extract-file.ts`,
  `scripts/check-docx-equations.mjs`, `package.json`, `pnpm-lock.yaml`,
  `types/omml2mathml.d.ts` (mới).
- Kiểm thử:
  - `tsx scripts/check-docx-equations.mjs` trên file đối chiếu:
    `omml tokens:23, omml svg:23, omml fail:0`; `images:60, svg:43, wmf:0, png:17`;
    `@@MATH` sót = 0. Câu 35 lựa chọn A có `@@IMG13@@` (trước đây rỗng vì mất OMML).
  - `npx tsc --noEmit` exit 0.
- Ghi chú: MathJax khởi tạo 1 lần (module-level). `omml2mathml` là CJS (`require` qua
  default import + `types/omml2mathml.d.ts`). Parser vẫn chưa tách option nên `@@IMG`
  công thức OMML đang nằm trong stem/`sourceText` (phiên 4 sẽ gắn vào A-D).
- Việc tiếp theo (phiên 3): viết lại vòng lặp `parseTextContent`.

---

### Phiên 3 — Parser lõi: mốc nhóm dính + biên câu + cắt đuôi

**Mục tiêu:** `#`/`##`/`###` chỉ đặt loại nhóm; `Câu n.` mở câu; dừng ở biên; cắt đuôi.

**Việc làm** (trong `lib/worksheet-parser.ts`)
1. Thêm state trong `parseTextContent`:
   - `let groupType: ParsedQuestionType | null = null`
   - `let inTail = false` (đã gặp `ĐÁP ÁN`/`HƯỚNG DẪN GIẢI` -> bỏ mọi dòng sau)
   - `let curQuestion: ParsedQuestion | null` (giữ), `curKp`, `curLesson`, `curChapter`.
   - `let sawStructure = false` (đã gặp `{`/`[` đầu tiên) để bỏ preamble.
2. Chuẩn hoá nhận diện mốc:
   - `const bare = stripUnderline(line).trim()` dùng cho việc nhận diện `#`, `##`, `###`
     (vì Word có thể tạo `__##__`, `__###__`).
   - Nếu `bare === "#"` / `"##"` / `"###"` -> `groupType` tương ứng, đóng `curQuestion`, `return`.
   - Nếu dòng bắt đầu `#`/`##`/`###` VÀ có nội dung sau (legacy `# cau: ...`) -> đặt `groupType`
     rồi coi phần sau là đề câu mới (tương thích mẫu cũ).
3. Nhận diện cắt đuôi (chạy TRƯỚC mọi bước khác, sau `normalizeParseText`):
   - `/^ĐÁP\s*ÁN\b/i`, `/^DAP\s*AN\b/i`, `/^ĐÁP ÁN TRẮC NGHIỆM/i`, `/^HƯỚNG DẪN GIẢI/i`.
   - Khi khớp: đóng `curQuestion`, `inTail = true`, `return`. Các dòng sau: nếu `inTail` -> `return` ngay.
4. Preamble: nếu chưa `sawStructure` (`{`/`[`) và dòng không khớp mốc/`{`/`[` -> bỏ qua (không lỗi).
5. `Câu n.` (dùng `parseCauLine`/`isCauHeading` sau khi `stripUnderline`):
   - Nếu `groupType == null` -> lỗi "Câu hỏi phải nằm sau mốc #/##/###".
   - Đóng câu cũ; tạo câu mới type = `groupType`, content = phần còn lại sau `Câu n.`,
     `options: []`, `line`.
   - Push vào `curKp.questions` (nếu chưa có KP -> lỗi như cũ).
6. Biên câu: `{`, `[`, `-` (đầu dòng) đóng `curQuestion` trước khi xử lý như hiện tại.
7. Giữ `extractBlanks`, `{`, `[`, `-`, token `@@IMG`/`@@TBL` (chưa có logic gắn `bodyHtml`).
8. Xử lý dòng lạ trong mục KP: nếu KHÔNG có câu hỏi đang mở và đang trong KP, nối vào `curKp.content`
   (tránh lỗi `3. Kết quả:`). Nếu đang mở câu -> xử lý ở phiên 4/5.
9. KHÔNG sửa `parseChoiceLine`, option, validate ở phiên này (để phiên 4/5/6).

**Kiểm thử:** tạo text nhỏ tổng hợp:
```
{Chương}
[Bài]
- KP "a" có "b"
#
Câu 1. D?____
A. 1 B. 2 C. 3 D. 4
Câu 2. ...
## 
Câu 1. ...
ĐÁP ÁN
Câu 1. ...
```
Kỳ vọng: groupType chuyển đúng, có 2 câu MC + 1 TF, phần sau `ĐÁP ÁN` bị bỏ.
Chạy thêm trên file đối chiếu: `summarize` giảm mạnh số câu (không còn ~107), không lỗi preamble.

**Commit:** `wip(parser): phien 3 - moc nhom dinh, bien cau, cat duoi`

**Báo cáo phiên 3 (đã làm):**
- Đã làm:
  - Viết lại vòng lặp `parseTextContent`: state `groupType` / `inTail` / `sawStructure`.
  - Mốc `#`/`##`/`###` sau `stripUnderline` (xử lý `__##__`, `__###__`) chỉ đặt loại,
    đóng câu đang mở; có nội dung sau mốc thì coi là đề legacy.
  - `Câu n.` mở câu theo `groupType`; thiếu mốc -> lỗi "Câu hỏi phải nằm sau mốc #/##/###".
  - `{` `[` `-` đóng câu trước khi xử lý cấu trúc.
  - Cắt đuôi: `ĐÁP ÁN` / `ĐÁP ÁN TRẮC NGHIỆM...` / `HƯỚNG DẪN GIẢI` (không cắt `Đáp án:` của SA).
  - Preamble trước `{`/`[` bỏ qua, không lỗi.
  - Dòng lạ trong KP khi không mở câu -> nối `curKp.content` (`3. Kết quả:`).
  - Không sửa `parseChoiceLine` / option / validate.
- File đã sửa/tạo: `lib/worksheet-parser.ts`, `scripts/check-parser-phien3.mjs` (mới).
- Kiểm thử:
  - Text tổng hợp: 2 MC + 1 TF, phần sau `ĐÁP ÁN` bị bỏ, không lỗi preamble.
  - File đối chiếu: `chapters:1, lessons:1, kps:22, questions:51` (`MC:35 TF:6 SA:10`),
    errors:8 (lựa chọn 2+2 / token ảnh — phiên 4). Không còn ~107 câu giả, không lỗi `PHẦN V`.
  - `npx tsc --noEmit` exit 0.
- Việc tiếp theo (phiên 4): MC options.

---

### Phiên 4 — MC: tách 1 dòng / 4-trong-1 / 2+2 + token ảnh trong lựa chọn

**Mục tiêu:** mọi câu MC ra đủ 4 lựa chọn A-D kể cả khi cùng dòng; lựa chọn chứa `@@IMGn@@`
không bị coi là rỗng.

**Việc làm** (trong `lib/worksheet-parser.ts`)
1. Thêm hằng: `const MC_LETTERS = ["A","B","C","D"]`.
2. Thêm hàm `splitChoiceBlock(block: string, letters: string[]): { letter, text, underlined }[]`:
   - Quét marker theo ĐÚNG thứ tự A -> B -> C -> D:
     ```
     let from = 0
     for (const L of letters) {
       const re = new RegExp(`(^|[\\s\\u00A0])${L}[.)]\\s*`, "i")  // tìm từ vị trí from
       const slice = block.slice(from)
       const m = slice.match(re)
       if (!m) break
       const idx = from + (m.index ?? 0) + (m[1]?.length ?? 0)
       positions.push({ letter: L, start: idx })
       from = idx + L.length + 1
     }
     ```
   - Cắt `text = block.slice(start_i, start_{i+1})`, bỏ nhãn `^[A-Da-d][.)]`, trim.
   - `underlined = text.includes("__") || marker có "__"` (kiểm tra trên đoạn gốc trước khi strip).
   - Trả về danh sách đã strip `__` trong text nhưng nhớ cờ underlined.
   - LƯU Ý: `letters` cho MC = `["A","B","C","D"]` (KHÔNG dùng `1.`/`(1)`/`1)`).
3. Trong vòng lặp câu hỏi:
   - Khi `curQuestion.type === "MC"`:
     - Nếu chưa bắt đầu lựa chọn: dòng khớp `/^([A-Da-d])[.)]\s*/` (sau `stripUnderline`) -> chuyển
       sang chế độ thu `optionBuffer` (append dòng gốc), và mọi dòng sau đó (kể cả token ảnh,
       dòng trống) đều append vào buffer cho đến khi gặp biên câu.
     - Nếu đã ở chế độ lựa chọn: append dòng vào buffer.
   - Khi đóng câu MC: `const parts = splitChoiceBlock(optionBuffer, MC_LETTERS)`.
     - Tạo `options` = 4 phần tử (nếu thiếu < 4 thì để thiếu, phiên 6 báo lỗi).
     - `content = mcOptionContent(letter, text)` giữ nguyên `@@IMGn@@` trong text.
     - `isCorrect = underlined`.
4. Bỏ nhánh `parseChoiceLine` cũ cho MC (nhưng giữ `parseChoiceLine` export cho chỗ khác nếu còn
   dùng; kiểm tra bằng grep).
5. Đảm bảo token `@@IMGn@@` trong option không bị `trim` mất (dòng chỉ có `@@IMGn@@` vẫn giữ).

**Kiểm thử:** trên file đối chiếu:
- Câu 1, 6, 11, 14, 26, 29 (4-trong-1) -> 4 lựa chọn.
- Câu 17, 22, 30 (2+2) -> 4 lựa chọn.
- Câu 5, 21, 35 -> 4 lựa chọn, trong đó A/C có `@@IMG`.
- Không có lựa chọn nào sinh từ `1.`/`(1)`.

**Commit:** `wip(parser): phien 4 - MC tach dong va anh trong lua chon`

**Báo cáo phiên 4 (điền sau khi code):**
- Đã làm:
- File đã sửa/tạo:
- Kiểm thử:
- Việc tiếp theo (phiên 5): TF + SA.

---

### Phiên 5 — TF và SA

**Mục tiêu:** TF ra đủ a-d (gạch chân = Đúng); SA lấy đề đến `Đáp án:`, thiếu thì báo lỗi.

**Việc làm** (trong `lib/worksheet-parser.ts`)
1. TF:
   - `letters = ["a","b","c","d"]`; nhận marker `a.` `a)` `A.` `A)` (không phân biệt hoa).
   - Dùng lại `splitChoiceBlock`; normalize content = `tfOptionContent(letter, text)` -> `a) ...`.
   - `isCorrect = underlined` (gạch chân = Đúng).
   - Nếu 4 ý nằm 1 dòng -> tách như MC. Nếu nhiều dòng -> gom buffer rồi tách.
   - Chỉ lấy đủ 4 ý đầu; khối a-d dư (sau Câu 6) -> khi không có câu đang mở thì báo lỗi
     "Các ý a)-d) không thuộc câu nào (thiếu Câu n.)" và KHÔNG tạo câu giả.
2. SA:
   - Trong câu SA, dòng khớp `parseDapAnLine` -> `curQuestion.correctAnswer = body`; (không append đề).
   - Dòng `1)` `2)`... -> append đề (không phải lựa chọn).
   - Khi đóng câu SA mà `correctAnswer` rỗng -> `errors.push({line, message:"Câu trả lời ngắn thiếu 'Đáp án:'"})`.
   - Token ảnh/bảng trong đề SA -> append đề.
3. Bỏ hoàn toàn nhánh `### de = dap an` 1 dòng cũ.
4. Kiểm tra không phá legacy: nếu gặp `cau:` không có `Câu n.`, vẫn cho phép như cũ (tương thích mẫu).

**Kiểm thử:** file đối chiếu:
- TF: 6 câu (Câu 1-6) mỗi câu 4 ý; TF Câu 4/5 có token `@@TBL` trong đề.
- SA: 10 câu, mỗi câu có `correctAnswer` (10, 3, 2, 40, 39, 180, 36, 40, 5, 5).
- Khối a-d dư sau Câu 6 -> lỗi rõ, không tạo câu.

**Commit:** `wip(parser): phien 5 - TF va SA`

**Báo cáo phiên 5 (điền sau khi code):**
- Đã làm:
- File đã sửa/tạo:
- Kiểm thử:
- Việc tiếp theo (phiên 6): validate + lỗi.

---

### Phiên 6 — Validate + lỗi rõ ràng

**Mục tiêu:** file đối chiếu ra danh sách lỗi đúng, không lỗi giả; lỗi lựa chọn rỗng nói rõ công thức.

**Việc làm** (trong `lib/worksheet-parser.ts`, `validateDocument`)
1. Hàm `isEffectivelyEmpty(text)`: bỏ `@@IMGn@@`, `@@TBLn@@`, `<img ...>`, khoảng trắng, dấu câu
   `.` `,` `;` `:` còn lại -> rỗng.
2. MC:
   - Không đủ 4 lựa chọn -> lỗi như cũ (kèm `line`).
   - Đúng 1 đáp án đúng; nếu 0 -> lỗi "Câu n chưa gạch chân đáp án đúng".
   - Từng lựa chọn rỗng -> `"Lựa chọn X thiếu nội dung (công thức Word không đọc được)"`.
3. TF: đúng 4 ý; từng ý rỗng -> lỗi tương tự.
4. SA: thiếu `correctAnswer` -> lỗi kèm `line` (đã có).
5. Giữ rule KP có `underlinedTerms`, bài có KP.
6. Dòng lỗi phải trỏ đúng `line` của `Câu n.` hoặc dòng lựa chọn (để UI nhảy tới).
7. Đảm bảo file đối chiếu KHÔNG còn lỗi từ phần đáp án/hướng dẫn (nhờ cắt đuôi phiên 3).

**Kiểm thử:** chạy validate trên file đối chiếu; in danh sách lỗi. Kỳ vọng chỉ còn tối đa:
khối a-d dư sau Câu 6 (nếu chọn báo lỗi) và có thể 1-2 cảnh báo nguồn; KHÔNG còn hàng trăm lỗi.
Nếu vẫn lỗi, ghi rõ lý do vào Báo cáo.

**Commit:** `wip(parser): phien 6 - validate va loi cong thuc`

**Báo cáo phiên 6 (điền sau khi code):**
- Đã làm:
- File đã sửa/tạo:
- Kiểm thử:
- Việc tiếp theo (phiên 7): lưu + hiển thị ảnh lựa chọn.

---

### Phiên 7 — Lưu & hiển thị ảnh công thức trong lựa chọn

**Mục tiêu:** ảnh công thức trong A-D hiện ở bản nháp, màn sửa lỗi và câu hỏi; lưu DB để HS thấy.

**Việc làm**
1. Quyết định lưu: thêm cột `bodyHtml` cho `question_options` để không trộn HTML vào `content`.
   - `lib/db/index.ts`: thêm
     `ALTER TABLE question_options ADD COLUMN IF NOT EXISTS "bodyHtml" text` vào `ensureSchema`.
   - `lib/db/schema.ts`: thêm `bodyHtml: text("bodyHtml")` vào `questionOptions`.
   - `types/index.ts`: `QuestionOptionDto` thêm `bodyHtml?: string | null`.
2. Parser: sau `attachBodyHtml`, dựng `bodyHtml` cho từng option có token; giữ `content` là text đã
   bỏ token (như `attachBodyHtml` đang làm cho đề). Thêm hàm `attachOptionBodyHtml(result, images, tables)`.
3. `lib/worksheet-import.ts` `persistParseResult`: ghi `bodyHtml: o.bodyHtml ?? null` khi insert
   `questionOptions`; `previewParseResult` giữ `bodyHtml` của option.
4. UI đọc ảnh option bằng component `QuestionStem` (đã sanitize `img/table`):
   - `components/teacher/worksheet-importer.tsx`: render mỗi lựa chọn bằng `QuestionStem`
     (`content` + `bodyHtml`), vẫn tô đậm nếu `isCorrect`.
   - `components/teacher/question-editor.tsx` (dòng ~198), `components/student/tab4-quiz.tsx`
     (dòng ~214, ~234), `components/live/quiz-stage.tsx` (dòng ~110): lựa chọn nào có `bodyHtml`
     thì render `QuestionStem`, không thì render text như cũ.
   - `components/teacher/import-error-fix.tsx`: đã có preview ảnh; kiểm tra ảnh SVG hiện đúng.
5. KHÔNG đổi màn HS khác ngoài 2 file trên (tránh lan rộng).

**Kiểm thử:** upload file đối chiếu -> lưu -> mở `/teacher/questions` và 1 câu HS: Câu 5/21 thấy
phân số thay vì A. rỗng. Nếu chưa có DB thì chỉ kiểm tra type-check + preview.

**Commit:** `wip(parser): phien 7 - luu va hien anh trong lua chon`

**Báo cáo phiên 7 (điền sau khi code):**
- Đã làm:
- File đã sửa/tạo:
- Kiểm thử:
- Việc tiếp theo (phiên 8): chạy end-to-end file đối chiếu + chốt.

---

### Phiên 8 — Kiểm thử end-to-end file đối chiếu + chốt

**Mục tiêu:** chạy trọn luồng trên `BAI 1 - GENE VA SU TAI BAN DNA.docx`, dọn nốt lỗi, chốt.

**Việc làm**
1. Chạy end-to-end (dev server hoặc script): validate -> sửa (nếu còn) -> save -> xem preview.
2. Đối chiếu số lượng kỳ vọng từ file đối chiếu:
   - MC: 35 câu; TF: 6 câu (+ khối dư xử lý theo phiên 5); SA: 10 câu.
   - Tổng câu hợp lệ ~51 (sau khi cắt đuôi), không còn ~107.
   - Câu 5, 21, 35 có ảnh công thức trong lựa chọn.
3. Sửa các lỗi còn lại (nếu có) và cập nhật lại "Báo cáo phiên" của các phiên liên quan.
4. Cập nhật hướng dẫn UI (`worksheet-importer.tsx`) mô tả mốc nhóm dính + `Câu n.` + `Đáp án:`.
5. Chạy `pnpm lint` (và build nếu kịp) trước khi chốt.
6. Cập nhật mục "Trạng thái" cuối file này.

**File:** có thể sửa `components/teacher/worksheet-importer.tsx`, `suapraser.md`, và file phát sinh lỗi.

**Commit:** `wip(parser): phien 8 - kiem thu file doi chieu va chot`

**Báo cáo phiên 8 (điền sau khi code):**
- Đã làm:
- File đã sửa/tạo:
- Kiểm thử:
- Việc tiếp theo: không.

---

## 5. Quy trình bắt buộc sau mỗi phiên

1. Tự kiểm bằng script/ứng dụng trước khi commit.
2. Điền mục "Báo cáo phiên N" trong file này (đã làm / file / kiểm thử / việc tiếp theo).
3. `git add` đúng file của phiên; commit `wip(parser): phien N - <tom tat>`; push lên remote.
4. Phiên sau chỉ đọc file này + các file được nêu trong phiên đó, KHÔNG đọc lại toàn repo.

## 6. Trạng thái

- Phiên hiện tại: sẵn sàng phiên 4.
- Phiên 1: xong
- Phiên 2: xong
- Phiên 3: xong
- Phiên 4: chưa
- Phiên 5: chưa
- Phiên 6: chưa
- Phiên 7: chưa
- Phiên 8: chưa

## 7. Quyết định đã chốt với người dùng

1. Phụ thuộc hệ thống: **ĐỒNG Ý** dùng `wmf2svg` (apt `libwmf-bin`) cho ảnh MathType OLE WMF,
   giữ fallback JS khi thiếu gói.
2. Lưu ảnh lựa chọn: **ĐẦY ĐỦ** — thêm cột `question_options.bodyHtml`, lưu DB, hiển thị bằng
   `QuestionStem` ở preview GV, editor, màn HS và live.
3. Khối a-d dư sau TF Câu 6: **BÁO LỖI RÕ** "Các ý a)-d) không thuộc câu nào (thiếu Câu n.)",
   KHÔNG tạo câu giả.
