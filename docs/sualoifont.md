# Ke hoach sua font / le / TV ao / cong thuc cau 22 (5 phien)

Muc tieu: (1) cau dan + lua chon sat trai, canh deu 2 bien, dong cuoi khong rai chu; (2) bot gian dong cau dan; (3) het trung nhan A.A.; (4) cau 22 cong thuc inline nho, 4 lua chon tach dung; (5) khung san khau GV la tivi ao 16:9, thuat toan fit GIU NGUYEN, nut TV day khung do sang man 2.

Trang thai: **xong 5 phien**. Day la nguon su that. Phien sau CHI doc file nay + mo dung file liet ke trong phien do. KHONG doc lai toan repo. KHONG doc `suaketnoimanhinh.md` / `sualoidodaicauhoi.md` (ke hoach cu, lech quyet dinh TV ao).

File doi chieu cong thuc: `BAI 1 - GENE VA SU TAI BAN DNA.docx` o goc repo (Cau 22).

---

## 0. Prompt mo dau (copy dan cho AI phien code)

Ban la ky su Next.js/TypeScript. Doc toan bo `sualoifont.md`, lam DUNG phien duoc giao (khong lam truoc phien sau). Voi phien: (1) mo dung cac file liet ke, doi chieu code that, khong ap dung may moc neu ten bien/cau truc da khac; (2) sua dung pham vi phien; (3) chay `pnpm exec tsc --noEmit` va `pnpm lint`; (4) dien muc "Bao cao phien N" trong file nay; (5) commit + push. Message: `wip(font-stage): phien N - <tom tat>`. Khong them thu vien. Khong doi schema DB. Khong doi chu ky export worksheet-parser. Khong sua ham `measure` / binary search fit trong `adaptive-question.tsx` va `student-question-layout.tsx`. Khong WebRTC / captureStream. Khong tu goi Win+K hay doi Duplicate->Extend. Khong lam dong bo scrollTop qua SSE. Doc muc 6 truoc khi sua.

---

## 1. Quyet dinh da chot (khong hoi lai)

### 1.1 Thuat toan fit GIU NGUYEN

- `AdaptiveQuestion.measure` (binary search fs, thu cot, split 65/35, STAGE_MIN_FS=28, STAGE_MAX_FS=80) KHONG sua.
- `StudentQuestionLayout` KHONG sua logic fit.
- Chi doi CSS / canh le / khung CHA 16:9. Fit van chay trong khung no dang do.

### 1.2 Tivi ao 16:9 tren console GV

- Hien tai: `teacher-console.tsx` dong 273-276 — `QuizStage` fill `flex-1` (ti le theo phan con lai cua laptop, khong chuan TV).
- Moi: boc `QuizStage` trong khung **aspect-video (16:9)**, letterbox (nen toi) neu vung con lai khong dung 16:9.
- Hang so: `STAGE_ASPECT_CLASS = "aspect-video"` (Tailwind = 16/9). Khong magic number khac.
- Fit khong sua: no fit full dung khung 16:9 do, giong "tivi ao".
- Overlay chip/dong ho/badge HS giu trong `QuizStage` nhu hien tai.

### 1.3 Nut TV + cua so man 2

- Cu (lech): `teacher-console.tsx` dong 321-330 — `window.open(/teacher/sessions/${sessionId}/present)` ngay khi click.
- Moi: nut TV mo tour 4 buoc. Buoc cuoi `getScreenDetails()` + `window.open` dat man phu. That bai thi bao, KHONG mo uoc luong tren laptop.
- Cua so TV: URL van `/teacher/sessions/{id}/present` (PresentView + QuizStage). Khung trong cua so cung 16:9 letterbox. Vi TV fullscreen 16:9 ~ trung tivi ao GV (cung thuat toan fit, cung ti le). Khong captureStream.
- Laptop giu thanh nut + cot HS. Cua so TV khong co thanh Truoc/Dap an/Tiep, khong cot dung-sai-chua (PresentView da vay).
- Khong tu Win+K, khong tu doi Nhan ban -> Mo rong.

Tour Windows:

1. Ket noi: `Win+K` (Miracast) hoac cam HDMI.
2. Mo rong: `Win+P` -> **Mo rong**. Khong **Nhan ban**.
3. Chrome/Edge: Cho phep Window Management.
4. Mo san khau tren TV.

Tour Mac:

1. Ket noi: HDMI hoac Control Center -> Screen Mirroring. Phim `Ctrl+Cmd+F2`.
2. Displays: tat Mirror, Use as Separate Display. Phim `Opt+F2`.
3. Chrome/Edge: Cho phep Window Management. Safari thuong khong du.
4. Mo san khau tren TV.

Detect OS: `navigator.userAgentData.platform` / `navigator.userAgent`, cho doi tay.

Quyen:

- `window.getScreenDetails()` — Chrome/Edge. Khong co API = FAIL, huong dan buoc 3. KHONG `window.open` voi `screenX+outerWidth`.
- Khong co man `!isPrimary` = FAIL, huong dan buoc 2 (Duplicate van 1 man).
- Popup null = FAIL, cho phep popup. Mo popup TRONG click handler.
- Fullscreen: thu `requestFullscreen` tren cua so TV; fail thi GV F11. Khong lap vong.

localStorage:

- `edusync-tv-tour-done` = "1" sau khi mo san khau thanh cong.
- `edusync-tv-os` = `win` | `mac`.
- Lan sau: dialog ngan "Mo tren TV" + "Huong dan lai". Nut Tat TV `popup.close()`.

### 1.4 Trung nhan A.A.

- Parser `mcOptionContent` (`worksheet-parser.ts` dong 269-271) luu `"${letter}. ${text}"`. `tfOptionContent` (dong 334-336) luu `"${letter}) ${text}"`. KHONG doi ham nay, KHONG doi DB.
- UI ve badge `LETTERS[i]` roi in `o.content` -> `A.A. noi dung`.
- Cho: `adaptive-question.tsx` dong 170 + 173-174; `student-quiz-view.tsx` dong 237-240 (MC); `teacher-console.tsx` NextQuestionPreview dong 86 `{A}. {o.content}`.
- Sua: helper `stripOptionPrefix(s)` bo `^[A-Da-d][.)]\s*` o DAU chuoi (va dau HTML tuong duong). Badge giu. Noi dung sau strip. TF tren HS khong co badge chu cai — van strip neu content da co `a)`.

### 1.5 Gian dong cau dan

- `question-stem.tsx` dong 52 va 58: `leading-relaxed` (1.625). HTML Word moi doan `<p>` — margin mac dinh ~1em, font san khau 28-80px -> khe rat rong.
- Sua CHI tren stem/option dung cho live (truyen className / CSS `[&_p]:my-0`):
  - Stem san khau: `leading-snug` (da co `leading-tight` o AdaptiveQuestion dong 123 — `cn` merge Tailwind: giu 1 class leading, dung `leading-snug`).
  - `[&_p]:my-0` tren QuestionStem khi dung san khau.
  - Van ban thuan: collapse `\n{2,}` -> `\n` o phia render stem (khong doi parser).
- Khong doi default QuestionStem toan app (editor van leading-relaxed) — chi className truyen tu AdaptiveQuestion + student stem neu lo.

### 1.6 Canh le: trai + justify, dong cuoi khong rai

- AdaptiveQuestion dong 125: cau ngan `< 140` + khong bodyHtml -> `text-center`. Dong 194/203: `mx-auto`. Dong 201: `items-center`.
- Moi (san khau): `text-justify` + `text-align-last: left` (Tailwind arbitrary: `[text-align-last:left]`). Bo `text-center` / `text-balance` tren stem. Lua chon: `text-justify [text-align-last:left]`, sat trai.
- Khoi noi dung: `w-full` sat le, bo canh giua ngang cua CHU (mx-auto max-w-[1800px] van duoc de khong keo qua rong tren man sieu rong — nhung text-align left/justify ben trong).
- Man cho "Dang cho bat dau" (`quiz-stage.tsx` dong 63-70) GIU giua.
- Tranh chu rai dong cuoi: BAT BUOC `text-align-last: left`. Khong dung justify khong last-left.

### 1.7 Cau 22 (file doi chieu)

Word para 98-100:

- De: `Cau 22. Trinh tu ... 3' ATGAGTGACCGTGGC 5'. Doan gene nay co`
- Para 99: `A. Ty le [object MathType].` + `__B. 39 lien ket Hydrogene.__`
- Para 100: `C. 30 cap nucleotide.` + `D. 14 lien ket cong hoa tri.` (D dinh sat C, khong space truoc D)

Loi hien thi:

1. `imgTagToPlaceholder` (`worksheet-parser.ts` dong 633) tra `\n@@IMGn@@\n` — cong thuc xuong dong rieng, CSS figure `max-h-[28vh]` phong to nhu hinh -> o A rat cao -> fit (khong sua) ha font / split. Cau ngan hien nhu cau dai vo.
2. WMF/SVG phai `eq-inline`, khong `eq-figure`.
3. `splitChoiceBlock` marker can `(^|space)` truoc chu cai — `.D.` khong tach. Cho phep marker sau `.` / cuoi token (hep).

Sua hep:

- `eq-inline`: placeholder KHONG boc newline (`@@IMGn@@` cung dong).
- `eq-figure` / table: giu newline nhu cu.
- `tagEquationImages` giu SVG -> eq-inline.
- `splitChoiceBlock`: nhan dien `X.` / `X)` sau dau cham hoac ranh gioi; khong doi rule `#` `{ }` `[ ]` `-` / chu ky export.

### 1.8 Khong lam

- Sua `measure` / hang so STAGE_* / PHONE_*.
- WebRTC, captureStream, SSE scroll.
- Tu Win+K / Win+P.
- Them npm.
- Doi schema DB, parser export, cu phap Word chuong/bai.
- Doi `docx-omml.ts` / `docx-equations.ts` (tru khi phien 2 bat buoc 1 dong helper — uu tien extract-file + imgTagToPlaceholder).
- Fit-to-screen cho editor / lesson-detail / tab4-quiz.

---

## 2. Diem moc code hien tai (khong doc lai file dai)

### `components/question/question-stem.tsx` (62 dong)

- Sanitizer img giu `eq-inline`|`eq-figure` + style height em (dong 8-17).
- Wrapper: `overflow-y-auto` khi maxHeightClass khac `max-h-none` (dong 46-48).
- HTML: `leading-relaxed` + `[&_p]` CHUA co `my-0` (dong 52).
- Text: `whitespace-pre-wrap leading-relaxed` (dong 58).

### `components/live/adaptive-question.tsx` (221 dong)

- Hang so dong 13-16: STAGE_MIN_FS/MAX/SPLIT, LETTERS. **Khong sua khoi measure dong 31-91.**
- Stem dong 117-128: `leading-tight` + `text-center` khi ngan.
- Option dong 164-178: badge LETTERS[i] + QuestionStem `o.content` (chua strip).
- Layout single dong 200-208: `flex h-full items-center` + `mx-auto max-w-[1800px]`.

### `components/live/quiz-stage.tsx` (87 dong)

- Root `h-full w-full`. Overlay HS/dong ho/chip. Vung cau `pt-24 px-8`.
- `AdaptiveQuestion` dong 59. Man cho text-center dong 63-70 — giu.

### `components/live/teacher-console.tsx` (432 dong)

- QuizStage fill flex-1 dong 273-276 (chua 16:9).
- Nut TV dong 321-330 `window.open(present)` ngay.
- NextQuestionPreview dong 86: `A. {o.content}` — trung prefix.

### `components/live/present-view.tsx` (41 dong)

- `h-screen w-screen` + QuizStage + nut fullscreen. Chua letterbox 16:9.

### `components/live/student-quiz-view.tsx`

- MC dong 237-240: badge LETTERS + `{o.content}` chua strip.
- TF dong 264: `{o.content}` khong badge — van strip prefix `a)`.

### `lib/worksheet-parser.ts`

- `mcOptionContent` 269-271, `tfOptionContent` 334-336 — KHONG doi.
- `splitChoiceBlock` 301-332 — marker can space; phien 2 sua hep.
- `imgTagToPlaceholder` 622-633 — luon `\n@@IMG@@\n`; phien 2: eq-inline khong newline.

### `lib/extract-file.ts`

- `tagEquationImages` 8-15: SVG -> eq-inline, else eq-figure.
- convertImage WMF -> wmfToSvg. Khong sua pipeline OMML.

### Khong ton tai (phien 4 tao)

- `components/live/tv-stage-tour.tsx`
- `components/live/tv-tour-illustrations.tsx`
- `app/tv-tour-preview/page.tsx`

### Khong dam

- `lib/realtime.ts`, `use-live-quiz.ts`, `student-question-layout.tsx` (logic), `docx-omml.ts`, schema.

### Cong cu

- `pnpm exec tsc --noEmit`
- `pnpm lint` (eslint co the khong co trong package — giong ke hoach cu, khong them thu vien)

---

## 3. File se dam den (toan bo 5 phien)

- `components/question/question-stem.tsx` — phien 1 (p margin); khong doi default leading toan app neu co the lam bang className
- `components/live/adaptive-question.tsx` — phien 1 (CSS le/leading/strip). KHONG sua measure
- `components/live/student-quiz-view.tsx` — phien 1 (strip)
- `components/live/teacher-console.tsx` — phien 1 (preview strip); phien 3 (khung 16:9); phien 4-5 (nut TV / Tat TV)
- `lib/option-prefix.ts` — tao phien 1 (helper strip, dung chung)
- `lib/worksheet-parser.ts` — phien 2 CHI imgTagToPlaceholder + splitChoiceBlock hep
- `lib/extract-file.ts` — phien 2 chi neu class eq-inline sot
- `components/live/quiz-stage.tsx` — phien 3 chi neu can class khung; uu tien boc o console/present
- `components/live/present-view.tsx` — phien 3 letterbox 16:9
- `components/live/tv-tour-illustrations.tsx` — tao phien 4
- `components/live/tv-stage-tour.tsx` — tao phien 4, sua phien 5
- `app/tv-tour-preview/page.tsx` — tao phien 4 (demo tour, khong auth)
- `sualoifont.md` — moi phien cap nhat bao cao

Thu tu: 1 -> 2 -> 3 -> 4 -> 5.

---

## Phien 1 — Le, gian dong, het A.A.

### Muc tieu

San khau + man HS: 1 badge chu cai, noi dung khong lap `A.`. Cau dan/lua chon sat trai, justify, dong cuoi `text-align-last: left`. Gian dong stem ngan hon (`leading-snug`, `p` my-0, collapse newline thua). Khong sua measure.

### Viec lam

1. Tao `lib/option-prefix.ts`:

```ts
export function stripOptionPrefix(s: string): string {
  return s.replace(/^[A-Da-d][.)]\s*/, "")
}
```

Neu `bodyHtml` bat dau bang `A. ` / `<p>A. ` thi strip tuong duong (regex dau chuoi, khong xoa chu cai giua cau).

2. `adaptive-question.tsx`:
   - Stem className: bo `text-center` va `text-balance`. Them `text-justify [text-align-last:left]`. Doi `leading-tight` -> `leading-snug`. Them `[&_p]:my-0`.
   - Option QuestionStem: `content={stripOptionPrefix(o.content)}`, bodyHtml da strip prefix; class them `text-justify [text-align-last:left]`.
   - Badge LETTERS giu.
   - KHONG sua function `measure`, hang so, ResizeObserver.

3. `student-quiz-view.tsx`: MC `{stripOptionPrefix(o.content)}`; TF cung strip. Stem student: `[&_p]:my-0` neu dung QuestionStem.

4. `teacher-console.tsx` NextQuestionPreview: `{LETTERS[i]}. {stripOptionPrefix(o.content)}` (preview nho, 1 nhan).

5. `question-stem.tsx`: CHI them `[&_p]:my-0` vao khoi HTML neu khong pha editor. Neu so editor, dung className tu AdaptiveQuestion (`[&_p]:my-0` da cover). Uu tien khong doi default leading-relaxed toan app.

6. Collapse newline: trong AdaptiveQuestion, truoc khi truyen `content` stem, `content.replace(/\n{3,}/g, "\n\n")` hoac `\n{2,}` -> `\n`. Khong sua parser.

### File

- Tao: `lib/option-prefix.ts`
- Sua: `components/live/adaptive-question.tsx` (CSS + strip, khong measure)
- Sua: `components/live/student-quiz-view.tsx`
- Sua: `components/live/teacher-console.tsx` (chi preview)
- Sua: `components/question/question-stem.tsx` (chi neu can `[&_p]:my-0` default — ghi ro trong bao cao)
- Sua: `sualoifont.md`

### Nghiem thu

- Lua chon hien `A` + `noi dung`, khong `A.A.`.
- Cau ngan khong canh giua.
- Dong cuoi justify khong gian chu.
- `pnpm exec tsc --noEmit`; lint.

### Bao cao phien 1 (dien sau khi code)

- Da lam:
  - Helper `stripOptionPrefix` / `stripOptionPrefixHtml` bo `A.` `a)` o dau chuoi (va dau HTML `<p>A. `).
  - San khau: badge LETTERS giu; noi dung option da strip. Stem bo `text-center`/`text-balance`; `text-justify [text-align-last:left]`; `leading-snug`; `[&_p]:my-0`; collapse `\n{2,}` -> `\n`. Khong sua `measure`.
  - HS MC/TF strip prefix. Stem HS `[&_p]:my-0`.
  - NextQuestionPreview: `A. {stripOptionPrefix(o.content)}`.
  - Khong sua `question-stem.tsx` default (`leading-relaxed` editor giu).
- File da sua/tao:
  - Tao: `lib/option-prefix.ts`
  - Sua: `components/live/adaptive-question.tsx`
  - Sua: `components/live/student-quiz-view.tsx`
  - Sua: `components/live/teacher-console.tsx` (chi preview)
  - Sua: `sualoifont.md`
- Ket qua tsc/lint:
  - `npx tsc --noEmit`: dat (exit 0). (`pnpm exec tsc` loi corepack pnpm trong moi truong; dung npx.)
  - lint: fail san co — khong co `eslint.config.*`. Khong them thu vien. Khong phai loi moi.
- Diem chua chac:
  - `stripOptionPrefixHtml` chi bo prefix o dau chuoi / sau `<p>` mo; khong xu ly `<p>A.</p>` tach tag. Du lieu hien prefix nam o `content` text.
  - Tailwind `cn` merge `leading-snug` vs `leading-relaxed` default QuestionStem: className di sau, leading-snug thang.
- Viec tiep theo: phien 2 cau 22 inline + tach C/D.

---

## Phien 2 — Cau 22: cong thuc inline + tach lua chon

### Muc tieu

Cau 22: `Ty le` + cong thuc cung dong, cao ~chu (`eq-inline`). 4 o A/B/C/D. Fit khong sua — o A khong con cao 28vh nen fs lon lai.

### Viec lam

1. `imgTagToPlaceholder`: neu class `eq-inline`, return `@@IMG${i}@@` (KHONG `\n` hai ben). `eq-figure` va thieu class: giu `\n@@IMG@@\n`.

2. `splitChoiceBlock`: khi tim marker chu cai, cho phep ranh truoc la start / space / NBSP / dau `.` (de `nucleotide.D.` tach). Khong doi MC_LETTERS, khong doi `mcOptionContent`. Khong ghep dong LIST_START.

3. `extract-file.ts`: xac nhan `tagEquationImages` gan SVG = eq-inline. Neu object MathType ra raster khong svg: van eq-figure (chap nhan); ghi trong bao cao. Khong viet lai OMML.

4. Khong sua AdaptiveQuestion measure. Neu can, CSS option `[&_img.eq-inline]` da co o QuestionStem.

### File

- `lib/worksheet-parser.ts` (2 cho: placeholder + splitChoiceBlock)
- `lib/extract-file.ts` (chi neu sot class)
- `sualoifont.md`

### Nghiem thu

- Tam: chuoi `A. Ty le @@IMG0@@.\nB. 39...` / `C. 30 cap nucleotide.D. 14...` -> 4 option, IMG nam option A.
- Khong doi export function names.

### Bao cao phien 2 (dien sau khi code)

- Da lam:
  - `imgTagToPlaceholder`: `eq-inline` tra `@@IMGn@@` khong newline; `eq-figure` / thieu class giu `\n@@IMGn@@\n`.
  - `splitChoiceBlock`: ranh truoc marker them dau `.` — `nucleotide.D.` tach thanh C va D. Khong doi `mcOptionContent` / export.
  - `extract-file.ts`: khong sua — `tagEquationImages` da gan SVG = eq-inline.
  - Parse tam cau 22: 4 option, IMG nam A.
- File da sua/tao:
  - Sua: `lib/worksheet-parser.ts`
  - Sua: `sualoifont.md`
- Ket qua tsc/lint:
  - `npx tsc --noEmit`: dat (exit 0).
  - lint: fail san co — khong co `eslint.config.*`. Khong them thu vien.
- Diem chua chac (WMF fail -> figure?):
  - Neu MathType khong ra SVG, `tagEquationImages` van gan `eq-figure` + newline — o A co the cao. Chap nhan, khong fake.
  - Marker sau `.` co the sai neu de bai co chu `A.` giua cau (hep, dung cho Cau 22).
- Viec tiep theo: phien 3 khung 16:9.

---

## Phien 3 — Khung tivi ao 16:9

### Muc tieu

QuizStage tren console nam trong hop 16:9, letterbox nen toi. Present cung 16:9. Fit khong sua, tu full hop do.

### Viec lam

1. Helper nho trong `quiz-stage.tsx` hoac `components/live/stage-frame.tsx`:

```tsx
export function StageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <div className="aspect-video h-full max-w-full">
        {children}
      </div>
    </div>
  )
}
```

Neu `h-full` + `aspect-video` bi overflow ngang: them `max-w-full w-auto` / `object-contain` tuong duong CSS contain. Kiem tra: vung console (tru thanh nut + cot HS) letterbox dung, khong cat chip.

2. `teacher-console.tsx` dong 273-276: boc `<StageFrame><QuizStage view={view} /></StageFrame>`.

3. `present-view.tsx`: root khong fill meo 16:10; boc StageFrame quanh QuizStage (fullscreen TV 16:9 ~ full; laptop 16:10 co letterbox). Nut fullscreen giu.

4. Khong sua AdaptiveQuestion.

### File

- Tao: `components/live/stage-frame.tsx` (neu khong muon phinh quiz-stage)
- Sua: `components/live/teacher-console.tsx`
- Sua: `components/live/present-view.tsx`
- Sua: `sualoifont.md`

### Nghiem thu

- Console: san khau dung 16:9, thanh nut + cot HS ngoai khung.
- Doi cau: fit van chay (fs doi theo khung 16:9).

### Bao cao phien 3 (dien sau khi code)

- Da lam:
  - `StageFrame`: letterbox nen den, hop trong `aspect-video` 16:9, contain theo khung cha (`@container` + `cqw`/`cqh`).
  - Console: boc QuizStage trong StageFrame (thanh nut + cot HS ngoai khung).
  - PresentView: boc QuizStage trong StageFrame; nut fullscreen giu.
  - Khong sua AdaptiveQuestion / measure.
- File da sua/tao:
  - Tao: `components/live/stage-frame.tsx`
  - Sua: `components/live/teacher-console.tsx`
  - Sua: `components/live/present-view.tsx`
  - Sua: `sualoifont.md`
- Ket qua tsc/lint:
  - `npx tsc --noEmit`: dat (exit 0).
  - lint: fail san co — khong co `eslint.config.*`. Khong them thu vien.
- Diem chua chac:
  - `@container` / cqw can Tailwind v4 (project dung v4). Neu browser cu khong cqw, khung co the khong contain dung — chap nhan.
  - Present 16:10: letterbox; TV 16:9 fullscreen ~ full hop.
- Viec tiep theo: phien 4 tour TV.

---

## Phien 4 — Tour nut TV + openOnTv fail ro

### Muc tieu

Bam TV: tour 4 buoc, khong mo present ngay. Buoc 4 chi thanh cong khi >= 2 man. Khong open toa do uoc luong.

### Viec lam

1. `tv-tour-illustrations.tsx`: KeyCap, Laptop, TvSet; 4 anh: ket noi Win/Mac, extend Win/Mac (menu Win+P highlight Mo rong, gach Nhan ban), quyen Chrome, day san khau. Tieng Viet co dau. Phim Win+K, Win+P, Ctrl+Cmd+F2, Opt+F2.

2. `tv-stage-tour.tsx`: Dialog 4 buoc, tab Win/Mac, detect OS, luu `edusync-tv-os`.

`openOnTv` (trong click):

- Khong `getScreenDetails`: setErr Chrome/Edge + buoc 3. return.
- API, khong man `!isPrimary`: setErr buoc 2. return.
- Co man 2: `window.open(presentUrl, "edusync-tv-stage", left/top/width/height avail*)`, `moveTo`/`resizeTo`, thu fullscreen.
- Popup null: setErr cho phep popup.
- Thanh cong: `close()` tour, `localStorage edusync-tv-tour-done=1`, giu handle popup (ref).
- That bai: khong dong tour.
- `sessionId` bat buoc khi goi tu console. Preview khong sessionId: khong goi present that.

3. Console: nut TV `setTvTourOpen(true)`, XOA `window.open` ngay dong 325.

4. `app/tv-tour-preview/page.tsx`: xem tour, khong login. Mac dinh giu.

Kieu `getScreenDetails`: ep kieu hep `(window as Window & { getScreenDetails?: () => Promise<{ screens: { isPrimary: boolean; availLeft: number; availTop: number; availWidth: number; availHeight: number }[] }> })`.

### File

- Tao: `components/live/tv-tour-illustrations.tsx`
- Tao: `components/live/tv-stage-tour.tsx`
- Tao: `app/tv-tour-preview/page.tsx`
- Sua: `components/live/teacher-console.tsx`
- Sua: `sualoifont.md`

### Nghiem thu

- 1 man: Mo san khau -> loi, khong tab present tren laptop.
- Console bam TV ra tour.

### Bao cao phien 4 (dien sau khi code)

- Da lam:
  - Tour 4 buoc (Win/Mac), detect OS, luu `edusync-tv-os`. Anh: ket noi, Mo rong (gach Nhan ban), quyen Chrome, day san khau. Phim Win+K, Win+P, Ctrl+Cmd+F2, Opt+F2.
  - `openOnTv` trong click: khong `getScreenDetails` -> loi buoc 3, khong open. Khong man `!isPrimary` -> loi buoc 2, khong open. Popup null -> loi popup. Thanh cong: moveTo/resizeTo man phu, thu fullscreen 1 lan, `edusync-tv-tour-done=1`, dong tour.
  - Preview `/tv-tour-preview` khong sessionId: khong goi present.
  - Console nut TV mo tour; XOA `window.open(present)` ngay.
- File da sua/tao:
  - Tao: `components/live/tv-tour-illustrations.tsx`
  - Tao: `components/live/tv-stage-tour.tsx`
  - Tao: `app/tv-tour-preview/page.tsx`
  - Sua: `components/live/teacher-console.tsx`
  - Sua: `sualoifont.md`
- Ket qua tsc/lint:
  - `./node_modules/.bin/tsc --noEmit`: dat (exit 0).
  - lint: fail san co — khong co `eslint` / `eslint.config.*`. Khong them thu vien. Khong phai loi moi.
- Diem chua chac:
  - `await getScreenDetails()` truoc `window.open` co the mat user-gesture -> popup null (da bao loi, khong mo uoc luong).
  - `requestFullscreen` tren popup de bi chan; GV F11. Khong lap vong.
  - Handle popup chua dua ra console (Tat TV = phien 5).
- Viec tiep theo: phien 5 lan sau + Tat TV + ra soat.

---

## Phien 5 — Lan sau ngan, Tat TV, ra soat, chot

### Muc tieu

Da chieu 1 lan: dialog ngan Mo ngay / Huong dan lai. Nut Tat TV dong popup. Grep het `window.open(.*present` o console. tsc/lint. Dien rui ro muc 6.

### Viec lam

1. Doc `edusync-tv-tour-done`. Co: UI ngan, "Mo san khau tren TV" goi `openOnTv`. "Huong dan lai" step=0 trong dialog.

2. Ref popup. Nut "Tat TV" canh nut TV, `popup.close()`. An neu chua mo.

3. Grep: `present`, `getScreenDetails`, `TvStageTour`, `window.open`. Khong sot open present tu nut TV.

4. Safari/Firefox: err ro, khong crash.

5. Giu `/tv-tour-preview` (mac dinh).

6. Khong sua PresentView layout (tru StageFrame da co phien 3).

### File

- `components/live/tv-stage-tour.tsx`
- `components/live/teacher-console.tsx`
- `sualoifont.md` (bao cao + Trang thai)

### Nghiem thu (tong)

1. Win 1 man Chrome: tour 4 buoc, buoc 4 loi chua thay man phu.
2. Win+P Mo rong + HDMI: present full TV; laptop console + tivi ao 16:9.
3. Duplicate: loi man phu.
4. Chan popup / Window Management: loi, tour khong dong.
5. Lan 2 dialog ngan.
6. Tat TV dong cua so.
7. Cau 22: cong thuc cung dong A; khong A.A.; le trai + justify last-left.
8. HS phone khong tour; MC khong A.A.

### Bao cao phien 5 (dien sau khi code)

- Da lam:
  - Doc `edusync-tv-tour-done`: lan sau dialog ngan "Mở sân khấu trên TV" (goi `openOnTv`) + "Hướng dẫn lại" (step=0). That bai: khong dong, nhay sang buoc loi.
  - Ref popup qua `onPopupChange`. Nut "Tắt TV" canh nut TV, `popup.close()`, an khi chua mo / popup da dong.
  - Safari/Firefox: `getScreenDetails` thieu / throw -> err ro, khong crash. Preview khong sessionId: khong open present.
  - Giu `/tv-tour-preview`. Khong sua PresentView layout.
- File da sua/tao:
  - Sua: `components/live/tv-stage-tour.tsx`
  - Sua: `components/live/teacher-console.tsx`
  - Sua: `sualoifont.md`
- Ket qua tsc/lint:
  - `./node_modules/.bin/tsc --noEmit`: dat (exit 0).
  - lint: fail san co — khong co `eslint` / `eslint.config.*`. Khong them thu vien.
- Grep con sot:
  - `window.open(present)`: CHI `tv-stage-tour.tsx` `openOnTv` (sau khi co man `!isPrimary`). Console nut TV khong open.
  - `session-control.tsx` van `<a href=.../present>` "Mở TV" (tab thuong, khong phai nut TV console). Khong sua — ngoai pham vi phien.
- Rui ro 6.x (bao cao, chua sua):
  - 5.1 App khong Win+K/Win+P — tour + fail message.
  - 5.2 getScreenDetails Chrome/Edge; Duplicate = 1 man.
  - 5.3 Hai QuizStage (console + present), khong pixel 1:1.
  - 5.4 requestFullscreen popup de chan; F11.
  - 5.5 WMF MathType khong SVG van eq-figure.
  - 5.6 `/tv-tour-preview` khong auth.
  - 5.7 text-justify + last-left (phien 1).
  - Them: `await getScreenDetails` co the mat user-gesture -> popup null (bao loi, khong mo uoc luong). Poll 800ms dong "Tắt TV" khi GV tu dong cua so.
- Viec tiep theo: khong. Ke hoach xong.

---

## 4. Tieu chi hoan thanh

- tsc khong loi moi. lint: khong loi moi (eslint thieu thi ghi nhu cu).
- Fit measure khong diff.
- Nut TV khong `window.open` ngay.
- Mo san khau chi khi >= 2 man.
- San khau GV 16:9; TV cua so 16:9 PresentView.
- Khong SSE scroll, khong WebRTC, khong them thu vien.
- Het A.A. Het stem canh giua. Dong cuoi khong rai chu.

---

## 5. Luu y / rui ro (doc truoc khi sua)

### 5.1 App khong dieu khien OS

Khong Win+K / Win+P. Tour + fail message. GV phai Extend.

### 5.2 getScreenDetails

Chi Chrome/Edge. 1 man khi Duplicate. Khong doan man 2.

### 5.3 Hai tien trinh QuizStage

Console va cua so present moi cai mot `useLiveQuiz` + fit. Cung 16:9 ~ giong nhau, khong phai guong pixel 1:1. Chap nhan. Khong captureStream.

### 5.4 requestFullscreen popup

De bi chan. Fallback F11. Khong lap vong.

### 5.5 WMF MathType cau 22

Neu khong ra SVG, anh van eq-figure. Bao cao, khong fake thanh cong.

### 5.6 Preview route

`/tv-tour-preview` khong auth. Chi UI tour.

### 5.7 text-justify

Bat buoc `[text-align-last:left]`. Khong justify dong cuoi.

---

## 6. Quy trinh bat buoc sau moi phien

1. Dien "Bao cao phien N".
2. Cap nhat muc Trang thai.
3. Commit + push. Message: `wip(font-stage): phien N - <tom tat>`.
4. Phien sau chi doc file nay.

---

## Trang thai

- Phien hien tai: xong phien 5 (ke hoach xong)
- Phien 1: xong (le, gian dong, A.A.)
- Phien 2: xong (cau 22 inline + tach C/D)
- Phien 3: xong (tivi ao 16:9)
- Phien 4: xong (tour TV)
- Phien 5: xong (lan sau ngan, Tat TV, ra soat)

Diem moc sau 5 phien:

- Nut TV mo tour / dialog ngan; `window.open(present)` chi trong `openOnTv` khi co man phu
- Nut Tat TV dong popup
- tv-tour + `/tv-tour-preview`
- StageFrame 16:9 letterbox (console + present)
- Badge + strip prefix (het A.A.)
- Stem justify + last-left, leading-snug, p my-0
- eq-inline khong newline; splitChoiceBlock tach `.D.`
