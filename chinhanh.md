# Ke hoach hien thi cau hoi co hinh, bang, de da dong (6 phien)

Muc tieu: khi GV nap file (.txt/.docx/.pdf), cau hoi co hinh anh, bang bieu, hoac de nhieu y (1)(2)(3)... van parse dung va hien thi du tren man HS + man trinh chieu GV. Cau dai co thanh cuon.

Khong doi cu phap chuong/bai/kien thuc: `{Chuong}` `[Bai]` `- noi dung KP`.
Khong doi marker loai cau: `#` MC, `##` TF, `###` SA.
Khong doi quy tac MC/TF/SA da chot o `prase cau hoi.md` (cau:, gach chan = dung, dap an:).

## Van de hien tai (khong can doc lai parser)

Diem moc sau parse 4 phien (file `lib/worksheet-parser.ts`):
- MC: `#` / `cau:` / A.B.C.D, gach chan = dung, chuan hoa `A.` `B.` `C.` `D.`
- TF: `##` / `cau:` / a) b) c) d), gach chan = dung
- SA: `###` / `cau:` / `dap an:`
- Helper: `parseCauLine`, `parseDapAnLine`, `parseChoiceLine`, `hasUnderline`, `stripUnderline`
- `parseChoiceLine` chi nhan `^[a-dA-D][.)]` — y `(1)` `(2)` KHONG phai lua chon
- Dong khong nhan ra sau `cau:` -> loi `Khong nhan dang duoc cu phap`
- `parseHtmlContent`: `<u>` -> `__...__`, roi `replace(/<[^>]+>/g, "")` — xoa het `<img>` `<table>` `<tr>` `<td>`
- `lib/extract-file.ts`: mammoth `convertToHtml` + `styleMap: ["u => u"]`; anh Word thanh the `<img>` roi bi strip
- Schema `questions.content` / `questionOptions.content`: text thuan, khong cot anh
- Type `QuestionDto.content`: string
- UI in text: `components/student/tab4-quiz.tsx`, `components/live/student-quiz-view.tsx`, `components/live/quiz-stage.tsx`, `components/teacher/question-editor.tsx`

Vi du de da dong (toan bo den het y (6) la DE, A/B/C/D moi la lua chon):

```
#
cau: Quá trình tự nhân đôi của DNA có các đặc điểm
(1) Diễn ra ở trong nhân, tại kì trung gian của quá trình phân bào.
(2) Diễn ra theo nguyên tắc bổ sung và nguyên tắc bán bảo tồn.
(3) Cả hai mạch đơn đều làm mạch khuôn để tổng hợp mạch mới.
(4) Đoạn Okazaki được tổng hợp theo chiều 5' → 3'.
(5) Khi một phân tử DNA tự nhân đôi 2 mạch mới được tổng hợp đều được kéo dài liên tục với sự phát triển của chạc chữ Y.
(6) Qua một lần nhân đôi tạo ra hai DNA con có cấu trúc giống DNA mẹ.
A. (1), (2), (3), (4), (5).
B. (1), (2), (4), (5), (6)
C. (1), (3), (4), (5), (6).
__D. (1), (2), (3), (4), (6).__
```

## Quy tac ky thuat da chot

### De da dong
- Sau `cau:` (hoac sau `#`/`##`/`###` dung mot minh), moi dong KHONG phai lua chon A-D, KHONG phai `dap an:`, KHONG phai marker moi (`#` `{` `[` `-` `//`) la phan DE.
- Ghep de bang newline (`\n`).
- Lua chon chi khi `parseChoiceLine` match `A.` `A)` `a.` `a)` ...
- Y `(1)` `(2)` KHONG match choice -> thuoc de.

### Hinh anh
- Chi .docx (Word) co anh that. .txt khong co anh. .pdf: neu extract khong lay duoc anh thi bo qua, khong fail ca file.
- Mammoth giu `<img src="data:image/...;base64,...">`.
- Khong strip the `<img>`. Luu vao content dang HTML an toan (chi cho `img`, `table`, `tr`, `td`, `th`, `p`, `br`, `u`).
- Khi hien thi: render HTML (img) hoac tach `imageSrc` rieng. Uu tien: content van la text de; anh di kem mang `images: {src, alt}[]` tren question.

### Bang bieu
- Word `<table>` giu lai, khong doi thanh text mat cot.
- Hien thi bang HTML table (sanitize).
- Bang nam trong DE, khong nam trong lua chon A-D (neu bang nam giua de va A/B/C/D thi van thuoc de).

### Hien thi + thanh cuon
- Man HS: de + anh + bang + 4 lua chon. Neu de dai: `overflow-y-auto` + `max-height` tren khoi de (khong cuon ca trang mat nut chon dap an).
- Man trinh chieu GV: cung thanh cuon tren khoi de.
- Khong XSS: chi allow-list the o tren; img chi `data:` hoac relative path noi bo.

### Luu DB (quyet dinh)
- Them `questions.bodyHtml` (text, nullable): HTML de (anh + bang + newline y). `content` giu plain text (strip tag) de search/preview.
- Khong doi `question_options` (lua chon van text).
- Migration: cot moi nullable; cau cu `bodyHtml = null` -> UI fallback `content`.

## File se dam den (toan bo 6 phien)

- `lib/worksheet-parser.ts` — de da dong; giu img/table khi parse HTML
- `lib/extract-file.ts` — mammoth convertImage base64
- `lib/db/schema.ts` — cot `bodyHtml`
- `types/index.ts` — `QuestionDto.bodyHtml?`
- `app/actions/worksheet.ts` — save `bodyHtml` khi import
- `app/actions/questions.ts` — CRUD giu `bodyHtml`
- `components/student/tab4-quiz.tsx` — render de + cuon
- `components/live/student-quiz-view.tsx` — render de + cuon
- `components/live/quiz-stage.tsx` — man chieu + cuon
- `components/teacher/question-editor.tsx` — preview HTML neu co
- `chinhanh.md` — bao cao moi phien

---

## Phien 1 — Parse de da dong

### Muc tieu
Y `(1)` `(2)` ... thuoc de. Chi `A.` `B.` `C.` `D.` (hoac a/b/c/d TF) la lua chon. De ghep nhieu dong, giu xuong dong.

### Viec lam
1. Sau khi mo cau (`#`/`##`/`###` + `cau:`), dong tiep neu KHONG phai choice, KHONG phai `dap an:`, KHONG phai marker moi: append vao `curQuestion.content` (them `\n`).
2. Choice van dung `parseChoiceLine`. Khong doi helper chu cai A-D.
3. Dong `(1) ...` khong con bao `Khong nhan dang duoc cu phap`.
4. Validate giu: MC 4 option + 1 dung; TF 4 y; SA co `dap an:`.
5. Khong dam anh/bang/schema o phien nay.

### File
- Sua: `lib/worksheet-parser.ts`

### Bao cao phien 1 (dien sau khi code)

- Da lam:
  - Sau `#`/`##`/`###` + `cau:`, dong khong phai choice / `dap an:` / marker moi (`{` `[` `-` `#` `+` `*` `//`) append vao `content` bang `\n`.
  - Y `(1)` `(2)` ... thuoc de. Chi `parseChoiceLine` (A.B.C.D / a.b.c.d) la lua chon.
  - Ghep de dung khi chua co option (MC/TF) hoac chua co `correctAnswer` (SA).
  - Dong `-` KP moi van cat cau dang mo. Mau txt van isValid. Dong `+` van loi.
- File da sua/tao:
  - `lib/worksheet-parser.ts`
- Viec tiep theo (phien 2): them cot `bodyHtml` + type, khong render UI.

---

## Phien 2 — Schema + type bodyHtml

### Muc tieu
Co cho luu HTML de (anh/bang) ma khong vo cau cu (text thuong).

### Viec lam
1. Them `bodyHtml: text("bodyHtml")` nullable vao bang `questions` trong `lib/db/schema.ts`.
2. Them `bodyHtml?: string | null` vao `QuestionDto` (`types/index.ts`).
3. Import/save worksheet: ghi `bodyHtml` neu parser co; khong thi null.
4. CRUD `app/actions/questions.ts`: select/insert/update kem `bodyHtml`.
5. Chua render HTML tren UI. Chua doi mammoth.

### File
- Sua: `lib/db/schema.ts`
- Sua: `types/index.ts`
- Sua: `app/actions/worksheet.ts`
- Sua: `app/actions/questions.ts`

### Bao cao phien 2 (dien sau khi code)

- Da lam:
  - Them cot nullable `questions.bodyHtml` trong schema.
  - `QuestionDto.bodyHtml?: string | null`. `ParsedQuestion.bodyHtml?` de import ghi duoc (parser chua gan, luon null).
  - Import worksheet: insert `bodyHtml: pQ.bodyHtml ?? null`.
  - CRUD questions: getQuestionsByKp tra `bodyHtml`; create/update nhan `bodyHtml` optional. Cau cu khong HTML van chay (null).
  - Chua render UI. Chua doi mammoth. Chua doi live-quiz / tab4 (phien 5/6).
- File da sua/tao:
  - `lib/db/schema.ts`
  - `types/index.ts`
  - `lib/worksheet-parser.ts`
  - `app/actions/worksheet.ts`
  - `app/actions/questions.ts`
- Viec tiep theo (phien 3): mammoth giu anh base64, parser khong strip `<img>`.

---

## Phien 3 — Anh tu Word

### Muc tieu
.docx co hinh: extract thanh `<img src="data:image/...">`, gan vao `bodyHtml`. .txt khong anh.

### Viec lam
1. `lib/extract-file.ts`: mammoth `convertToHtml` them `convertImage` -> `Image.imgElement` src data-uri base64. Giu `styleMap: ["u => u"]`.
2. `parseHtmlContent`: truoc khi strip tag, giu `<img ...>` (placeholder hoac khong xoa img).
3. Parser set `bodyHtml` tren `ParsedQuestion` (them field optional `bodyHtml?: string`).
4. `content` van plain text (de da dong). `bodyHtml` = de co img.
5. Validate: thieu img khong fail. File khong anh van isValid.

### File
- Sua: `lib/extract-file.ts`
- Sua: `lib/worksheet-parser.ts` (`ParsedQuestion.bodyHtml`, `parseHtmlContent`)

### Bao cao phien 3 (dien sau khi code)

- Da lam:
  - `extract-file.ts`: mammoth `convertImage` -> `<img src="data:image/...;base64,...">`. Giu `styleMap: ["u => u"]`.
  - `parseHtmlContent`: the `<img>` doi thanh placeholder `@@IMGn@@` truoc khi strip tag; sau parse gan `bodyHtml` (img + text de, xuong dong = `<br>`).
  - `content` van plain text (bo token anh). Chi chap src `data:image/...;base64,` hoac `/`. Src http bi bo, khong fail file.
  - File khong anh: `bodyHtml` khong gan, isValid. Mau txt khong doi.
  - Token anh ngoai de dang mo: bo qua, khong bao loi cu phap.
- File da sua/tao:
  - `lib/extract-file.ts`
  - `lib/worksheet-parser.ts`
- Viec tiep theo (phien 4): giu `<table>` trong bodyHtml.

---

## Phien 4 — Bang bieu

### Muc tieu
Bang Word khong vo cau truc. Bang nam trong de, hien sau nay qua `bodyHtml`.

### Viec lam
1. `parseHtmlContent`: giu `<table> <tr> <td> <th> <thead> <tbody>`.
2. Sanitize: bo on* attribute, bo script. Table nam trong `bodyHtml` cua question dang mo (hoac KP neu chua co cau — uu tien question).
3. Neu bang nam giua dong de va A/B/C/D: van thuoc de.
4. Khong doi UI (phien 5/6).

### File
- Sua: `lib/worksheet-parser.ts`

### Bao cao phien 4 (dien sau khi code)

- Da lam:
  - `parseHtmlContent`: giu `<table>` qua placeholder `@@TBLn@@` (giong anh). Bang nam trong de (truoc A/B/C/D) vao `bodyHtml`.
  - Sanitize: bo `script`, bo `on*` attr; chi giu table/thead/tbody/tfoot/tr/th/td/caption/br/p/u; `th`/`td` giu colspan/rowspan.
  - Token bang ngoai de dang mo: bo qua, khong fail. File khong bang van isValid. Anh + bang cung luc ok.
  - `content` van plain text (bo token). Khong doi UI.
- File da sua/tao:
  - `lib/worksheet-parser.ts`
- Viec tiep theo (phien 5): render de+anh+bang tren man HS, thanh cuon.

---

## Phien 5 — Man hinh hoc sinh

### Muc tieu
HS thay du de da dong, hinh, bang. De dai co thanh cuon, khong che 4 lua chon.

### Viec lam
1. Component nho (neu can): `components/question/question-stem.tsx` — neu `bodyHtml` thi render HTML sanitize; khong thi `whitespace-pre-wrap` cho `content`. Wrapper `max-h-[...] overflow-y-auto`.
2. Dung o `components/student/tab4-quiz.tsx` va `components/live/student-quiz-view.tsx`.
3. Lua chon A-D van text, nam ngoai vung cuon de.
4. Sanitize: chi img/table/p/br/u; img src chi data: hoac /.

### File
- Tao (neu tach): `components/question/question-stem.tsx`
- Sua: `components/student/tab4-quiz.tsx`
- Sua: `components/live/student-quiz-view.tsx`

### Bao cao phien 5 (dien sau khi code)

- Da lam:
  - Tao `QuestionStem`: neu `bodyHtml` thi sanitize (img data:/, table, p/br/u, bo script/on*) roi render HTML; khong thi `whitespace-pre-wrap` `content`. Wrapper `overflow-y-auto` + `max-h-[40vh]` (live HS `36vh`).
  - Tab 4 quiz + live HS dung stem. Lua chon A-D nam ngoai vung cuon de.
  - Dua `bodyHtml` xuong client: `startQuiz`, `LiveQuestion`/`maskQuestion`, `loadQuizQuestions`, `LiveQuestionView`.
- File da sua/tao:
  - `components/question/question-stem.tsx`
  - `components/student/tab4-quiz.tsx`
  - `components/live/student-quiz-view.tsx`
  - `components/live/use-live-quiz.ts`
  - `app/actions/student-learn.ts`
  - `app/actions/live-quiz.ts`
  - `lib/live-session-state.ts`
- Viec tiep theo (phien 6): man chieu GV + preview editor + chot.

---

## Phien 6 — Man trinh chieu GV, editor, chot

### Muc tieu
Man chieu GV cuon duoc de dai; editor GV preview HTML; import that su luu `bodyHtml`.

### Viec lam
1. `components/live/quiz-stage.tsx`: khoi de dung cung stem (cuon).
2. `components/teacher/question-editor.tsx`: neu co `bodyHtml` thi preview, khong mat text edit `content`.
3. `app/actions/worksheet.ts`: insert `bodyHtml` khi save import (neu chua xong o phien 2).
4. Kiem tra:
   - De 6 y + A B C D: content gom 6 y; 4 option; 1 dung.
   - Dong `+` `*` van loi.
   - Cau khong HTML: fallback `content`, isValid.
5. Khong doi file mau txt (mau khong can anh).

### File
- Sua: `components/live/quiz-stage.tsx`
- Sua: `components/teacher/question-editor.tsx`
- Sua: `app/actions/worksheet.ts` (neu thieu)

### Bao cao phien 6 (dien sau khi code)

- Da lam:
  - Man chieu GV (`quiz-stage.tsx`): khoi de dung `QuestionStem` (bodyHtml sanitize hoac content pre-wrap), cuon `max-h-[40vh]`. Lua chon A-D nam ngoai vung cuon.
  - Editor GV: list + dialog preview HTML neu co `bodyHtml`; Textarea van sua `content` (khong mat text). Khong ghi de `bodyHtml` khi chi sua text.
  - Import worksheet da insert `bodyHtml` (phien 2). Khong doi file mau txt.
  - Kiem tra parser: de 6 y ghep `\n` vao content, 4 option, 1 dung (D); dong `+` `*` van loi; cau khong HTML `bodyHtml` null, isValid, fallback content.
- File da sua/tao:
  - `components/live/quiz-stage.tsx`
  - `components/teacher/question-editor.tsx`
  - `chinhanh.md`
- Viec tiep theo: khong. Hinh/bang/de da dong xong.

---

## Quy trinh bat buoc sau moi phien

1. Cap nhat muc "Bao cao phien N" trong file nay (da lam, file, viec tiep theo).
2. Commit + push. Commit message: `wip(rich-q): phien N - <tom tat>`.
3. Phien sau chi can doc file nay, khong doc lai toan repo.

## Trang thai

- Phien hien tai: xong phien 6
- Phien 1: xong
- Phien 2: xong
- Phien 3: xong
- Phien 4: xong
- Phien 5: xong
- Phien 6: xong

Diem moc sau phien 6:
- Parse MC/TF/SA moi da xong (`prase cau hoi.md`)
- De da dong: y `(1)` `(2)` ghep vao `content` bang `\n`; A.B.C.D van la option
- Helper `appendStem` / `canAppendStem` nam tren `parseTextContent`
- Docx: mammoth `convertImage` base64. `parseHtmlContent` giu `<img>` (`@@IMGn@@`) va `<table>` (`@@TBLn@@`) roi gan `ParsedQuestion.bodyHtml`. Sanitize table/script/on*.
- Schema co `questions.bodyHtml` nullable; DTO + import/CRUD da kem field
- Man HS: `QuestionStem` (`components/question/question-stem.tsx`) — bodyHtml sanitize hoac content pre-wrap; cuon `max-h-[40vh]` (live HS 36vh). Tab4 + live student-quiz-view da dung. Lua chon ngoai vung cuon.
- `bodyHtml` da di qua startQuiz + LiveQuestion/maskQuestion + loadQuizQuestions + LiveQuestionView
- Man chieu GV (`quiz-stage.tsx`) dung `QuestionStem`, cuon de `max-h-[40vh]`; lua chon ngoai vung cuon
- Editor GV: preview `bodyHtml` (list + dialog), van edit `content` text
- Import da luu `bodyHtml`. Cau khong HTML fallback `content`
- Can ALTER TABLE them cot `bodyHtml` tren DB that (drizzle schema da ghi; khong co thu muc migrate trong repo)
