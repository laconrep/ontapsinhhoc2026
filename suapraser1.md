# Kế hoạch sửa preview nạp file + ảnh công thức + sửa lỗi tại chỗ (6 phiên)

Mục tiêu: (1) ảnh công thức MathType không còn chồng chữ / sai phân số (Câu 35 MC);
(2) khung phải luôn là xem trước đầy đủ đã parse; (3) bấm lỗi bên trái nhảy tới khối
tương ứng và cho GV sửa tại chỗ; (4) điểm kiến thức thiếu gạch chân vẫn CHẶN lưu,
GV click từ để bọc `__từ__` (ô cố định) hoặc đánh `"từ"` (ô đổi chỗ) ngay trên khung sửa.

Trạng thái: **chưa code phiên 1–6**. Đây là nguồn sự thật. Phiên sau chỉ đọc file này
+ đúng các file nêu trong phiên đó, KHÔNG đọc lại toàn repo. Parser lõi (`parseTextContent`,
mốc `#`/`##`/`###`, MC/TF/SA, cắt đuôi) đã xong ở `suapraser.md` — KHÔNG viết lại vòng lặp.

File đối chiếu: `BAI 1 - GENE VA SU TAI BAN DNA.docx` (gốc repo).

Quy ước commit mỗi phiên: `wip(preview): phien N - <tom tat>`.
Mỗi phiên: làm -> tự kiểm (script/node) -> điền "Báo cáo phiên N" -> commit + push.

KHÔNG commit `package-lock.json`, `tsconfig.tsbuildinfo`, `scripts/dump-*.mjs`.

---

## 0. Quyết định đã chốt với người dùng (không hỏi lại)

1. Ảnh sai (Câu 35 MC): sửa renderer WMF fallback. Không đoán ảnh. Token `@@IMGn@@`
   gắn đúng chỗ (đề vs A-D) đã đúng từ parser phiên 4–7; sai là SVG chồng chữ vì
   gói `wmf` mất toạ độ (mọi `text.p = [0,0]`).
2. Layout sau kiểm tra: LUÔN 2 cột, cả khi còn lỗi.
   - Trái: danh sách lỗi (bấm được).
   - Phải: xem trước HẾT tài liệu đã parse (KP, đề, A-D, ảnh/bảng) như GV/HS thấy.
   Bỏ dump source + HTML cả file ở khung phải hiện tại.
3. Bấm lỗi trái: khung phải nhảy tới đúng khối (KP hoặc câu) và cho sửa tại chỗ.
   Sửa xong parse lại; preview + lỗi cập nhật. Vẫn chặn lưu nếu còn lỗi.
4. Điểm kiến thức chưa gạch chân: **GIỮ CHẶN LƯU** (cách 1).
   Trong khung sửa khối đó:
   - Ô cố định: click chọn từ → bọc `__từ__`.
   - Ô đổi chỗ: đánh `"từ"` ngay trên khung sửa (nút/toggle bọc selection bằng `"`).
5. Không đụng màn HS khác (`tab4-quiz`, `quiz-stage`, `question-editor` ngoài importer).

---

## 1. Phát hiện đã kiểm chứng (khỏi điều tra lại)

Chạy `extractAndParse` file đối chiếu (đã làm, phiên parser 8):
- `chapters:1, lessons:1, kps:22, questions:51` (`MC:35 TF:6 SA:10`).
- Validate 2 lỗi nguồn: L227 khối a-d dư; L14 KP không gạch chân
  (`Gene cấu trúc: Gene mã hóa pro...`).
- Câu 35 MC line=177, lựa chọn A content có `@@IMG13@@` rồi thành `bodyHtml` có `<img>`.
- Token `@@IMG13@@` ĐÚNG chỗ A. Sai là nội dung SVG: fallback JS vẽ mọi `<text>` tại
  `(0, height)` nên `G2` chồng `C3` chồng `=`.

Dump WMF (gói `wmf` sau strip placeable 22 byte + bỏ META_ESCAPE 1574):
- 20 file WMF, mọi `text.p = [0,0]`, `poly = 0`. Không có toạ độ thật.
- WMF #9 (Câu 35 A): texts `G2`, `C3`, `=`. Word XML lần 2 (HƯỚNG DẪN) ghi `GC = 23`
  tức phân số G/C = 2/3. Renderer phải dựng `(G/C) = (2/3)` không chồng chữ.
- WMF 2 token không `=`: `A+G` + `T+C` → phân số (A+G)/(T+C). `1`+`4` → 1/4.
- WMF 4 token có `=`: `A+G`, `4`, `T+C`, `=` → (A+G)/(T+C) = 4. (thứ tự extract:
  tử, mẫu hoặc tử, hệ số, mẫu, `=` — xem rule phiên 1).
- WMF 3 token `A+G9`, `T+C6`, `=` → splitAlphaNum: (A+G)/(T+C) = 9/6.
- `wmf2svg` (apt `libwmf-bin`) KHÔNG có trong môi trường hiện tại
  (`Unable to locate package`). Phải sống bằng fallback JS. Nếu `wmf2svg` có sau này,
  nhánh `execFile("wmf2svg")` vẫn ưu tiên (đã có, giữ nguyên).

Mammoth HTML Câu 35 (preprocessOmml rồi convert):
```
A. Trên mạch 1 của gene D có <sub>[WMF]</sub>.
B. Số liên kết hydrogen...
<u>C.</u><u> Trên mạch 2...</u>
```
Không phải lệch index OMML. OMML Câu 35 nằm ở phần HƯỚNG DẪN (token IMG36+), đã cắt đuôi.

`saveWorksheetFromText` (`lib/worksheet-import.ts` 214–221) chỉ `parseTextContent(text)`
— MẤT `bodyHtml` ảnh. Khi GV sửa draft rồi Lưu, nếu `draftDirty` thì ảnh biến.
Phiên 5 phải gắn lại images/tables khi save từ text.

---

## 2. Điểm mốc code hiện tại (không đọc lại file dài)

### `lib/docx-equations.ts` (~495 dòng, working tree có thêm reconstruct CHƯA commit)
- Dòng 53 `isConvertibleMetafile`.
- Dòng 63 `wmfToSvg(buffer)`: ghi tmp, `execFile("wmf2svg")`, fail → `wmfToSvgFallback`.
- Dòng 100 `wmfToSvgFallback`: strip placeable, bỏ META_ESCAPE, `wmf.get_actions`.
- Working tree (CHƯA commit): sau `get_actions`, nếu mọi text cùng origin `[0,0]` thì
  gọi `reconstructMathTypeSvg(tokens)`. Hàm này đã viết nhưng CẦN SIẾT rule (phiên 1)
  vì nhánh `A+G,4,T+C,=` dễ dựng sai.
- `reconstructMathTypeSvg` hiện: `splitAlphaNum(/^([A-Za-z][A-Za-z+\-\s]*?)(\d+)$/)`.
- KHÔNG export `reconstructMathTypeSvg` trừ khi script test cần — nên export để test.

### `lib/extract-file.ts` (87 dòng)
- Nhánh docx: `preprocessOmml` → mammoth `convertImage` (WMF→svg) → thay `@@MATH` →
  `parseHtmlToResultAndText`. KHÔNG sửa trừ khi phiên 1 cần.

### `lib/worksheet-parser.ts` (873 dòng)
- `extractBlanks(raw)` dòng 82: `__từ__` cố định, `"từ"` hoán đổi, `__"từ"__` cả hai.
- `parseTextContent` dòng 333 — GIỮ NGUYÊN.
- `attachBodyHtml` 694, `attachOptionBodyHtml` 710: token → HTML, `content` bỏ token.
- `sourceTextToPreviewHtml` 728: dump từng dòng source + thay token. Khung phải MỚI
  KHÔNG dùng hàm này làm preview chính (có thể giữ cho chỗ khác).
- `parseHtmlToResultAndText` 740: parse + attach cả hai.
- `validateDocument` 789: KP `underlinedTerms.length === 0` → lỗi
  `Điểm kiến thức phải có ít nhất 1 từ gạch chân (__từ__ hoặc "từ"): "..."` + `line: kp.line`.
  GIỮ rule này (chặn lưu).
- `isCauHeading` 224, `summarize` 856.

### `lib/worksheet-import.ts`
- `previewParseResult` 29: copy `bodyHtml` câu + option.
- `validateWorksheetBuffer` 59: extract + validate + images/tables.
- `persistParseResult` 77: insert `questions.bodyHtml`, `questionOptions.bodyHtml`.
- `saveWorksheetBuffer` 205: extractAndParse rồi persist.
- `saveWorksheetFromText` 214: **chỉ parse text, mất ảnh** — sửa phiên 5.

### API
- `app/api/worksheet/validate/route.ts`: POST file → `validateWorksheetBuffer`.
- `app/api/worksheet/save/route.ts`: nếu FormData có `text` (string) →
  `saveWorksheetFromText`; không thì `saveWorksheetBuffer`.

### UI importer
- `components/teacher/worksheet-importer.tsx` (~434 dòng):
  - State: `file`, `preview`, `draftText`, `originalSource`.
  - `doValidate` → `/api/worksheet/validate`.
  - `doSave`: nếu `draftDirty` gửi `text`+`filename`, không thì gửi `file`.
  - Dòng 140: `max-w-5xl` chỉ khi `!preview.isValid`, hợp lệ thì `max-w-3xl`.
  - Dòng 278–288: `!isValid` → `ImportErrorFix`; `isValid` → `PreviewPanel`.
    ĐỔI: luôn hiện 2 cột (lỗi trái có thể rỗng / "Hết lỗi").
  - `PreviewPanel` 293: render chương/bài/KP/`QuestionStem`/options. Tách ra dùng chung.
  - `highlightBlanks` 411: tô ô trống KP. Giữ / chuyển sang file dùng chung.
- `components/teacher/import-error-fix.tsx` (226 dòng):
  - Trái: list lỗi, `selectError` → `questionBlockRange` + `setSelectionRange` trên
    **textarea cả file**. Phải: textarea source + `sourceTextToPreviewHtml` nửa dưới.
    ĐỔI hết khung phải (phiên 2–4). Giữ `applyRevalidate` / debounce 1000ms /
    `onRevalidated` payload.
  - `questionBlockRange` 36: lùi tới `#` hoặc `Câu n.`, tiến tới biên `{[+-/#`.
    Phiên 3 phải nhận cả dòng `-` (KP) khi lỗi là KP.
- `components/question/question-stem.tsx`: sanitize `img` `table` `u`; data URI hoặc `/`.
  Dùng lại cho preview phải. `[&_img]:max-h-48` — công thức nên nhỏ hơn, phiên 2 có thể
  thêm class `[&_img]:inline [&_img]:max-h-10` cho option (không bắt buộc).

### Lưu khi sửa text
- `draftText` là source có `@@IMGn@@`. Parse client: `parseTextContent` +
  `attachBodyHtml` + `attachOptionBodyHtml` với `preview.images` / `preview.tables`
  (index token không đổi nếu GV không xoá token).
- Save server: `saveWorksheetFromText` phải nhận images/tables HOẶC chỉ lưu text
  rồi attach lại. Chốt phiên 5: truyền `images`/`tables` JSON trong FormData khi
  `draftDirty`, server attach trước persist. Nếu không truyền được: lưu file gốc
  khi chưa đụng token, còn KP chỉ thêm `__` thì token còn nguyên — attach từ mảng
  images của lần validate (cần gửi kèm).

---

## 3. Sáu phiên code

### Phiên 1 — Dựng lại phân số MathType WMF khi mất toạ độ

**Mục tiêu:** Câu 5/21/35 (và mọi WMF cùng origin) hiện phân số đúng, không chồng chữ.

**Việc làm** (chỉ `lib/docx-equations.ts` + script test)
1. Giữ ưu tiên `wmf2svg`. Fallback khi mọi text `p` cùng điểm:
   `reconstructMathTypeSvg(texts.map(a => a.v))`.
2. Rule dựng (chốt, đừng đoán thêm):
   - Tách token `=` ra. `splitAlphaNum`: đuôi số của token chữ+số (`G2`→ G, 2; `A+G9`→ A+G, 9).
   - 2 token, không `=`: luôn 1 phân số tử/mẫu (`A+G`/`T+C`, `1`/`4`, `G2`/`C3` nếu
     không tách được thì vẫn 2 dòng G2 trên C3 — nhưng `G2`+`C3`+`=` xử lý ở dưới).
   - 3 token dạng `X, Y, =` với X=`G2` Y=`C3`: (G)/(C) = (2)/(3).
     Tức 2 token chữ+số cùng `=` → phân số chữ / phân số số.
   - 3 token `A+G9, T+C6, =`: (A+G)/(T+C) = 9/6. Cùng rule splitAlphaNum.
   - 4 token `A+G, 4, T+C, =`: (A+G)/(T+C) = 4. (tử, hệ số, mẫu, `=`).
   - Còn lại: xếp token theo hàng, `=` ở giữa, không chồng.
3. SVG: `<text>` tử, `<line>` gạch, `<text>` mẫu, `text-anchor=middle`, width/height
   theo độ dài chữ (fs~18, không dùng extent 1088px). Có `xmlns`.
4. Export `reconstructMathTypeSvg` để test thuần (không cần docx).
5. Script `scripts/check-preview-phien1.mjs`:
   - Gọi reconstruct với các mảng token trên; decode base64; assert có `<line` và
     không có hai `<text` cùng `x=` `y=` chồng.
   - `extractAndParse` file đối chiếu; Câu 35 option A `bodyHtml` có `<img` và SVG
     decode có gạch `<line` (không còn 3 text cùng origin).
6. Revert/không giữ `scripts/dump-c35-xml.mjs`, `scripts/dump-wmf-c35.mjs`.

**File:** `lib/docx-equations.ts`, `scripts/check-preview-phien1.mjs` (mới).
Có thể đã có reconstruct trong working tree — siết rule rồi commit lần này.

**Kiểm thử:** Câu 35 A ra G/C = 2/3 (có gạch). Câu 5 A ra (A+G)/(T+C). `tsc --noEmit`.

**Commit:** `wip(preview): phien 1 - dung lai phan so MathType WMF`

**Báo cáo phiên 1 (điền sau khi code):**
- Đã làm: Fallback WMF khi mọi text cùng origin gọi `reconstructMathTypeSvg`. Rule: 2 token không `=` → phân số; `G2,C3,=` → G/C = 2/3; `A+G9,T+C6,=` → (A+G)/(T+C)=9/6; `A+G,4,T+C,=` → (A+G)/(T+C)=4. SVG có `<line>` gạch, `text-anchor=middle`, xmlns, kích thước theo chữ.
- File đã sửa/tạo: `lib/docx-equations.ts`, `scripts/check-preview-phien1.mjs`
- Kiểm thử: `tsx scripts/check-preview-phien1.mjs` OK (Câu 35 A = G/C=2/3 có gạch; Câu 5 đề = (A+G)/(T+C)). `npx tsc --noEmit` exit 0.
- Việc tiếp theo (phiên 2): layout 2 cột preview parse.

---

### Phiên 2 — Layout 2 cột: lỗi trái + xem trước phải (luôn hiện)

**Mục tiêu:** Sau "Kiểm tra tài liệu", luôn 2 cột. Phải = preview parse đầy đủ.
Không còn textarea cả file + dump HTML.

**Việc làm**
1. Tách `PreviewDocument` (từ `PreviewPanel`) ra component dùng chung, props:
   `{ parseResult, summary, isValid, errors?, highlightLine?: number, onSelectBlock?: (line: number) => void }`.
   Mỗi khối KP/câu có `data-line={kp.line|q.line}` và `id="preview-line-{n}"` để scroll.
   Câu có `bodyHtml`/`options[].bodyHtml` → `QuestionStem`. KP → `highlightBlanks`.
2. `worksheet-importer.tsx`:
   - Container luôn `max-w-5xl` khi có preview.
   - Bỏ nhánh `isValid ? PreviewPanel : ImportErrorFix`.
   - Luôn render `ImportErrorFix` (khi có preview), kể cả 0 lỗi (trái hiện "Hết lỗi,
     có thể lưu" + nút không bắt buộc).
3. `import-error-fix.tsx` khung phải: thay textarea+dump bằng `PreviewDocument`.
   Trái giữ list lỗi. Debounce revalidate GIỮ nhưng không hiện editor cả file.
   (Editor khối = phiên 3; phiên này bấm lỗi chỉ `scrollIntoView` tới `preview-line-N`).
4. Props thêm `parseResult` (để không parse 2 lần lúc mount). Vẫn gọi
   `parseTextContent`+attach khi `sourceText` đổi.

**File:** `components/teacher/worksheet-importer.tsx`, `components/teacher/import-error-fix.tsx`,
có thể tạo `components/teacher/worksheet-preview-doc.tsx`.

**Kiểm thử:** typecheck. File đối chiếu: preview phải có 51 câu, Câu 35 A có img.
Không regress parse (`tsx scripts/check-parser-phien8.mjs` nếu deps có).

**Commit:** `wip(preview): phien 2 - khung xem truoc parse 2 cot`

**Báo cáo phiên 2 (điền sau khi code):**
- Đã làm: Tách `PreviewDocument` (KP + câu + ảnh/options). Importer luôn `max-w-5xl` khi có preview, luôn 2 cột (`ImportErrorFix`): trái list lỗi hoặc "Hết lỗi, có thể lưu"; phải preview parse. Bấm lỗi → `scrollIntoView` `#preview-line-N`. Bỏ textarea cả file + dump HTML.
- File đã sửa/tạo: `components/teacher/worksheet-preview-doc.tsx` (mới), `components/teacher/worksheet-importer.tsx`, `components/teacher/import-error-fix.tsx`
- Kiểm thử: `npx tsc --noEmit` exit 0. `tsx scripts/check-parser-phien8.mjs` OK (51 câu, MC35 TF6 SA10, Câu 35 A có img).
- Việc tiếp theo (phiên 3): sửa tại chỗ theo lỗi.

---

### Phiên 3 — Bấm lỗi → nhảy khối + sửa source khối đó

**Mục tiêu:** Bấm lỗi trái: phải scroll tới khối, mở editor đúng đoạn source
(không mở cả 800 dòng). Sửa xong ghi lại `draftText` tại offset, revalidate.

**Việc làm**
1. Helper `blockRange(text, line)` (sửa `questionBlockRange`):
   - Nếu dòng `line` (sau trim) là `- ...` hoặc lỗi message chứa `Điểm kiến thức`
     → khối = đúng dòng KP đó (1 dòng, có thể nối dòng lạ đã gộp vào `kp.content`
     nhưng source gốc KP là 1 dòng `-`).
   - Nếu `Câu n.` / `#` → như cũ: từ heading câu đến biên `{` `[` `-` `#` `Câu` tiếp /
     `ĐÁP ÁN` / hết.
   - Trả `{ startLine, endLine }` 1-based. Giữ `offsetRange`.
2. State `activeRange`. Bấm lỗi: set range, scroll preview, hiện `<textarea>` NGAY
   dưới (hoặc thay) khối đó trên cột phải, value = `lines.slice(start,end).join("\n")`.
3. onChange textarea khối: `newText = prefix + edit + suffix` (giữ `\n`),
   `onSourceChange(newText)`, debounce `applyRevalidate`.
   Giữ `@@IMGn@@` nếu GV không xoá. Cảnh báo nhỏ nếu token bị xoá.
4. Nút "Xong" / blur → flush revalidate, có thể đóng editor (preview HTML lại).
5. Không sửa parser.

**File:** `components/teacher/import-error-fix.tsx` (+ helper range). Có thể
`lib/worksheet-source-range.ts` nếu muốn test range bằng script.

**Kiểm thử:** text mẫu 2 câu + 1 KP; `blockRange` L14 = dòng KP; L177 = Câu 35 đến
trước `##`. Script thuần cho helper nếu tách file.

**Commit:** `wip(preview): phien 3 - bam loi sua dung khoi`

**Báo cáo phiên 3 (điền sau khi code):**
- Đã làm: Tách `blockRange`/`offsetRange`/`spliceBlock`. KP (`-` hoặc message Điểm kiến thức) = 1 dòng. Câu = heading đến biên `#`/`-`/`Câu`/ĐÁP ÁN. Bấm lỗi trái: scroll + textarea khối trên cột phải; onChange splice vào `draftText` + debounce revalidate; cảnh báo nếu xoá `@@IMG`/`@@TBL`; nút Xong đóng editor.
- File đã sửa/tạo: `lib/worksheet-source-range.ts` (mới), `components/teacher/import-error-fix.tsx`, `scripts/check-preview-phien3.mjs` (mới)
- Kiểm thử: `tsx scripts/check-preview-phien3.mjs` OK (L14 KP 1 dòng; Câu 35 đến trước `##`; splice không lệch). `npx tsc --noEmit` exit 0.
- Việc tiếp theo (phiên 4): click từ gạch chân KP.

---

### Phiên 4 — KP thiếu gạch chân: click từ = `__từ__`, đổi chỗ = `"từ"`

**Mục tiêu:** Lỗi KP L14 sửa được trên khung phải mà không gõ tay `__` nếu không muốn.

**Việc làm**
1. Khi khối active là KP (`line` khớp `kp.line` hoặc message `Điểm kiến thức phải có`):
   hiện thanh công cụ trên editor:
   - Mặc định chế độ **Cố định**: bôi đen / click 1 từ (regex `\S+` theo selection)
     → nếu chưa bọc thì thay selection bằng `__${selected}__`; click lại thì gỡ `__`.
   - Nút **Đổi chỗ**: cùng selection bọc `"${selected}"` (nếu đã `__x__` thì thành
     `__"x"__` theo `extractBlanks`). Click lại gỡ `"` .
   - Không bọc token `@@IMG`/`@@TBL`, không bọc cả dòng `- `.
2. Sau mỗi bọc: ghi source + revalidate. Khi `underlinedTerms.length >= 1` lỗi KP biến.
3. Giữ chặn lưu nếu còn KP không blank (`validateDocument` không đổi).
4. Preview KP dùng `highlightBlanks` ngay sau revalidate.

**File:** `components/teacher/import-error-fix.tsx` (hoặc
`components/teacher/kp-blank-editor.tsx`). Không đổi `extractBlanks`.

**Kiểm thử:** source `- Gene cấu trúc: Gene mã hóa protein.` → click `protein`
thành `__protein__` → `extractBlanks` có 1 term `allowSwap=false`. Bọc `"Gene"` →
`allowSwap=true`. Script string-level, không cần docx.

**Commit:** `wip(preview): phien 4 - click tu gach chan KP`

**Báo cáo phiên 4 (điền sau khi code):**
- Đã làm: Khi khối KP active, thanh Cố định / Đổi chỗ. Click hoặc bôi từ → `__từ__` hoặc `"từ"` (đã `__x__` thì `__"x"__`). Click lại gỡ. Không bọc `@@IMG`/`@@TBL` và gạch `- ` đầu dòng. `extractBlanks` không đổi; vẫn chặn lưu nếu KP chưa blank.
- File đã sửa/tạo: `lib/kp-blank-wrap.ts` (mới), `components/teacher/import-error-fix.tsx`, `scripts/check-preview-phien4.mjs` (mới)
- Kiểm thử: `tsx scripts/check-preview-phien4.mjs` OK (`protein` → `__protein__` allowSwap=false; `"Gene"` allowSwap=true; toggle gỡ; không bọc token/gạch). `npx tsc --noEmit` exit 0.
- Việc tiếp theo (phiên 5): save giữ ảnh.

---

### Phiên 5 — Lưu draft đã sửa vẫn giữ ảnh/bảng

**Mục tiêu:** GV sửa KP (thêm `__`) rồi Lưu: 51 câu vẫn có `bodyHtml` ảnh như lúc validate.

**Việc làm**
1. `saveWorksheetFromText(user, text, filename, images?, tables?)`:
   `parseTextContent` rồi `attachBodyHtml` + `attachOptionBodyHtml` nếu có mảng.
2. `app/api/worksheet/save/route.ts`: đọc `formData.get("images")` / `"tables"` JSON
   string (mảng HTML đã sanitize từ lần validate — client đã có `preview.images`).
3. `worksheet-importer.tsx` `doSave` khi `draftDirty`: append `text`, `filename`,
   `images`, `tables`.
4. Client revalidate đã attach — `persist` dùng kết quả server parse lại cho khớp.
5. Không gửi base64 qua console.log.

**File:** `lib/worksheet-import.ts`, `app/api/worksheet/save/route.ts`,
`components/teacher/worksheet-importer.tsx`.

**Kiểm thử:** unit: parse text Câu 5 có `@@IMG0@@` + 1 img tag → option A `bodyHtml`
có `<img` sau attach. Không cần Postgres.

**Commit:** `wip(preview): phien 5 - luu draft giu anh lua chon`

**Báo cáo phiên 5 (điền sau khi code):**
- Đã làm:
- File đã sửa/tạo:
- Kiểm thử:
- Việc tiếp theo (phiên 6): e2e + chốt.

---

### Phiên 6 — End-to-end file đối chiếu + chốt

**Mục tiêu:** Đi hết luồng trên file gene: validate còn 2 lỗi → sửa KP bằng click từ
→ còn 1 lỗi khối a-d dư (không bịa câu) → GV có thể bỏ dòng dư trên editor khối
→ hết lỗi → preview 51 câu, Câu 35 A phân số đúng.

**Việc làm**
1. Script `scripts/check-preview-phien6.mjs`: extractAndParse; Câu 35 SVG có `<line`;
   validate 2 lỗi; giả lập bọc `__protein__` (hoặc từ thật trên dòng KP L14) vào
   sourceText rồi parseTextContent+validate → mất lỗi KP; 51 câu; MC35 TF6 SA10.
2. Sửa nốt bug lộ khi e2e. Cập nhật Báo cáo các phiên liên quan.
3. `npx tsc --noEmit`. Lint nếu có config (project hiện không có eslint.config —
   đừng bịa).
4. Cập nhật mục Trạng thái cuối file này.

**File:** `scripts/check-preview-phien6.mjs`, `suapraser1.md`, file bug nếu có.

**Commit:** `wip(preview): phien 6 - e2e file doi chieu va chot`

**Báo cáo phiên 6 (điền sau khi code):**
- Đã làm:
- File đã sửa/tạo:
- Kiểm thử:
- Việc tiếp theo: không.

---

## 4. Quy trình bắt buộc sau mỗi phiên

1. Tự kiểm bằng script trước khi commit.
2. Điền "Báo cáo phiên N" trong file này.
3. `git add` đúng file phiên; commit `wip(preview): phien N - <tom tat>`; push.
4. Phiên sau chỉ đọc file này + file nêu trong phiên. Không đọc lại parser 873 dòng
   trừ khi báo cáo phiên trước ghi phải đụng.

## 5. Trạng thái

- Phiên hiện tại: sẵn sàng phiên 5.
- Phiên 1: xong
- Phiên 2: xong
- Phiên 3: xong
- Phiên 4: xong
- Phiên 5: chưa
- Phiên 6: chưa

Working tree lúc lập kế hoạch: `lib/docx-equations.ts` đã có nháp `reconstructMathTypeSvg`
(chưa commit). Phiên 1 siết rule rồi commit, không để dump script.

## 6. Việc không làm

- Không đổi rule parser MC/TF/SA, cắt đuôi, sticky `#`.
- Không bỏ chặn lưu khi KP thiếu blank.
- Không tự đoán chỗ trống KP.
- Không cài panel / tunnel / eslint giả.
- Không đụng màn HS ngoài importer/preview GV.
