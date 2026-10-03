# Ke hoach sua loi hien thi cau hoi dai + cong thuc (6 phien)

Muc tieu: man trinh chieu GV/TV tu chon co chu lon nhat vua man, so cot dap an, va chi chia khung 65/35 khi 28px van tran. Man dien thoai HS chia 65/35 khi cau dai, fit font theo thong so dien thoai (khong copy so TV). Cong thuc MathType/OMML inline co theo chu. Khong dong bo cuon TV-GV.

Trang thai: **xong phien 5**. Day la nguon su that cho 6 phien. Phien sau CHI doc file nay + dung cac file duoc liet ke trong phien do. KHONG doc lai toan repo. KHONG doc `Ke-hoach-sua-loi-hien-thi-cau-hoi.docx` (ke hoach cu, lech repo).

File doi chieu (neu can thu cong thuc): `BAI 1 - GENE VA SU TAI BAN DNA.docx` o goc repo.

---

## 0. Prompt mo dau (copy dan cho AI phien code)

Ban la ky su Next.js/TypeScript. Doc toan bo `sualoidodaicauhoi.md`, lam DUNG phien duoc giao (khong lam truoc phien sau). Voi phien: (1) mo dung cac file liet ke, doi chieu code that, khong ap dung may moc neu ten bien/cau truc da khac; (2) sua dung pham vi phien; (3) chay `pnpm exec tsc --noEmit` va `pnpm lint`; (4) dien muc "Bao cao phien N" trong file nay; (5) commit + push. Khong them thu vien. Khong doi cu phap Word (`#` `##` `###` `{ }` `[ ]` `-`, gach chan, ngoac kep). Khong doi chu ky ham export cua `worksheet-parser.ts`. Khong doi schema DB. Khong viet lai pipeline mammoth/OMML/WMF. Doc muc 6 truoc khi sua.

---

## 1. Quyet dinh da chot (khong hoi lai)

### 1.1 Hai man dung mot san khau GV/TV

- TV: `components/live/present-view.tsx` chi boc `QuizStage` + nut fullscreen. Khong gan AdaptiveQuestion o day.
- GV: `components/live/teacher-console.tsx` dong 275 `<QuizStage view={view} />` + thanh dieu khien duoi. Khong gan AdaptiveQuestion o day.
- Sua `QuizStage` thi ca TV va khung cau hoi GV giong nhau.

### 1.2 Man HS khong copy AdaptiveQuestion nguyen

- HS can nut bam (MC/TF/SA) + nut Gui co dinh duoi (`pb-36`). AdaptiveQuestion render option chi de xem, khong bam duoc.
- Tao layout rieng `components/live/student-question-layout.tsx`: slot stem + slot options. Fit font + chia 65/35. Option UI giu nguyen trong `student-quiz-view.tsx`.

### 1.3 Hang so (dat ten, khong magic number)

Man san khau (TV/GV):

- `STAGE_MIN_FS = 28`
- `STAGE_MAX_FS = 80`
- `STAGE_SPLIT = 0.65`
- Cot thu: `n >= 4 ? [2, 1, 4] : n === 2 ? [2, 1] : [1]`

Man dien thoai HS:

- `PHONE_MIN_FS = 14`
- `PHONE_MAX_FS = 24`
- `PHONE_SPLIT = 0.65`
- Chi 1 cot. Khong thu 2/4 cot.

### 1.4 Thuat toan fit (ca hai man, khac hang so)

1. Do khung ngoai co dinh (ResizeObserver chi observe khung ngoai, KHONG observe noi dung — tranh vong lap).
2. Tim `fs` lon nhat trong [MIN, MAX] bang binary search sao cho noi dung khong tran (`offsetHeight <= clientHeight` va `scrollWidth <= clientWidth + 1`).
3. San khau: thu tung so cot, chon kieu cho `fs` lon nhat.
4. Neu khong kieu nao vua o MIN: `mode = "split"`, stem `SPLIT` / options `1-SPLIT`, moi phan `overflow-y-auto` rieng, `fs = MIN`.
5. Moi kich thuoc phu (padding, badge A/B/C/D, icon) dung `em`.
6. Do lai khi: doi cau (`key={question.id}` hoac `currentIndex`), ResizeObserver, anh `load` (capture), `document.fonts.ready`, `revealed` doi (SA).

Do luong: dung MOT DOM that, khong unmount `natRef` khi chuyen split. Cach: luon render khoi do an (`position:absolute; visibility:hidden; inset:0`) de measure o che do single; UI that theo `layout.mode`. Hoac: `natRef` luon gan, split chi la CSS grid tren cung cay. Khong flip `mode` roi `tick` nhu mau ke hoach cu (de lech 1 frame).

### 1.5 Khong noi dong LIST_START

Khong ghep dong Word bang regex `I.` `1)` `a.` trong phien nay. `(1)` `(2)` la y trong de (`suapraser.md`). Noi dong de dinh y. Giu newline/`<br>` nhu parser da tao. Chi duoc collapse dong trong thua neu can.

### 1.6 Cong thuc: gan class luc extract, khong doan 70px

Pipeline DA CO, KHONG viet lai:

- `lib/extract-file.ts` dong 53-75: `preprocessOmml` + mammoth `convertImage` + thay `@@MATHn@@` bang `<img src="...">`.
- `lib/docx-omml.ts`: OMML -> MathML -> SVG data URI, `display: false`.
- `lib/docx-equations.ts`: WMF/EMF -> SVG data URI (`wmfToSvg`).

Viec con lai:

- Anh OMML (`@@MATH@@`) va anh WMF da chuyen SVG: `class="eq-inline"`. Neu SVG co `height` (px/ex) co the them `style="height:NNem;width:auto"`; neu khong, CSS fallback `h-[1.5em]`.
- Anh raster con lai: `class="eq-figure"`.
- `imgTagToPlaceholder` GIU class (`eq-inline`|`eq-figure`) va style dung dang `height:NNem;width:auto`. Khong suy nguong 70px.
- KHONG unzip `word/document.xml` de map `wp:extent` theo thu tu.
- KHONG doi WMF sang PNG.
- KHONG them omml2mathml/mathjax (da co).

### 1.7 QuestionStem: CSS hinh lon khong global 28vh

- Cho phep class `eq-inline` / `eq-figure` va 1 style `height:NNem;width:auto` trong sanitizer.
- CSS mac dinh: `eq-inline` cung dong, `h-[1.5em]` fallback; figure giu `max-h-48` (form GV, preview, tab hoc).
- `max-h-[28vh]` CHI them trong AdaptiveQuestion (san khau), khong doi default toan app.
- `maxHeightClass === "max-h-none"` thi KHONG gan `overflow-y-auto` (tranh hai thanh cuon khi cha da cuon).

### 1.8 Khong lam

- T7 dong bo scrollTop TV-GV (`lib/realtime.ts` la SSE in-memory, khong kenh cuon).
- Doi parser rule, cu phap Word, chu ky export `worksheet-parser.ts`.
- Doi schema DB / dinh dang da luu.
- Them thu vien npm.
- Fit-to-screen cho `question-editor`, `lesson-detail`, `question-form-dialog`, `worksheet-preview-doc`, `tab4-quiz` (chi huong CSS inline).
- Commit token/khoa.

### 1.9 Overlay san khau

Chip "Cau x/y", dong ho, badge so HS, canh bao fullscreen: giu `absolute`. Vung AdaptiveQuestion `relative min-h-0 flex-1` + `pt` du de chu khong de dong ho/chip. Khong xoa overlay.

---

## 2. Diem moc code hien tai (khong doc lai file dai)

### `components/question/question-stem.tsx` (56 dong)

- `sanitizeStemHtml`: `<img>` chi giu `src` + `alt`, bo class/style (dong 8-13).
- Wrapper: `className={cn(maxHeightClass, "overflow-y-auto")}` — luon cuon (dong 42).
- Default `maxHeightClass = "max-h-[40vh]"`.
- CSS anh: `[&_img]:mx-auto [&_img]:my-2 [&_img]:max-h-48 [&_img]:max-w-full` (dong 46).

### `lib/worksheet-parser.ts`

- `imgTagToPlaceholder` ~dong 622-629: chi `src`+`alt`, push `<img src alt>`, tra `\n@@IMGn@@\n`.
- `parseHtmlToResultAndText` ~dong 765-788: replace img -> placeholder, table, parseText, `attachBodyHtml` + `attachOptionBodyHtml`.
- Export giu nguyen: `parseTextContent`, `parseHtmlContent`, `parseHtmlToResultAndText`, `attachBodyHtml`, `attachOptionBodyHtml`, `validateDocument`, `summarize`, ...
- KHONG sua logic parse cau.

### `lib/extract-file.ts` (87 dong)

- Docx: `preprocessOmml(buffer)` roi `mammoth.convertToHtml`.
- `convertImage`: WMF/EMF -> `wmfToSvg` tra `{ src: svg }`; else base64 `{ src: data:... }`. Chua class.
- Thay `@@MATH(\d+)@@` bang `<img src="${src}">` khong class (dong 71-74).

### `components/live/quiz-stage.tsx` (149 dong)

- Import `QuestionStem`, `LETTERS`, `Check`.
- Overlay: so HS `absolute left-4 top-4`; dong ho `absolute right-4 top-4` (h-20).
- Vung cau: `flex flex-1 flex-col items-center justify-center px-8 py-10` (dong 49).
- Stem: `text-4xl md:text-5xl`, `maxHeightClass="max-h-[40vh] w-full"` (dong 61-66).
- Option grid: `md:grid-cols-2` neu >2 option; option `text-2xl`; `max-h-32` neu `bodyHtml`.
- Khung ngoai `overflow-hidden`.
- Man cho: "Dang cho bat dau…".

### `components/live/present-view.tsx`

- `QuizStage` + nut fullscreen. Khong sua (tru khi lint).

### `components/live/teacher-console.tsx`

- Dong 275: `QuizStage`. `NextQuestionPreview` tu fit 6-12px — KHONG dam.

### `components/live/student-quiz-view.tsx`

- Khung: `fixed inset-0 ... flex-col gap-5 overflow-y-auto ... p-4 pb-36` (dong 173).
- Stem: `text-2xl`, `maxHeightClass="max-h-[36vh]"` (dong 198-203) — day la ly do de nho / dap an to.
- MC/TF/SA: button tu viet, khong AdaptiveQuestion.
- Nut Gui `fixed bottom-0`.

### `components/live/use-live-quiz.ts`

- `LiveQuestionView`: `id, index, type, content, bodyHtml?, options[{id,content,bodyHtml?,order}], ...`
- `RevealInfo`: `correctOptionIds, correctText`
- `LiveQuizView.question` / `.revealed` dung cho AdaptiveQuestion.

### Cho dung `QuestionStem` (phien 6 moi ra soat, khong sua o phien 1-5 tru khi vo tinh import)

- `components/student/tab4-quiz.tsx` — `text-sm`, default max-h
- `components/teacher/question-editor.tsx` — `max-h-32` / `max-h-24`
- `components/teacher/lesson-detail.tsx`
- `components/teacher/question-form-dialog.tsx` — `max-h-48`
- `components/teacher/worksheet-preview-doc.tsx`

### Khong ton tai

- `components/live/adaptive-question.tsx`
- `components/live/student-question-layout.tsx`
- `components/live/fit-to-screen.tsx`

### Cong cu kiem tra

- `pnpm exec tsc --noEmit`
- `pnpm lint`
- Tailwind v4 (class arbitrary `gap-[0.5em]` dung duoc).

---

## 3. File se dam den (toan bo 6 phien)

- `components/question/question-stem.tsx` — phien 1
- `components/live/adaptive-question.tsx` — tao o phien 2
- `components/live/quiz-stage.tsx` — phien 3
- `lib/extract-file.ts` — phien 4
- `lib/worksheet-parser.ts` — phien 4 (CHI `imgTagToPlaceholder` + helper nho, khong doi parse)
- `components/live/student-question-layout.tsx` — tao o phien 5
- `components/live/student-quiz-view.tsx` — phien 5
- `sualoidodaicauhoi.md` — moi phien cap nhat bao cao

Khong dam: parser rule, schema DB, `docx-omml.ts` / `docx-equations.ts` (tru khi phien 4 can helper nho gan class, uu tien sua `extract-file.ts`), `teacher-console.tsx` (tru import thua), `present-view.tsx`, `use-live-quiz.ts`, `tab4-quiz` / editor (phien 6 chi ra soat).

Thu tu: 1 -> 2 -> 3 -> 4 -> 5 -> 6. Phien 4 doc lap ve mat UI (3 da cho ket qua TV). Phien 5 doc lap voi 2/3 nhung can phien 1.

---

## Phien 1 — QuestionStem: overflow + class anh an toan

### Muc tieu

Sanitizer giu `eq-inline`/`eq-figure` + style height em. Wrapper khong cuon khi `maxHeightClass="max-h-none"`. CSS inline cho cong thuc. Figure van `max-h-48` mac dinh. Cac man khac khong vo.

### Viec lam

1. Trong `sanitizeStemHtml`, thay khoi replace `<img>`:

```ts
s = s.replace(/<img\b[^>]*>/gi, (tag) => {
  const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? ""
  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(src) && !src.startsWith("/")) return ""
  const alt = (tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? "").replace(/[<>"']/g, "")
  const cls = tag.match(/\bclass\s*=\s*["'](eq-inline|eq-figure)["']/i)?.[1] ?? ""
  const h = tag.match(/\bstyle\s*=\s*["']height:([\d.]+)em;width:auto["']/i)?.[1]
  const extra =
    (cls ? ` class="${cls}"` : "") +
    (cls === "eq-inline" && h ? ` style="height:${h}em;width:auto"` : "")
  return `<img src="${src}" alt="${alt}"${extra}>`
})
```

2. Wrapper:

```ts
const scroll = Boolean(maxHeightClass && maxHeightClass !== "max-h-none")
<div className={cn(maxHeightClass, scroll && "overflow-y-auto")}>
```

3. Xoa 4 class cu `[&_img]:mx-auto [&_img]:my-2 [&_img]:max-h-48 [&_img]:max-w-full`. Them:

```
[&_img]:max-w-full
[&_img.eq-inline]:inline-block [&_img.eq-inline]:align-middle [&_img.eq-inline]:mx-1 [&_img.eq-inline]:my-0 [&_img.eq-inline]:h-[1.5em] [&_img.eq-inline]:w-auto
[&_img:not(.eq-inline)]:mx-auto [&_img:not(.eq-inline)]:my-2 [&_img:not(.eq-inline)]:max-h-48
```

Style inline `height:Nem` se ghi de `h-[1.5em]` khi co. Giu cac class table nhu cu.

4. Khong doi default `maxHeightClass`. Khong dam quiz-stage / student o phien nay.

### File

- Sua: `components/question/question-stem.tsx`
- Sua: `sualoidodaicauhoi.md` (bao cao)

### Nghiem thu

- `pnpm exec tsc --noEmit` va `pnpm lint` khong loi moi.
- Man editor/preview van cuon khi `max-h-32`/`max-h-48`.
- Truyen `maxHeightClass="max-h-none"` thi khong co overflow-y-auto tren wrapper.

### Bao cao phien 1 (dien sau khi code)

- Da lam:
  - `sanitizeStemHtml` giu dung 2 class `eq-inline`/`eq-figure` va style `height:NNem;width:auto` tren `<img>`; src van chi `data:image/...;base64,` hoac path bat dau `/`.
  - Wrapper chi gan `overflow-y-auto` khi `maxHeightClass` khac `"max-h-none"`. Default van `max-h-[40vh]`.
  - CSS anh: `eq-inline` cung dong + `h-[1.5em]` fallback; anh khong inline van `max-h-48`. Khong dung `max-h-[28vh]` global. Giu class table.
  - Khong dam quiz-stage / student / parser / extract.
- File da sua/tao:
  - `components/question/question-stem.tsx`
  - `sualoidodaicauhoi.md`
- Ket qua tsc/lint:
  - `pnpm exec tsc --noEmit`: dat (exit 0).
  - `pnpm lint`: fail san co — `eslint` khong co trong `package.json` / khong co `eslint.config.*`. Khong them thu vien. Khong phai loi moi cua phien 1.
- Diem chua chac:
  - Class `eq-inline`/`eq-figure` chua duoc gan luc extract (phien 4); hien moi anh van roi vao CSS `:not(.eq-inline)` = `max-h-48`.
  - Regex class chi khop dung 1 class (`eq-inline` hoac `eq-figure`), khong khop `class="eq-inline foo"`. Dung voi quy uoc phien 4.
- Viec tiep theo: phien 2 tao AdaptiveQuestion.

---

## Phien 2 — Tao AdaptiveQuestion (san khau)

### Muc tieu

Component moi, chua gan QuizStage. Do font + cot + split theo hang so STAGE_*. Dung `QuestionStem` voi `maxHeightClass="max-h-none"`. CSS figure `[&_img:not(.eq-inline)]:max-h-[28vh]` tren className cua stem/option trong component nay.

### Viec lam

Tao `components/live/adaptive-question.tsx` (`"use client"`).

Props: `{ question: NonNullable<LiveQuizView["question"]>; revealed: LiveQuizView["revealed"] }`.

Hang so dat ten o dau file: `STAGE_MIN_FS`, `STAGE_MAX_FS`, `STAGE_SPLIT`, `LETTERS`.

Khung do:

- `boxRef`: `absolute inset-0 overflow-hidden`.
- Mot cay noi dung `natRef` luon mount (de do). `fontSize` px tren natRef. Option grid `repeat(cols, minmax(0,1fr))`.
- Che do single: `flex h-full items-center` + `mx-auto w-full max-w-[1800px] flex-col gap-[0.7em]`.
- Che do split: `grid h-full` `gridTemplateRows: ${STAGE_SPLIT}fr ${1-STAGE_SPLIT}fr`; moi hang `min-h-0 overflow-y-auto`.
- Khong unmount natRef khi doi mode.

Measure: binary search nhu muc 1.4. `fits` sau khi apply fs+cols.

Remeasure: ResizeObserver tren `boxRef` (khung ngoai co dinh), `load` capture tren box, `document.fonts?.ready`, doi `revealed`. Debounce bang `requestAnimationFrame`. `key` do cha truyen.

Stem:

```tsx
<QuestionStem
  content={question.content}
  bodyHtml={question.bodyHtml ?? undefined}
  className={cn(
    "whitespace-pre-line font-heading font-bold leading-tight",
    "[&_img:not(.eq-inline)]:max-h-[28vh]",
    question.content.length < 140 && !question.bodyHtml && "text-balance text-center",
  )}
  maxHeightClass="max-h-none"
/>
```

Khong goi `reflowText` / `reflowHtml`.

Options: nhu mau ke hoach cu (MC/TF the div + badge A/B/C/D + Check khi revealed; SA hien `correctText` khi revealed). Moi kich thuoc `em`. Option `QuestionStem` cung `max-h-none` + class figure 28vh.

Import `cn`, `Check` lucide, `QuestionStem`, type tu `use-live-quiz`.

### File

- Tao: `components/live/adaptive-question.tsx`
- Sua: `sualoidodaicauhoi.md`

### Nghiem thu

- File compile. Chua thay doi UI that (chua gan).
- ResizeObserver khong observe natRef.

### Bao cao phien 2 (dien sau khi code)

- Da lam:
  - Tao `AdaptiveQuestion`: hang so `STAGE_MIN_FS=28`, `STAGE_MAX_FS=80`, `STAGE_SPLIT=0.65`, `LETTERS`. Props dung `LiveQuizView["question"]` / `["revealed"]`.
  - Do luong: khoi an (`visibility:hidden; absolute inset-0`) luon mount o che do single; `natRef`/`optsRef` chi gan o khoi an. UI that theo `layout.mode` (single hoac split 65/35). Khong unmount natRef, khong flip mode roi tick.
  - Binary search fs theo cot `[2,1,4]` (n>=4) / `[2,1]` (n=2) / `[1]`. Khong vua MIN -> split, cot 1 hoac 2 ngan hon.
  - ResizeObserver chi observe `boxRef`. `load` capture, `document.fonts.ready`, do lai khi `question.id` / `revealed`. Debounce rAF. setLayout skip neu khong doi.
  - Stem/option `QuestionStem` `max-h-none` + `[&_img:not(.eq-inline)]:max-h-[28vh]`. Khong reflowText/reflowHtml. Kich thuoc phu dung em.
  - Chua gan QuizStage.
- File da sua/tao:
  - `components/live/adaptive-question.tsx` (tao)
  - `sualoidodaicauhoi.md`
- Ket qua tsc/lint:
  - `pnpm exec tsc --noEmit`: dat (exit 0).
  - `pnpm lint`: fail san co (khong co eslint) — giong phien 1.
- Diem chua chac:
  - Khoi an va khoi that render 2 ban stem/options; cau nhieu anh do gap doi. Chap nhan de natRef khong unmount.
  - Do tren khoi an (single stack); split cot chon theo chieu cao stack, khong do lai trong grid 65/35.
- Viec tiep theo: phien 3 gan vao quiz-stage.

---

## Phien 3 — Gan AdaptiveQuestion vao QuizStage (TV + GV)

### Muc tieu

Man TV va khung cau GV dung AdaptiveQuestion. Chip + dong ho khong de noi dung. Xoa LETTERS/Check/QuestionStem neu khong con dung.

### Viec lam

1. Import `AdaptiveQuestion` tu `./adaptive-question`.

2. Thay khoi "Vung cau hoi chinh" (tu dong 49 `flex flex-1 flex-col items-center...` den het nhanh question/waiting) bang:

```tsx
<div className="relative flex min-h-0 flex-1 flex-col px-8 pb-6 pt-24 md:px-16">
  {question ? (
    <>
      <div className="absolute left-1/2 top-5 z-10 flex -translate-x-1/2 items-center gap-3">
        {/* GIU NGUYEN 2 chip Cau x/y va loai cau */}
      </div>
      <div className="relative min-h-0 flex-1">
        <AdaptiveQuestion key={question.id} question={question} revealed={revealed} />
      </div>
    </>
  ) : (
    <div className="flex flex-1 items-center justify-center">
      {/* GIU NGUYEN man Dang cho bat dau */}
    </div>
  )}
</div>
```

`pt-24` de tranh dong ho 80px + chip. Overlay so HS / dong ho / canh bao fullscreen giu nguyen ngoai khoi nay.

3. Xoa import thua (`QuestionStem`, `LETTERS`, `Check` neu het dung). Khong tao/xoa `fit-to-screen.tsx` (khong co).

4. Khong sua `present-view.tsx` / `teacher-console.tsx`.

### File

- Sua: `components/live/quiz-stage.tsx`
- Sua: `sualoidodaicauhoi.md`

### Nghiem thu

- Cau ngan: chu to, khong cuon, dap an 2 hoac 4 cot.
- Cau vua: chu giam, khong cat.
- Cau rat dai: split 65/35, moi phan cuon, chu 28px.
- Chip va dong ho khong de chu.
- Doi cua so / fullscreen do lai.

### Bao cao phien 3 (dien sau khi code)

- Da lam:
  - QuizStage import AdaptiveQuestion. Vung cau hoi: `relative flex min-h-0 flex-1 flex-col px-8 pb-6 pt-24`. Chip "Cau x/y" + loai cau `absolute left-1/2 top-5`. AdaptiveQuestion `key={question.id}` trong `relative min-h-0 flex-1`.
  - Overlay so HS / dong ho / canh bao fullscreen giu nguyen. Man "Dang cho bat dau…" giu nguyen.
  - Xoa import `QuestionStem`, `Check`, `LETTERS`. Khong sua present-view / teacher-console.
- File da sua/tao:
  - `components/live/quiz-stage.tsx`
  - `sualoidodaicauhoi.md`
- Ket qua tsc/lint:
  - `pnpm exec tsc --noEmit`: dat (exit 0).
  - `pnpm lint`: fail san co (khong co eslint) — giong phien 1-2.
- Diem chua chac:
  - Chip giua va dong ho phai co the chong o man hep; `pt-24` du cho chieu cao dong ho 80px.
  - Chua thu tren TV that (cau ngan/dai/fullscreen) — chi compile.
- Viec tiep theo: phien 4 gan eq-inline luc extract.

---

## Phien 4 — Gan eq-inline / eq-figure luc extract + giu class o parser

### Muc tieu

Anh OMML va WMF-SVG vao HTML trung gian da co class `eq-inline`. Raster `eq-figure`. Parser khong tay class. T1/T2 luc nay moi co hieu luc. Khong viet `docxToHtml` moi, khong doc `wp:extent` theo thu tu.

### Viec lam

1. `lib/extract-file.ts`:

- Trong `convertImage`: neu `wmfToSvg` thanh cong, tra `{ src: svg }` — class gan o buoc HTML (mammoth imgElement thuong chi nhan src). Neu mammoth khong cho class, gan luc thay the / wrap sau convert.
- Thay `@@MATH@@`:

```ts
return src ? `<img src="${src}" class="eq-inline" alt="">` : "[cong thuc]"
```

- Sau `convertToHtml`, truoc `parseHtmlToResultAndText`: duyet `<img>` khong co class. Neu `src` la `data:image/svg+xml` -> them `class="eq-inline"`. Con lai (`png/jpeg/gif/webp` hoac khong xac dinh) -> `class="eq-figure"`. Khong ghi de neu da co eq-inline/eq-figure.

Helper nho dat trong `extract-file.ts` (khong can file moi):

```ts
function tagEquationImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bclass\s*=\s*["'][^"']*\beq-(inline|figure)\b/i.test(tag)) return tag
    const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? ""
    const cls = /data:image\/svg\+xml/i.test(src) ? "eq-inline" : "eq-figure"
    return tag.replace(/<img\b/i, `<img class="${cls}"`)
  })
}
```

Goi: `parseHtmlToResultAndText(tagEquationImages(html))`.

2. `lib/worksheet-parser.ts` — CHI thay `imgTagToPlaceholder` (them `numAttr` neu can, nhung KHONG dung nguong 70px):

Giu `src` (cung rule an toan data:/relative), `alt`, class neu dung `eq-inline|eq-figure`, style neu dung `height:NNem;width:auto`.

Khong doi ham export. Khong doi `attachBodyHtml`.

3. Khong sua `docx-omml.ts` / `docx-equations.ts` tru khi bat buoc (uu tien khong sua).

### File

- Sua: `lib/extract-file.ts`
- Sua: `lib/worksheet-parser.ts` (chi imgTagToPlaceholder)
- Sua: `sualoidodaicauhoi.md`

### Nghiem thu

- Parse file mau: so cau / so dap an dung khong doi so voi truoc (neu chay duoc script parser san co thi dung; khong thi it nhat tsc/lint).
- HTML trung gian: anh MATH/SVG co `class="eq-inline"`; anh png co `eq-figure`.
- Tren san khau: cong thuc cung dong, cao ~chu; hinh lon khong qua 28vh.

### Bao cao phien 4 (dien sau khi code)

- Da lam:
  - `extract-file.ts`: helper `tagEquationImages` — anh chua co eq-inline/eq-figure thi SVG -> `eq-inline`, con lai -> `eq-figure`. Goi sau thay `@@MATH@@`, truoc `parseHtmlToResultAndText`.
  - Thay `@@MATH@@` bang `<img src class="eq-inline" alt="">`. Khong sua convertImage (mammoth chi tra src); class gan o HTML.
  - `imgTagToPlaceholder` giu class `eq-inline|eq-figure` va style `height:NNem;width:auto`. Khong nguong 70px. Khong doi ham export / attachBodyHtml / docx-omml / docx-equations.
- File da sua/tao:
  - `lib/extract-file.ts`
  - `lib/worksheet-parser.ts` (chi imgTagToPlaceholder)
  - `sualoidodaicauhoi.md`
- Ket qua tsc/lint:
  - `pnpm exec tsc --noEmit`: dat (exit 0).
  - `pnpm lint`: fail san co (khong co eslint).
- So cau/dap an file mau (neu do):
  - Khong chay duoc `scripts/check-parser-phien8.mjs` (node khong resolve import `.ts` / khong co tsx trong repo). Khong them thu vien. Chu ky export parser khong doi.
- Diem chua chac:
  - WMF khong chuyen duoc SVG se mang contentType x-wmf -> `eq-figure` (dung theo helper).
  - Moi SVG (ke ca hinh minh hoa SVG, neu co) thanh eq-inline. File mau chu yeu OMML/WMF -> SVG cong thuc.
- Viec tiep theo: phien 5 man HS.

---

## Phien 5 — Man HS: 65/35 + fit font dien thoai

### Muc tieu

Cau dai: stem 65% cuon, options 35% cuon, nut Gui van `fixed bottom`. Font 14-24px, 1 cot. Cau ngan: chu to hon trong khoang do, khong chia khung. Khong dung AdaptiveQuestion.

### Viec lam

1. Tao `components/live/student-question-layout.tsx` (`"use client"`).

Props:

```ts
{
  questionId: string
  stem: React.ReactNode
  options: React.ReactNode
}
```

Hang so: `PHONE_MIN_FS`, `PHONE_MAX_FS`, `PHONE_SPLIT`. Chi 1 cot.

Khung: `flex min-h-0 flex-1 flex-col overflow-hidden` (cha phai `flex flex-col min-h-0`, xem buoc 2).

Measure giong AdaptiveQuestion nhung khong thu nhieu cot. Single: stem + options trong mot cot, `fontSize` tren wrapper. Split: grid 2 hang 65/35, moi hang `min-h-0 overflow-y-auto`.

ResizeObserver khung ngoai. `key` = questionId (cha truyen).

2. `student-quiz-view.tsx`:

- Doi khung ngoai (dong 173): bo `overflow-y-auto` toan trang khi co cau; dung `h-full min-h-0 flex flex-col`. Giu `pb-36` cho nut Gui. Thanh tren (Cau x/y + dong ho) `shrink-0`.
- Khi co `q`: boc stem + khoi MC/TF/SA trong `StudentQuestionLayout`.
- Stem: bo `max-h-[36vh]`, dung `maxHeightClass="max-h-none"`, `className` font-heading bold (co chu ke thua em/px tu layout).
- GIU nguyen markup button MC/TF/SA, disabled/locked, nut Gui, thong bao het gio.
- Khong fit 2/4 cot.

3. Khong sua tab4-quiz.

### File

- Tao: `components/live/student-question-layout.tsx`
- Sua: `components/live/student-quiz-view.tsx`
- Sua: `sualoidodaicauhoi.md`

### Nghiem thu

- Cau ngan tren dien thoai: chu ~20-24px, 1 cot, bam duoc, khong split.
- Cau dai: stem 65% cuon, options 35% cuon, nut Gui van bam duoc.
- TF nut Dung/Sai khong bi be.
- Doi cau reset layout (key id).

### Bao cao phien 5 (dien sau khi code)

- Da lam:
  - Tao `StudentQuestionLayout`: `PHONE_MIN_FS=14`, `PHONE_MAX_FS=24`, `PHONE_SPLIT=0.65`, chi 1 cot. Do tren khoi an (natRef luon mount). Single: stem+options 1 cot; khong vua MIN -> split 65/35, moi phan overflow-y-auto. ResizeObserver chi box ngoai. `key` = questionId.
  - `student-quiz-view`: khung `h-full min-h-0 flex-col`, bo overflow-y-auto toan trang, thanh tren `shrink-0`, giu `pb-36`. Khi co `q`: boc stem + MC/TF/SA trong layout. Stem `max-h-none`, bo `max-h-[36vh]` va `text-2xl`. Markup button MC/TF/SA / nut Gui / het gio giu nguyen. Khong dung AdaptiveQuestion. Khong sua tab4-quiz.
- File da sua/tao:
  - `components/live/student-question-layout.tsx` (tao)
  - `components/live/student-quiz-view.tsx`
  - `sualoidodaicauhoi.md`
- Ket qua tsc/lint:
  - `pnpm exec tsc --noEmit`: dat (exit 0).
  - `pnpm lint`: fail san co (khong co eslint).
- Diem chua chac:
  - Button `text-lg` / `min-h-14` khong doi sang em; font layout 14-24px chi ke thua cho stem la chinh. Nut bam van du lon.
  - Ket qua "Chinh xac" nam ngoai layout (`shrink-0`) de khong an dien tich do.
  - Chua thu tren dien thoai that.
- Viec tiep theo: phien 6 ra soat + chot.

---

## Phien 6 — Ra soat QuestionStem, polish, chot

### Muc tieu

Khong con `max-h-[40vh]` tren san khau. Cac man khong-trinh-chieu van cuon binh thuong. Khong vong lap do. Cap nhat bao cao cuoi.

### Viec lam

1. Grep toan repo: `QuestionStem`, `max-h-48`, `max-h-[40vh]`, `max-h-[36vh]`, `AdaptiveQuestion`, `StudentQuestionLayout`.

Xu ly:

- `quiz-stage`: khong con stem max-h 40vh.
- `student-quiz-view`: khong con 36vh.
- `tab4-quiz`, `question-editor`, `lesson-detail`, `question-form-dialog`, `worksheet-preview-doc`: giu max-h cu, huong CSS eq-inline. KHONG gan AdaptiveQuestion.

2. Giat SA khi revealed: neu giat manh, debounce remeasure 1 rAF; khong doi thuat toan.

3. Kiem tra CPU: chuyen 10 cau, ResizeObserver khong spam (chi box ngoai).

4. Chay `pnpm exec tsc --noEmit` va `pnpm lint`.

5. Dien bao cao phien 6 + muc Trang thai. Liet ke rui ro muc 6.3 (dap an dung la anh cong thuc / gach chan mat) — CHI BAO CAO, khong sua parser o phien nay.

### File

- Sua: chi neu grep ra cho sot (ghi ro trong bao cao)
- Sua: `sualoidodaicauhoi.md`

### Bao cao phien 6 (dien sau khi code)

- Da lam:
- File da sua/tao:
- Ket qua tsc/lint:
- Grep con sot:
- Rui ro 6.3 (bao cao, chua sua):
- Viec tiep theo: khong. Ke hoach xong.

---

## 4. Ke hoach kiem thu (giao het 8 case; phien 3 lam 1/2/4/6/7/8 san khau, phien 4 them 3/5, phien 5 them HS)

1. Cau ngan ~60 ky tu, 4 dap an ngan — TV: chu gan 80px, 2 hoac 4 cot, khong cuon.
2. Cau trung binh ~250 ky tu — TV: chu giam, khong cuon.
3. Phan so/cong thuc trong de va dap an — inline, cao ~chu.
4. Cau dai ~900 ky tu o 28px — TV split 65/35.
5. Hinh minh hoa lon — khong qua 28vh tren san khau.
6. TF 4 y va SA — SA hien dap an khi revealed, khong giat qua muc.
7. Doi cua so / fullscreen — do lai, khong cat.
8. Chuyen 10 cau — khong giat, khong vong lap do.
9. (them) HS cau dai — stem 65 / options 35, nut Gui bam duoc, font 14-24, 1 cot.

---

## 5. Tieu chi hoan thanh

- tsc + lint khong loi moi.
- 9 case muc 4 dat (8 TV/GV + 1 HS).
- Ham export `worksheet-parser.ts` khong doi chu ky; so cau/dap an file mau khong doi.
- TV va GV cung mot san khau AdaptiveQuestion.
- HS khong dung AdaptiveQuestion.
- Bao cao cuoi: file da sua, rui ro 6.3, diem chua xu ly.

---

## 6. Luu y / rui ro (doc truoc khi sua)

### 6.1 Ke hoach cu lech repo

`Ke-hoach-sua-loi-hien-thi-cau-hoi.docx` T6 (docxToHtml, wp:extent, WMF->PNG, omml2mathml moi) KHONG LAM. Pipeline da co trong `extract-file.ts` + `docx-omml.ts` + `docx-equations.ts`.

### 6.2 Phu thuoc

- Phien 2 can phien 1 (`max-h-none` tat overflow).
- Phien 3 can phien 2.
- Phien 4 can phien 1 (sanitizer); UI TV da tot tu phien 3, cong thuc tot sau phien 4.
- Phien 5 can phien 1, khong can 2/3.
- Phien 6 chot.

### 6.3 Rui ro — bao cao, khong sua parser

- Dap an dung nhan bang `<u>`. Cong thuc anh khong gach chan duoc -> `isCorrect` co the mat. Phien 6 ghi nhan.
- Anh header/footer khong con la van de vi khong map theo thu tu extent.
- Split tren TV khong chuot: chap nhan; khong T7.
- SVG MathJax height `ex`: fallback CSS 1.5em; chinh hang so neu de that lech.
- `next.config.mjs` `typescript.ignoreBuildErrors: true` — VAN chay tsc, sua loi moi do minh gay ra.

### 6.4 Hang so uoc luong

`STAGE_MAX_FS = 80` co the giam 64 neu cau ngan qua to (doi xong thu, ghi bao cao, duoc phep sua hang so). `PHONE_MAX_FS = 24` giam neu de bam. Khong doi `STAGE_MIN_FS = 28` va `SPLIT = 0.65` tru khi chu du an yeu cau.

---

## 7. Quy trinh bat buoc sau moi phien

1. Dien muc "Bao cao phien N" (da lam, file, tsc/lint, diem chua chac, viec tiep theo).
2. Cap nhat muc Trang thai.
3. Commit + push. Message: `wip(fix-display): phien N - <tom tat>`.
4. Phien sau chi doc file nay, khong doc lai toan repo.

---

## Trang thai

- Phien hien tai: xong phien 5
- Phien 1: xong
- Phien 2: xong
- Phien 3: xong
- Phien 4: xong
- Phien 5: xong
- Phien 6: chua

Diem moc sau phien 5:

- `QuestionStem` giu class eq-inline/eq-figure + style height em; `max-h-none` khong overflow-y-auto; figure mac dinh van max-h-48
- QuizStage dung AdaptiveQuestion (`key={question.id}`), pt-24, chip khong nam trong khoi do
- present-view / teacher-console khong sua (van boc QuizStage)
- extract-file: `tagEquationImages` + MATH `class="eq-inline"`; parser `imgTagToPlaceholder` giu class/style
- StudentQuizView dung StudentQuestionLayout (14-24px, 1 cot, split 65/35); stem max-h-none; nut Gui van fixed bottom
- Co `components/live/student-question-layout.tsx`
