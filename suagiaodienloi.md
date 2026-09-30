# Ke hoach giao dien sua loi sau khi kiem tra file (6 phien)

Muc tieu: sau khi GV upload + bam "Kiem tra tai lieu", neu con loi thi hien 2 cot. Trai: danh sach loi (click duoc). Phai: van ban trich (phan parser khong nhan / dong loi), GV sua truc tiep. Click loi -> nhay toi dung doan do. Het sua 1 cau (blur hoac dung go 1s) thi parse lai doan do, cap nhat danh sach loi + ban nhap. Nut "Luu vao he thong" dung ban nhap da sua, chi bat khi het loi.

Quyet dinh da chot:
- "Tu luu cau" = luu vao ban nhap trong bo nho (draft text + parseResult), KHONG insert DB tung cau. Cau chua gan bai/KP nen khong ghi DB le.
- Nut Luu van ghi DB 1 lan, tu draft text (khong gui lai file goc).
- Cot phai hien TOAN BO sourceText da trich (de parse lai dung context chuong/bai/KP). Dong loi duoc highlight. Khong chi cat manh roi (cat manh se mat `{Chuong}` `[Bai]` `-` KP).
- Khong doi parser, khong doi cu phap `#` `##` `###` `cau:` `A.B.C.D` gach chan. Khong dam man HS / man chieu / question-editor.

## Diem moc hien tai (khong can doc lai parser)

Upload da di API, khong con Server Action:
- Client: `components/teacher/worksheet-importer.tsx`
  - `postWorksheet(url, file)` -> `fetch POST` FormData field `file`
  - Kiem tra: `POST /api/worksheet/validate` -> `{ parseResult, errors, isValid, summary }`
  - Luu: `POST /api/worksheet/save` -> gui **file goc**, can `preview.isValid`
  - `PreviewPanel`: 1 cot, badge summary + list loi (khong click) + cay chuong/bai/KP da parse
- API: `app/api/worksheet/validate/route.ts`, `app/api/worksheet/save/route.ts`
- Logic: `lib/worksheet-import.ts`
  - `validateWorksheetBuffer(buffer, filename)` goi `extractAndParse` roi `validateDocument` + `previewParseResult` (bo `bodyHtml` khoi preview)
  - `saveWorksheetBuffer(user, buffer, filename)` parse lai tu buffer, insert DB
- Extract: `lib/extract-file.ts` `extractAndParse(buffer, filename): Promise<ParseResult>`
  - txt: `parseTextContent(utf8)`
  - docx: mammoth html -> `parseHtmlContent`
  - pdf: pdf-parse text -> `parseTextContent`
  - **Khong tra sourceText** (phien 1 phai them)
- Parser (CHI GOI, khong sua): `lib/worksheet-parser.ts`
  - `parseTextContent(text): ParseResult` — line 1-based theo `text.split(/\r?\n/)`, bo dong trong va `//`
  - `validateDocument(result): { isValid, errors: { line?, message }[] }` — gop `result.errors` + rule MC 4 option 1 dung / TF 4 y / SA co dap an / KP co gach chan / bai co KP
  - `summarize(result): { chapters, lessons, kps, questions }`
  - Loi cu phap thuong co `line`. Loi tong quat (thieu bai) co the khong co `line`.
- Preview type client (local trong importer, khong import `lib/worksheet-import.ts` vi file do dung db):
  ```
  parseResult, errors: { line?: number; message: string }[], isValid, summary
  ```
- File mau khong doi. Gioi han 10MB giu nguyen.

Vi du loi (de hieu click -> dong):
- `Dòng 6: Không dùng dấu +. Dùng A. B. C. D. ...` -> cot phai nhay toi dong 6
- `Câu trắc nghiệm phải có đúng 4 lựa chọn` -> `line` = dong `#` cua cau do

## File se dam den (toan bo 6 phien)

- `lib/extract-file.ts` — tra them `sourceText`
- `lib/worksheet-import.ts` — preview kem `sourceText`; save tu text
- `app/api/worksheet/validate/route.ts` — JSON co `sourceText`
- `app/api/worksheet/save/route.ts` — nhan `file` HOAC field `text` + `filename`
- `components/teacher/worksheet-importer.tsx` — state draft, 2 cot khi co loi
- `components/teacher/import-error-fix.tsx` — UI 2 cot (tao o phien 2)
- `suagiaodienloi.md` — bao cao moi phien

Khong dam: `lib/worksheet-parser.ts` (logic parse/validate), man HS, quiz-stage, question-editor, schema DB.

---

## Phien 1 — Tra sourceText khi kiem tra

### Muc tieu
API validate tra van ban da trich, line trung voi `errors[].line`. Chua doi layout 2 cot.

### Viec lam
1. `lib/extract-file.ts`: doi return thanh `{ parseResult, sourceText }`.
   - txt: `sourceText = buffer.toString("utf8")`, parse `parseTextContent(sourceText)`.
   - pdf: `sourceText = res.text` (pdf-parse), parse `parseTextContent(sourceText)`.
   - docx: sau khi `parseHtmlContent` noi bo ra text (cung chuoi dua vao `parseTextContent`). Cach gon: export helper hoac cho `parseHtmlContent` tra `{ result, text }` — **uu tien khong sua parser**: copy pipeline HTML->text vao extract-file CHI neu bat buoc; tot hon: them ham `htmlToParseText(html): string` trong `extract-file.ts` (duplicate nhe pipeline img/table/strip) ROI `parseTextContent`. KHONG sua `parseHtmlContent` neu van lay dung text.
   - **Quyet dinh ky thuat phien 1:** them `extractToText(buffer, filename): Promise<{ kind, sourceText }>` roi `parseTextContent`/`parseHtmlContent` nhu cu. Voi docx: `sourceText` = text ma `parseHtmlContent` dang dua vao `parseTextContent` (co token `@@IMGn@@` `@@TBLn@@` neu co anh/bang). Giu token de line khong lech.
2. Moi cho goi `extractAndParse`: cap nhat.
   - `validateWorksheetBuffer`: `const { parseResult, sourceText } = await extractAndParse(...)`; tra them `sourceText` tren `WorksheetPreview`.
   - `saveWorksheetBuffer`: van chi can `parseResult` (bo qua sourceText) — `const { parseResult } = await extractAndParse(...)`.
3. Type `WorksheetPreview` them `sourceText: string`.
4. Client importer: nhan `sourceText` vao state preview, **chua hien textarea**. PreviewPanel cu giu nguyen.
5. Khong doi save API. Khong doi UI 2 cot.

### File
- Sua: `lib/extract-file.ts`
- Sua: `lib/worksheet-import.ts`
- Sua: `components/teacher/worksheet-importer.tsx` (type + giu `sourceText` trong preview)
- Goi `extractAndParse` khac (neu con): grep `extractAndParse` — chi `worksheet-import.ts` + `app/actions/worksheet.ts` (action cu, it dung). Cap nhat action neu van compile.

### Bao cao phien 1 (dien sau khi code)

- Da lam:
  - `extractAndParse` tra `{ parseResult, sourceText }`. txt/pdf: sourceText = chuoi dua vao `parseTextContent`. docx: `parseHtmlToResultAndText` (cung text parser dung, giu `@@IMGn@@` `@@TBLn@@`).
  - `validateWorksheetBuffer` kem `sourceText` tren `WorksheetPreview`. `saveWorksheetBuffer` chi lay `parseResult`.
  - Client type preview them `sourceText`. PreviewPanel 1 cot giu nguyen, chua textarea. Khong doi save API.
  - `parseHtmlContent` van giu (wrapper), logic parse khong doi.
- File da sua/tao:
  - `lib/extract-file.ts`
  - `lib/worksheet-parser.ts` (chi tach `parseHtmlToResultAndText`, khong doi rule)
  - `lib/worksheet-import.ts`
  - `components/teacher/worksheet-importer.tsx`
- Viec tiep theo (phien 2): layout 2 cot, chua click/nhay dong.

---

## Phien 2 — Layout 2 cot (loi | van ban)

### Muc tieu
Khi `preview && !preview.isValid`: thay PreviewPanel 1 cot bang 2 cot. Khi hop le: giu panel cu (badge + cay da parse).

### Viec lam
1. Tao `components/teacher/import-error-fix.tsx` (client):
   - Props: `errors`, `sourceText`, `onSourceChange?(text)` (phien 2 co the no-op / chi controlled).
   - Grid `md:grid-cols-2`, 2 khung `min-h-[420px] max-h-[70vh] overflow-auto` border.
   - Trai: list loi nhu hien tai (`Dòng N: message`), chua can onClick that (placeholder `button` disabled hoac chua nhay).
   - Phai: `<textarea>` monospaced, `value={sourceText}`, `onChange` goi `onSourceChange`. `whitespace-pre` / font-mono text-sm. Khong sanitize HTML (day la text parse).
2. `worksheet-importer.tsx`:
   - State `draftText` set = `res.sourceText` khi validate xong.
   - Neu `preview && !preview.isValid`: render `ImportErrorFix`.
   - Neu `preview && preview.isValid`: render `PreviewPanel` cu.
   - Nut Luu van `disabled={!preview?.isValid}` (phien 2 sua text chua re-validate nen van disable).
3. Khong parse lai. Khong highlight dong. Khong luu DB.

### File
- Tao: `components/teacher/import-error-fix.tsx`
- Sua: `components/teacher/worksheet-importer.tsx`

### Bao cao phien 2 (dien sau khi code)

- Da lam:
  - Tao `ImportErrorFix`: grid 2 cot khi co loi. Trai: list loi (button, chua nhay dong). Phai: textarea mono, `value={sourceText}`, `onChange` -> `onSourceChange`.
  - Importer: `draftText` set tu `res.sourceText` sau validate. `!isValid` -> `ImportErrorFix`; `isValid` -> `PreviewPanel` cu. Nut Luu van `disabled={!preview?.isValid}`.
  - Khong parse lai, khong highlight, khong luu DB.
- File da sua/tao:
  - `components/teacher/import-error-fix.tsx` (tao)
  - `components/teacher/worksheet-importer.tsx`
- Viec tiep theo (phien 3): click loi -> nhay + highlight dong.

---

## Phien 3 — Click loi, nhay toi dong

### Muc tieu
Click 1 loi co `line` -> cot phai cuon toi dong do, highlight. Loi khong `line`: khong nhay, van chon item (optional toast nhe).

### Viec lam
1. Cot phai khong dung textarea thuan neu kho highlight 1 dong. Uu tien:
   - Cach A (don gian, chap nhan): textarea + `setSelectionRange` theo offset dong, `scrollTop = lineHeight * (line-1)`.
   - Cach B: overlay 1 cot so dong + textarea.
   - **Chot cach A.** Tinh offset: `lines = draftText.split('\n')`; start = sum(length+1) cua lines[0..line-2]; end = start + lines[line-1].length. `lineHeight` ~ 20px hoac do `scrollHeight / lineCount`.
2. State `activeErrorIndex` trong `ImportErrorFix`. Item trai la `button`; active: `bg-destructive/15`.
3. Click -> `activeErrorIndex` + scroll/select. Neu `!e.line` thi chi set active, khong scroll.
4. Khi GV go trong textarea, khong xoa active cho den phien 4.

### File
- Sua: `components/teacher/import-error-fix.tsx`

### Bao cao phien 3 (dien sau khi code)

- Da lam:
  - Click loi co `line`: `setSelectionRange` theo offset dong + `scrollTop = lineHeight * (line-1)` (cach A). Loi khong `line`: chi set active, khong nhay.
  - `activeErrorIndex` + item trai `button`, active `bg-destructive/15`. Go trong textarea khong xoa active.
- File da sua/tao:
  - `components/teacher/import-error-fix.tsx`
- Viec tiep theo (phien 4): debounce parse lai khi sua xong cau.

---

## Phien 4 — Parse lai khi sua xong cau (chua merge DB)

### Muc tieu
Het sua 1 cau -> chay `parseTextContent` + `validateDocument` tren **toan bo draftText**. Cap nhat list loi ben trai. Chua doi nut Luu / chua gui text len server.

### Viec lam
1. Parser chay **tren client** duoc: `lib/worksheet-parser.ts` khong import db. Importer/ImportErrorFix `import { parseTextContent, validateDocument, summarize } from "@/lib/worksheet-parser"`.
2. The nao la "xong cau":
   - Debounce 1000ms sau `onChange`, VA
   - `onBlur` textarea.
   - Khong can cat block cau o phien 4: parse **ca file** moi lan. Don gian, dung.
3. Callback `onRevalidated({ errors, isValid, parseResult, summary })` len importer: set lai `preview` giu `sourceText: draftText`.
4. Sau revalidate: neu `activeError.line` con trong errors thi giu highlight; khong thi chon loi dau tien (neu con) hoac bo active.
5. Dang debounce: badge nho "Dang kiem tra..." tren cot trai (optional).
6. Van **khong** enable Luu khi isValid o phien nay neu muon tach; **chot: enable Luu khi isValid** (client-side) — nhung `doSave` van gui **file goc** (sai). Phien 5/6 moi chuyen save sang draft. Tam: neu GV sua het loi, nut Luu sang, nhung bam Luu van luu file cu — **disable Luu cho den phien 5** neu `draftText !== originalSource` de tranh ghi nham. Chot: phien 4 `doSave` van disable khi `draftDirty` (draftText !== sourceText luc validate). Phien 5 mo save-from-text.

### File
- Sua: `components/teacher/import-error-fix.tsx`
- Sua: `components/teacher/worksheet-importer.tsx`

### Bao cao phien 4 (dien sau khi code)

- Da lam:
  - Client parse `parseTextContent` + `validateDocument` + `summarize` tren toan bo draft. Debounce 1000ms sau onChange va onBlur.
  - `onRevalidated` cap nhat preview (kem sourceText draft). Giu active neu `line` con; khong thi chon loi dau hoac bo active. Badge "Dang kiem tra...".
  - Nut Luu disable khi `draftDirty` (tranh luu file goc sai). Chua gui text len server.
- File da sua/tao:
  - `components/teacher/import-error-fix.tsx`
  - `components/teacher/worksheet-importer.tsx`
- Viec tiep theo (phien 5): luu ban nhap + API save tu text.

---

## Phien 5 — Ban nhap + save API nhan text

### Muc tieu
"Tu luu cau" = draftText + preview moi. Nut Luu ghi DB tu draft, khong can file goc.

### Viec lam
1. `saveWorksheetBuffer` da nhan `(user, buffer, filename)`. Them `saveWorksheetFromText(user, text, filename)` = `Buffer.from(text, "utf8")` + filename doi thanh `ten-goc.txt` (neu goc .docx/.pdf van parse nhu txt vi draft la text). **Chot:** luon parse draft bang `parseTextContent` (khong mammoth lai). Anh/bang token `@@IMG@@` neu GV khong xoa van vao `parseTextContent` roi `attachBodyHtml` **khong chay** (do do la parseHtml). Anh Word: neu GV sua text, `bodyHtml` co the mat — chap nhan o phien nay (ghi chu). Neu draft khong doi va file la docx, van save bang file goc de giu anh.
   - Nhanh: `draftDirty` -> save text utf8 qua API. `!draftDirty` -> save file goc nhu cu.
2. `POST /api/worksheet/save`: neu FormData co `text` (string) thi `saveWorksheetFromText`; else `file` nhu cu.
3. Client `doSave`:
   - Neu `draftDirty`: `FormData` append `text` = draftText, `filename` = file.name.
   - Else: append `file` nhu cu.
4. Enable Luu khi `preview.isValid` (sau parse client). Khong bat buoc bam Kiem tra lai.
5. Cot trai: khi 1 loi bien mat sau debounce, khong toast om; khi isValid toast nhe "Het loi, co the luu".

### File
- Sua: `lib/worksheet-import.ts` (them save from text)
- Sua: `app/api/worksheet/save/route.ts`
- Sua: `components/teacher/worksheet-importer.tsx`

### Bao cao phien 5 (dien sau khi code)

- Da lam:
  - `saveWorksheetFromText`: parse draft bang `parseTextContent` (khong mammoth), persist giong save file. Filename doi `.txt`.
  - `POST /api/worksheet/save`: FormData `text` + `filename` -> save from text; khong co `text` thi `file` nhu cu.
  - Client: `draftDirty` -> gui `text`; khong dirty -> gui file goc (docx giu anh). Nut Luu enable khi `preview.isValid`. Toast "Het loi, co the luu" khi revalidate het loi.
- File da sua/tao:
  - `lib/worksheet-import.ts`
  - `app/api/worksheet/save/route.ts`
  - `components/teacher/worksheet-importer.tsx`
- Viec tiep theo (phien 6): tinh lai khoi cau, polish, chot.

---

## Phien 6 — Khoi cau, polish, chot

### Muc tieu
Click loi nhay dung hon (khoi cau chu khong chi 1 dong). Xu ly meo. Cap nhat bao cao.

### Viec lam
1. Helper client `questionBlockRange(text, line): { startLine, endLine }`:
   - startLine = dong `line` di lui toi dong match `/^#{1,3}(\s|$)/` hoac `cau:`; neu khong: chinh `line`.
   - endLine = truoc marker moi (`#` `{` `[` `-` `+` `*` `//`) hoac EOF.
   - Dung de select ca khoi khi click loi (van setSelectionRange).
2. Sau blur trong khoi: neu khoi het loi, giu caret, list trai bot dung 1-nhieu dong cua khoi do.
3. Empty source / parse 0 bai: hien loi tong trong cot trai, textarea van sua duoc.
4. Kiem tra tay:
   - File dung: 1 cot preview cu, Luu file goc.
   - File co `+` dong 6: 2 cot, click -> dong 6, doi thanh `A. ...` + 4 option + gach chan -> debounce -> isValid -> Luu (text) thanh cong.
   - Dong `*` van loi.
   - File khong HTML: fallback binh thuong.
5. Khong doi file mau.

### File
- Sua: `components/teacher/import-error-fix.tsx`
- Sua: `components/teacher/worksheet-importer.tsx` (neu thieu)
- Sua: `suagiaodienloi.md`

### Bao cao phien 6 (dien sau khi code)

- Da lam:
  - `questionBlockRange`: lui toi `#`/`##`/`###`/`cau:`; end truoc marker moi (`#` `{` `[` `-` `+` `*` `//`). Click loi select ca khoi.
  - Blur/revalidate giu caret. List trai bot loi cua khoi da sua. Empty/0 bai: loi tong cot trai, textarea van sua.
- File da sua/tao:
  - `components/teacher/import-error-fix.tsx`
  - `suagiaodienloi.md`
- Viec tiep theo: khong. Giao dien sua loi xong.

---

## Quy trinh bat buoc sau moi phien

1. Cap nhat muc "Bao cao phien N" trong file nay (da lam, file, viec tiep theo).
2. Commit + push. Commit message: `wip(fix-ui): phien N - <tom tat>`.
3. Phien sau chi can doc file nay, khong doc lai toan repo.

## Trang thai

- Phien hien tai: xong phien 6
- Phien 1: xong
- Phien 2: xong
- Phien 3: xong
- Phien 4: xong
- Phien 5: xong
- Phien 6: xong

Diem moc sau phien 1:
- Validate/save qua `/api/worksheet/*`, FormData `file`
- `extractAndParse` -> `{ parseResult, sourceText }`; preview JSON co `sourceText` (trung line voi errors)
- PreviewPanel 1 cot: loi (khong click) + cay parse. Chua textarea / 2 cot
- Parser rule khong doi. `parseHtmlToResultAndText` dung chung voi `parseHtmlContent`
- Khong dam man HS / man chieu. Save van gui file goc
