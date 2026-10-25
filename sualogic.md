# Ke hoach sua logic cham diem (8 phien)

Trang thai: **phien 8 xong**. Day la nguon su that cho 8 phien. Het 8 phien — dung. KHONG lam phan hoan (muc 3).

Nguon: doi chieu spec `Spec sua logic cham diem — EduSync (ontapsinhhoc2026).md` voi code that. Cac ID (FD-01, QZ-01, ...) giu nguyen de truy vet.

---

## 0. Prompt mo dau (copy dan cho AI phien code)

Ban la ky su Next.js/TypeScript. Doc toan bo `sualogic.md`, lam DUNG phien duoc giao (khong lam truoc phien sau). Voi phien: (1) mo dung cac file liet ke, doi chieu code that, khong ap dung may moc neu ten bien/cau truc da khac; (2) sua dung pham vi phien; (3) viet/chay test unit trong `scripts/check-scoring-phienN.mjs` bang `node --experimental-strip-types scripts/check-scoring-phienN.mjs`; (4) chay `pnpm exec tsc --noEmit`; (5) dien muc "Bao cao phien N" trong file nay (danh dau viec da lam / con lai / file da doi); (6) commit. Khong them thu vien. Khong doi UI ngoai pham vi phien. Khong lam muc 3 (phan hoan). Khong xoa bang chet. Doc muc 1 va muc 4 truoc khi sua.

Commit message: `wip(scoring): phien N - <tom tat>`.

Sau commit, cap nhat bang "Tien do" o muc 5: cot phien N = xong, ghi 1-2 dong ket qua that (khong doan).

---

## 1. Quyet dinh da chot (khong hoi lai)

### 1.1 Pedagogic / cham

- Khong bo dau TV: `nucleotit` khac `nuclêôtit`.
- Xem dap an roi dung van `mastered`. Cot `fillRevealed` / `dragRevealed` chi de thong ke.
- **Phuong an B:** Tab 3 chi KP `selfAssessment === 'unknown'`. Khong nut "Chuyen sang Keo tha", khong cot `fillGaveUp`. HS "Biet" o lai Tab 2 toi khi dung.
- Bo quy tac ngoac kep thuong `"tu"` = o trong. Chi `__tu__` (co dinh) va `__"tu"__` (hoan doi). Import/preview canh bao chuoi `"..."` khong nam trong `__`.
- Thang diem **linear** (`10 / totalSlots`). Khong lam `scoringMode: 'thpt'`.
- Hoan thanh bai giao = da nop Tab 4 **sau** `submittedAt` hien tai (`resolveStudyStage === 'done'`). Khong diem san.
- Live 1 process: luu `live_answers`, RAM la cache. Khong Redis / LISTEN NOTIFY.

### 1.2 Ky thuat bat buoc

- Offset o trong: UTF-16, sau `trim` cua content luu DB. Bat bien: `content.slice(start, end) === text`.
- Snapshot de Tab 4: `questionId` **khong** FK `ON DELETE CASCADE` (GV xoa cau khong duoc mat snapshot bai dang lam). `attemptId` van CASCADE theo attempt.
- Unique `quiz_answers`: partial unique, **khong** zero-uuid.
- Rate-limit cham Tab 2/3: **10 lan/phut/HS/KP**, khong chan 1 giay.
- `normalizeAnswer`: giu NFC + gop space + cat dau cau hai dau (da co). Chi **them** map smart quotes / prime / dash. So (`0,5`) xu ly o `gradeSA`, khong nhet vao normalize chuoi.
- Matching swap-group: `allCorrect` khi matching du. O do chi khi value **khong thuoc matching nao** (khong to do theo 1 matching tuy y).
- DDL moi: them vao `ensureSchema()` trong `lib/db/index.ts` (app chua dung drizzle-kit migrate). Moi `ALTER` / `CREATE` phai `IF NOT EXISTS` hoac `DO $$ ... pg_constraint`.

### 1.3 Giu nguyen (khong pha)

- Import ep MC dung 4 lua chon / 1 dap an, TF dung 4 y.
- `seededRng` / `seededShuffle` (`lib/grading.ts`).
- Khoa Tab 1 sau khi nop. Trang thai `correct` khong bi ha.
- Tab 4 khong gui `isCorrect` xuong client luc lam bai. Live che dap an toi luc GV reveal.
- Luong 4 buoc UI (`suaui.md`): chi di tien, xem lai Tab 1 readonly.

---

## 2. Hien trang code (snapshot luc viet ke hoach — dung khi mo file)

Khong can grep toan repo. Day la diem moc.

### Types (`types/index.ts`)

```
UnderlinedTerm = { text, slotIndex, allowSwap, swapGroupId, extraAccepted, synonyms? }
```

Chua co `start` / `end`.

### Cham (`lib/grading.ts`)

- `normalizeAnswer`: NFC, xoa ZWSP, NBSP->space, gop `\s+`, cat `.,;:!?…` hai dau, lower. **Chua** doi `’` `′` -> `'`. `tế  bào` va NBSP **da khop**.
- `gradeSlots`: swap-group greedy `findIndex` + splice. Mot o sai to do ca nhom. Tra `correctAnswer: t.text` theo vi tri.
- `computeOverallStatus`: `fill incorrect` -> unknown; `fill/drag correct` -> mastered; else theo selfAssessment.
- `seededRng`, `seededShuffle`, `toAnswerMap` — giu.

### Render o (`lib/slot-render.ts`)

`cleanContentDisplay(content)` roi `indexOf(term.text)` lan xuat hien dau chua chiem. Sai khi chu lap / nam trong tu khac (`T` trong `Trong`).

### Parser (`lib/worksheet-parser.ts` — `extractBlanks`)

- Marker: `__...__` roi `"..."` khong overlap. `"tu"` **dang** tao o hoan doi.
- Tinh `cleanStart` nhung **khong luu** start/end vao term.
- `content.trim()` cuoi ham (lech offset neu co space dau).
- Swap group: moi o hoan doi lien nhau khong co `.!?;\n` xen -> **mot nhom** (timin/xitozin sai).
- Nhom 1 thanh vien -> `swapGroupId = null`.

### Render lai marker (`lib/kp-render.ts`)

`indexOf(term.text, cursor)` — cung loi vi tri. Dung o `lesson-detail.tsx` khi bam sua KP (~dong 703).

### Preview GV (`worksheet-preview-doc.tsx`)

`highlightBlanks(content, terms)` cung `indexOf` — sua theo offset o phien 1-2.

### Tab 2/3 action (`app/actions/student-learn.ts`)

- `assertLessonAccess(studentId, lessonId)` da co. `getTab2Questions` / `getTab3Questions` / `submitTab1` goi. **`submitTab2Question` / `submitTab3Question` KHONG goi** — chi `requireRole('student')`.
- `submitTab1` khong kiem kpId thuoc lesson; vong lap N query.
- `getTab2Questions` tra `{ content, terms }` (lo dap an). Loc `sa=known && fill !== 'correct'`.
- `getTab3Questions` loc `sa==='unknown' || fill==='incorrect'`. `chips: string[]`. Chip nhieu: text KP khac, `!correctTexts.has(d)` (so sanh thô, khong normalize).
- `submitTab2/3`: `gradeSlots` roi INSERT/UPDATE progress. Sai -> `fillStatus='incorrect'`. Da `correct` thi khong ha. Tang attempts SQL `col+1`. Tra ca `correctAnswer`.
- `resolveStudyStage`: Tab 2 khi `sa=known && fill!=='correct'`; Tab 3 khi `(sa=unknown || fill=incorrect) && drag!=='correct'`.
- `resetLessonProgress`: giu `selfAssessment`, set `overallStatus='not_started'`, xoa fill/drag/attempts. Chi cho phep khi stage==='done'.
- `student_tab1_submissions` **khong UNIQUE** (studentId, lessonId).

### Tab 2 UI (`components/student/tab2-fill-in.tsx`)

Goi `renderSlots`. Hint chu dau 2 lan sai, lan 3 hien dap an — **o client** tu `correctAnswer` server luon tra. `wrongTries` localStorage.

### Tab 3 UI (`components/student/tab3-drag-drop.tsx`)

- `chips: string[]`. `placement: Record<number, string | null>` luu **text**.
- `placeChip` **khong** xoa o cung chu (spec sai). Loi that: cung 1 chip text dat 2 o (clone); `selectedChip` so sanh text; key `chip-${i}-${chip}`.
- Sai lan 1 da hien `correctAnswer`.

### Tab 4 (`startQuiz` / `submitQuiz` cung file student-learn.ts)

- `startQuiz`: `ensureSchema()`, chon de `selectQuizQuestions` (`lib/quiz-selection.ts`: co KP -> **toan bo** cau; khong -> 18/4/6), **khong luu** danh sach cau. Insert `quiz_attempts` moi moi lan goi. Tra option khong `isCorrect`.
- `submitQuiz`: `questionIds = Object.keys(answers)` — cham cau client gui, **khong** doi chieu de. TF: `map[o.id] ?? 'S'`. Khong transaction. Update attempt -> insert answers -> seed spaced_repetition tung KP.
- `quiz_answers`: `{ attemptId, questionId, studentAnswer, isCorrect }` — chua `optionId`.

### Live (`app/actions/live-quiz.ts`)

- `joinQuiz` kiem HS thuoc lop. `submitLiveAnswer` **khong** kiem lop, khong kiem het gio, khong validate optionId. `gradeLiveAnswer`: MC includes id; SA `normalizeAnswer` 1 correctText; TF tap option "Dung" khop het.
- `goToQuestion`: `state.answers.clear()`. `ensureLiveState` restore tu `resumeSnapshot` (lessonId, index, phase) — **mat answers**.

### Schema lien quan (`lib/db/schema.ts`)

- `knowledge_points.underlinedTerms` jsonb.
- `student_progress` PK (studentId, knowledgePointId). Chua firstTry/revealed.
- `quiz_attempts`: score, maxScore, totalSlots, startedAt, completedAt.
- `quiz_autosave` / `spaced_repetition` / `worksheet_attempts` — **khong dung, khong xoa**.

### Thong ke

- `lib/assignment-status.ts`: `completed` khi `hasCompletedQuiz || touchedKp >= totalKp`. `touched` = overallStatus != not_started (Tab 1 da set het).
- `app/actions/assignments.ts` ~255-279: `hasCompletedQuiz` moi attempt xong (ke ca truoc reset).
- `class-stats.ts`: `overconfident = known && fillStatus==='incorrect'`.

### DDL runtime (`lib/db/index.ts` `ensureSchema`)

Chuoi ALTER IF NOT EXISTS. Them cot/bang moi vao **cuoi** chuoi `.then(...)`.

### Editor GV

- `kp-content-editor.tsx`: preview `extractBlanks` + `highlightBlanks`. Canh bao "can 1 o trong (gach chan hoac ngoac kep)".
- `lesson-detail.tsx` `submitKp`: extractBlanks -> create/update KP. Mo sua: `setRawContent(renderMarkedContent(...))`.

---

## 3. Phan hoan — CAM sua trong 8 phien nay

| ID | Ly do ngan |
| --- | --- |
| FD-09 pedagogic (nut give-up, fillGaveUp, Tab 3 cho "Biet" sai) | Da chot phuong an B |
| QZ-06 thang THPT | Doi san pham, chua chot quy che |
| QZ-08 chon de / 1 cau moi KP / tran 18/4/6 | Mau thuan spec |
| QZ-05 tolerance cot DB, `1/2`, nhieu option SA + UI soan | De cham oan |
| ST-02 mui gio streak | Khong sai diem |
| OP-01 hieu nang gop query | No ky thuat |
| OP-03 bo ensureSchema / drizzle migrate | Ngoai pham vi |
| OP-04 xoa bang chet | Irreversible |
| OP-06 canh bao soan (do dai 2 ky tu, nhay cong) | UX soan, khong cham |
| Redis / nhieu instance live | Da chot 1 process |

Khong "lam luon neu con suc". Het 8 phien thi dung.

---

## 4. Module cham dung chung (lam o phien 3, file moi)

Tao `lib/scoring.ts` **thuan** (khong import db). `lib/grading.ts` re-export tu scoring de khong vo import cu (`student-learn.ts`, `live-quiz.ts`, `quiz-selection.ts` van `from "@/lib/grading"` duoc).

API bat buoc:

```ts
normalizeAnswer(input: string): string
// thu tu: NFC; NBSP/ZWSP; ‘ ’ ʹ ′ ´ ` -> '; ‐ ‑ ‒ – — − -> -; gop space; cat dau cau hai dau; lower
// KHONG bo dau TV. KHONG doi 0,5.

gradeSlots(terms, answers): { results: { slotIndex, isCorrect, correctAnswer }[]; allCorrect }
// swap-group: Kuhn matching. allCorrect <=> matching du moi o.
// isCorrect cua o = value nam trong MOT max-matching (o do chi khi khong ghep duoc voi term con lai).
// correctAnswer o sai trong group = text cua term CHUA duoc ghep (khong gan cung slot).

gradeMC(chosenId: string | null, correctOptionId: string): boolean
gradeTF(student: Record<string, 'D'|'S'|null|undefined>, options: { id: string; isCorrect: boolean }[]): { perOption: { optionId, isCorrect, answered }[]; correctCount: number }
// thieu key hoac gia tri ngoai D/S => answered=false, isCorrect=false. BO ?? 'S'.

gradeSA(input: string, accepted: string[]): boolean
// dung neu normalizeAnswer(input) === normalizeAnswer(mot accepted)
// HOAC ca input va accepted parse duoc so thuan (chi chu so + mot dau , hoac .) thi Number bang nhau.
// Khong nhan 1/2, khong tolerance, khong 1 500 = 1500.

scoreLinear(correctSlots: number, totalSlots: number): { score: number; percentage: number }
// score = min(10, Number((correctSlots * 10 / totalSlots).toFixed(2))); percentage floor 0-100
```

`computeOverallStatus`, `seededRng`, `seededShuffle`, `toAnswerMap` o lai `grading.ts` (hoac re-export). Khong doi chu ky.

---

## 5. Tien do (cap nhat moi phien)

| Phien | Muc tieu | Trang thai |
| --- | --- | --- |
| 1 | Offset o trong + extractBlanks + renderSlots/kp-render | xong — `node --experimental-strip-types scripts/check-scoring-phien1.mjs` in `phien 1 OK` |
| 2 | Parser nhom hoan doi, bo ngoac kep thuong, backfill, UI GV | xong — `node --experimental-strip-types scripts/check-scoring-phien2.mjs` in `phien 2 OK`; khong co DATABASE_URL nen backfill bo qua |
| 3 | lib/scoring.ts, matching, normalize quotes, gradeSA so | xong — `node --experimental-strip-types scripts/check-scoring-phien3.mjs` in `phien 3 OK` |
| 4 | Snapshot de Tab 4, TF trong = sai, diem <= 10 | xong — `node --experimental-strip-types scripts/check-scoring-phien4.mjs` in `phien 4 OK` |
| 5 | Chip id Tab 3, an dap an Tab 2/3, 10 cham/phut | xong — `node --experimental-strip-types scripts/check-scoring-phien5.mjs` in `phien 5 OK` |
| 6 | Quyen server Tab 1/2/3, ST-01 hoan thanh, LV-01/02 | xong — `node --experimental-strip-types scripts/check-scoring-phien6.mjs` in `phien 6 OK` |
| 7 | Transaction quiz, unique Tab 1, reset overallStatus, reuse attempt | xong — `node --experimental-strip-types scripts/check-scoring-phien7.mjs` in `phien 7 OK` |
| 8 | Live answers DB, scoring chung live, giu option id, firstTry | xong — `node --experimental-strip-types scripts/check-scoring-phien8.mjs` in `phien 8 OK` |

---

## 6. Tám phien

Moi phien: pham vi, file DUOC mo, viec, nghiem thu, cam.

### Phien 1 — Offset o trong (FD-01, FD-02 loi)

**File duoc mo**

- `types/index.ts` — them `start?: number; end?: number` vao `UnderlinedTerm` (optional de du lieu cu).
- `lib/worksheet-parser.ts` — chi ham `extractBlanks` (khoang dong 106-211). Khong doi parse MC/TF/SA.
- `lib/slot-render.ts` — toan file.
- `lib/kp-render.ts` — toan file.
- `scripts/check-scoring-phien1.mjs` — tao moi.

**Viec**

1. `extractBlanks`: voi moi term, `lead = content.length - content.trimStart().length` **sau** khi ghep xong, truoc `return`. `start = cleanStart - lead`, `end = start + text.length`. Gan vao term. `content` van `trim()` nhu hien tai.
2. `renderSlots`: neu MOI term co `start`/`end` number va `content.slice(start,end)===text` (content **chua** cleanContentDisplay) thi cat theo offset, sort theo start, **khong** `indexOf`, **khong** `cleanContentDisplay`. Thieu/vi pham -> nhanh legacy hien tai + `console.warn('renderSlots legacy', { texts })`.
3. `renderMarkedContent`: cung nhanh offset (sort start, chen `__` / `__"..."__` + `|syn`). Legacy indexOf neu thieu offset.
4. Test phien 1 (khong DB):
   - `Trong ADN, A liên kết với __T__ ...` -> content slice dung, renderSlots dat o tai `T` sau "voi ", khong cat `Trong`.
   - `nucleotit` lap; `ADN` lap.
   - Content bat dau bang space: start/end van dung sau trim.
   - `extractBlanks(renderMarkedContent(c,t))` roundtrip text+slotIndex+allowSwap+synonyms+start+end.

**Cam:** khong doi swap-group; khong bo `"tu"` blank; khong sua UI; khong schema.

**Bao cao phien 1** (dien truoc khi commit)

- Da lam:
  - `UnderlinedTerm` them `start?`/`end?`.
  - `extractBlanks` gan `start = cleanStart - lead`, `end = start + text.length` (lead = space dau truoc `trim()`).
  - `renderSlots` / `renderMarkedContent` cat theo offset khi moi term thoa bat bien `content.slice(start,end)===text`; overlap/thieu offset -> legacy `indexOf` + `console.warn`.
  - Test: 3 vi du T/nucleotit/ADN, space dau, roundtrip syn+swap, legacy khong offset van cat `Trong`.
- Con lai / lech ke hoach:
  - Swap group va `"tu"` blank chua doi (phien 2).
  - `pnpm exec tsc --noEmit` khong chay duoc (thieu node_modules / corepack). Loi tsc global toan la missing deps, khong lien quan file phien 1.
- File da doi:
  - `types/index.ts`
  - `lib/worksheet-parser.ts` (`extractBlanks` thoi)
  - `lib/slot-render.ts`
  - `lib/kp-render.ts`
  - `scripts/check-scoring-phien1.mjs`
  - `sualogic.md`

---

### Phien 2 — Nhom hoan doi + bo ngoac kep thuong + backfill + GV (FD-05, FD-01 data)

**File duoc mo**

- `lib/worksheet-parser.ts` — `extractBlanks` (nhom + bo quote-thuong) va cho validate import neu da co canh bao quote. Ham `malformedQuoteUnderlineMarks` giu.
- `lib/slot-render.ts` — neu can export helper cat parts dung chung.
- `components/teacher/worksheet-preview-doc.tsx` — `highlightBlanks` dung start/end khi co.
- `components/teacher/kp-content-editor.tsx`
- `components/teacher/lesson-detail.tsx` — badge needsReview; khoa Luu **tung KP** thieu offset (khong khoa ca bai). Dong submitKp ~421-444, mo sua ~703.
- `scripts/backfill-term-offsets.mjs` — tao moi.
- `scripts/check-scoring-phien2.mjs` — tao moi.

**Viec**

1. `extractBlanks` buoc 2: **khong** push marker tu `"..."` thuong. Chi `__tu__` va `__"tu"__`. (Quote nam trong `__` van la swap nhu hien tai.)
2. Swap group: hai o swap cung nhom khi `between` (content giua end o truoc va start o sau) match:

```
/^\s*([,\/\-–→]|va|hoac)?\s*$/i
```

Khong thi nhom moi. Toi da 8 o/nhom: neu vuot, van cat nhom (khong throw trong extractBlanks dung luc render HS); `validateDocument` / preview bao loi kem so dong neu ham do da duyet KP.
3. Nhom 1 thanh vien van `swapGroupId=null` nhu cu.
4. Preview editor: huy hieu Nhom N tren o swap; canh bao `"nhan doi"` con trong raw nhu quote khong wrap `__`.
5. Canh bao trung chu: "Chu nay xuat hien n lan; o trong theo vi tri ban danh dau."
6. `lesson-detail`: KP term thieu start/end -> badge "Can xac nhan o trong". Khi sua KP thieu offset: hien canh bao, **disable nut Luu** toi khi GV chinh raw va extractBlanks ra du offset (luu lai qua extractBlanks la du).
7. Backfill script: doc tat ca KP. Voi moi text T, tim **word-boundary** occurrence trong content (khong substring: `T` trong `Trong` khong tinh). Neu so match boundary === so term text T thi gan start/end theo thu tu slotIndex. Neu khong khop -> ghi CSV `needsReview` (kpId, lessonId, content snippet). Khong doan. Chay thu `node --experimental-strip-types scripts/backfill-term-offsets.mjs` neu co DATABASE_URL; khong co thi van commit script.
8. Test: timin/xitozin hai nhom, dao vi tri se sai o phien 3; `A, T, G va X` mot nhom; `"nhan doi"` khong tao term; roundtrip sau parser moi.

**Cam:** khong doi gradeSlots (chua matching); khong doi student UI.

**Bao cao phien 2**

- Da lam:
  - `extractBlanks` chi nhan `__tu__` / `__"tu"__`; `"tu"` thuong khong tao term (`unusedPlainQuotes`).
  - Swap group: join khi `between` khop `/^\s*([,\/\-–→]|va|hoac)?\s*$/i`; cat nhom moi 8 o; 1 thanh vien -> `swapGroupId=null`.
  - `validateDocument` bao nhom > 8; parse KP canh bao quote thuong.
  - `highlightBlanks` dung start/end; huy hieu Nhom N tren o swap.
  - Editor: canh bao quote khong wrap `__`, canh bao chu lap.
  - `lesson-detail`: badge "Can xac nhan o trong"; disable Luu khi extractBlanks chua du offset.
  - `scripts/backfill-term-offsets.mjs` (word-boundary, CSV needsReview). Khong co DATABASE_URL — script in bo qua.
  - Test: timin/xitozin 2 nhom (collapse null); `A, T, G va X` 1 nhom; `"nhan doi"` 0 term; roundtrip; backfill T khong an Trong.
- Con lai / lech ke hoach:
  - `pnpm exec tsc --noEmit` van khong chay duoc (thieu node_modules / corepack) — giong phien 1.
  - Regex join dung dung spec ASCII `va`/`hoac` (khong gom `và`/`hoặc`).
  - `uncappedSwapRunLengths` dung de validate truoc khi collapse 1-thanh-vien (van dem allowSwap).
- File da doi:
  - `lib/worksheet-parser.ts`
  - `components/teacher/worksheet-preview-doc.tsx`
  - `components/teacher/kp-content-editor.tsx`
  - `components/teacher/lesson-detail.tsx`
  - `scripts/backfill-term-offsets.mjs`
  - `scripts/check-scoring-phien2.mjs`
  - `sualogic.md`

---

### Phien 3 — Module scoring + matching + quotes (FD-04, FD-06, OP-02 mot phan, QZ-05 re)

**File duoc mo**

- `lib/scoring.ts` — tao moi (muc 4).
- `lib/grading.ts` — chuyen/re-export `normalizeAnswer`, `gradeSlots` sang scoring; giu computeOverallStatus, seed, toAnswerMap.
- `app/actions/student-learn.ts` — import van `@/lib/grading` (khong can doi neu re-export).
- `app/actions/live-quiz.ts` — chua doi gradeLiveAnswer (phien 8).
- `scripts/check-scoring-phien3.mjs`

**Viec**

1. Implement dung muc 4. Matching: DFS Kuhn, `seen` reset moi luot `tryAssign` tu root (dung nhu spec), nhom <= 8.
2. To do: sau matching cuc dai, mot value/o `isCorrect` neu ton tai max-matching gan no voi mot term. Neu hai o cung nhan cung mot dap an duy nhat, chi mot o dung.
3. `normalizeAnswer` them quotes/prime/dash. Test `5’`=`5'`, `5′`=`5'`, `tế  bào` van bang.
4. `gradeSA`: `0,5`=`0.5`=`0.50`; `1/2` khac `0.5`.
5. Test: synonyms cheo hai thu tu true; dien trung 1 dap an 2 lan false; 3 dung 1 sai chi o sai do.

**Cam:** khong doi submitQuiz; khong schema; khong Tab 3 chip.

**Bao cao phien 3**

- Da lam:
  - `lib/scoring.ts` thuan: `normalizeAnswer` (them ‘ ’ ʹ ′ ´ ` -> ' va ‐ ‑ ‒ – — − -> -), `gradeSlots` Kuhn DFS (`seen` reset moi root), `gradeMC`/`gradeTF`/`gradeSA`/`scoreLinear`.
  - Swap-group: `isCorrect` theo max-matching; o sai `correctAnswer` = text term chua ghep; trung 1 dap an 2 lan chi 1 o dung.
  - `gradeSA`: `0,5`=`0.5`=`0.50`; `1/2` khac `0.5`; khong tolerance, khong `1 500`=`1500`.
  - `lib/grading.ts` re-export scoring; giu `computeOverallStatus`, `seededRng`, `seededShuffle`, `toAnswerMap`. Import cu `@/lib/grading` khong doi.
  - Test: synonyms 2 thu tu, trung dap an, 3 dung 1 sai, 5’/5′=5', te  bao, 0,5, 1/2, TF thieu key khong `?? 'S'`.
- Con lai / lech ke hoach:
  - `pnpm exec tsc --noEmit` khong chay duoc (thieu node_modules / corepack) — giong phien 1-2.
  - `gradeLiveAnswer` chua doi (phien 8). `submitQuiz` chua dung scoring (phien 4).
- File da doi:
  - `lib/scoring.ts`
  - `lib/grading.ts`
  - `scripts/check-scoring-phien3.mjs`
  - `sualogic.md`

---

### Phien 4 — Tab 4 snapshot + TF trong (QZ-01, QZ-02)

**File duoc mo**

- `lib/db/schema.ts` — bang `quizAttemptQuestions`; cot `quizAnswers.optionId` uuid nullable.
- `lib/db/index.ts` — `ensureSchema` CREATE TABLE quiz_attempt_questions (PK attemptId+questionId; attemptId FK CASCADE; **questionId uuid khong FK**); ADD COLUMN optionId.
- `app/actions/student-learn.ts` — `startQuiz`, `submitQuiz`, `getLatestQuizResult` neu can.
- `components/student/tab4-quiz.tsx` — TF khong mac dinh Sai; y chua chon hien ro (toi thieu).
- `lib/scoring.ts` — dung gradeMC/TF/SA + scoreLinear trong submitQuiz.
- `scripts/check-scoring-phien4.mjs` — unit scoreLinear + gradeTF trong; khong can DB song song.

**Viec**

1. `startQuiz`: trong **cung luc** tao attempt, insert moi cau da chon: `{ attemptId, questionId, position, optionOrder: id[], snapshot: { type, options: {id, content, isCorrect}[] } }`. Snapshot SA: danh sach content isCorrect.
2. `submitQuiz`: load rows theo attemptId. Cau trong answers khong thuoc de -> **bo qua** (khong cong diem). Moi cau de deu ghi quiz_answers (thieu = studentAnswer null, isCorrect false). TF: moi y mot dong, optionId set; bo `?? 'S'`. Cham theo snapshot, khong theo option hien tai DB.
3. `correctSlots = min(correctSlots, totalSlots)`, `scoreLinear`.
4. UI TF: chua chon != Sai.

**Cam:** chua transaction/khoa nop (phien 7); chua reuse attempt (phien 7); khong doi selectQuizQuestions.

**Bao cao phien 4**

- Da lam:
  - Bang `quiz_attempt_questions` (PK attemptId+questionId; attemptId CASCADE; questionId **khong** FK) + cot `quiz_answers.optionId` nullable. DDL cuoi `ensureSchema`.
  - `startQuiz` insert snapshot moi cau: `{ type, options: {id, content, isCorrect}[] }` + `optionOrder`.
  - `submitQuiz` load de theo attemptId; cau ngoai de bo qua; moi cau de ghi `quiz_answers` (trong = studentAnswer null, isCorrect false). TF moi y mot dong, optionId set, bo `?? 'S'`. Cham bang `gradeMC`/`gradeTF`/`gradeSA` theo snapshot. `correctSlots = min(..., totalSlots)` + `scoreLinear`.
  - Tab 4 UI: TF chua chon hien "Chua chon", khong mac dinh Sai; ket qua TF hien "Chua chon" neu value rong.
  - Test: scoreLinear 28/28=10; 29 slot van cap 10; TF thieu y = sai.
- Con lai / lech ke hoach:
  - `pnpm exec tsc --noEmit` van khong chay duoc (thieu node_modules / corepack).
  - Chua transaction/khoa nop, chua reuse attempt (phien 7).
- File da doi:
  - `lib/db/schema.ts`
  - `lib/db/index.ts`
  - `app/actions/student-learn.ts`
  - `components/student/tab4-quiz.tsx`
  - `scripts/check-scoring-phien4.mjs`
  - `sualogic.md`

---

### Phien 5 — Chip id + an dap an Tab 2/3 (FD-03, FD-08)

**File duoc mo**

- `app/actions/student-learn.ts` — `getTab2Questions`, `getTab3Questions`, `submitTab2Question`, `submitTab3Question`.
- `components/student/tab2-fill-in.tsx`
- `components/student/tab3-drag-drop.tsx`
- `lib/slot-render.ts` — export type parts khong term.text neu can dung server.
- `lib/db/schema.ts` + `ensureSchema` — cot `fillRevealed`, `dragRevealed` boolean default false tren student_progress.
- `scripts/check-scoring-phien5.mjs` — helper dung chip / parts (neu tach ham thuan).

**Viec**

1. Server dung `parts`: `{type:'text', value} | {type:'slot', slotIndex, groupId}`. **Khong** gui `content` tho, **khong** gui `terms[].text` / synonyms. Tab 3 van gui `chips: {id, text}[]`.
2. Chip id: `${kpId}:${index}` sau shuffle. Distractor: loai neu `normalizeAnswer(d)` trung text/synonyms/extraAccepted cua cau; loai trung giua distractor.
3. Client Tab 3: `placement: Record<slotIndex, chipId | null>`; `placeChip` go o dang giu **cung chipId**; dnd-kit id = chip.id; available = chip chua nam o. Cham: `answers[slotIndex]=chip.text`. Draft localStorage luu chipId; id khong con -> bo nhap.
4. Submit 2/3: chi tra `isCorrect` theo o. Them `hint` / `correctAnswer` theo `fillAttempts`/`dragAttempts` **sau** khi tang (Tab 2: hint chu dau tu lan sai 1, dap an tu lan sai 3; Tab 3: chi dung/sai lan 1, dap an tu lan 2). Hang so `REVEAL_FILL_AT = 3`, `REVEAL_DRAG_AT = 2`. Khi tra correctAnswer, set `fillRevealed`/`dragRevealed` true.
5. Rate limit: neu `updatedAt` cung KP < 6s va attempts vua tang (>10/phut xap xi: tu choi neu 10 lan trong 60s). Cach don gian chap nhan: dem fillAttempts/dragAttempts khong du; dung `updatedAt` + neu last grade < 6000ms va attempts%10===0 thi van cho... **Chot don gian:** luu khong can cot moi — tu choi neu `Date.now() - updatedAt < 6000` **sai** (qua chat). Dung: them khong. Rate 10/phut: neu `updatedAt` trong 60s va attempts da tang >=10 trong cua so — **khong co cua so**. Implement: tu choi neu `now - progress.updatedAt < 6000` CHI khi attempts>0 **bo**. Spec da chot 10/phut: dung Map in-memory `gradeBurst: key studentId:kpId -> timestamps[]` tren module action (1 process). Loc timestamp < now-60000; neu length>=10 throw "Thu cham cham lai". Khong dung 1s.
6. Tab 2 UI: hint chi tu field server, xoa `ans.charAt(0)` client.
7. Da `correct`: tra ket qua, **khong** tang attempts.

**Cam:** khong doi FD-09 flow; Tab 3 eligible van `unknown || fill incorrect` cho toi phien 6 (chot B o phien 6).

**Bao cao phien 5**

- Da lam:
  - `getTab2/3` gui `parts` (`text` | `slotIndex`+`groupId`), khong `content` tho, khong `terms[].text`/synonyms. Tab 3 `chips: {id, text}[]` id=`${kpId}:${index}` sau shuffle.
  - Distractor loai neu `normalizeAnswer` trung text/synonyms/extraAccepted hoac trung nhau.
  - Tab 3 client: `placement` luu chipId; `placeChip` go o dang giu cung chipId; dnd-kit id = chip.id; draft bo chipId khong con.
  - Submit 2/3 chi tra `isCorrect`; hint/dap an theo attempts sau khi tang (`REVEAL_FILL_AT=3`, `REVEAL_DRAG_AT=2`). Set `fillRevealed`/`dragRevealed`. Da `correct` khong tang attempts.
  - Rate-limit Map in-memory 10/60s/HS/KP, throw "Thử chấm chậm lại". Tab 2 hint chi tu server.
  - Test: parts khong lo text term; distractor; chip id; fill hint lan 1 / dap an lan 3; drag an lan 1 / lo lan 2.
- Con lai / lech ke hoach:
  - `pnpm exec tsc --noEmit` van khong chay duoc (thieu node_modules / corepack) — giong phien 1-4.
  - Tab 3 eligible van `unknown || fill incorrect` (phien 6).
- File da doi:
  - `lib/slot-render.ts`
  - `lib/db/schema.ts`
  - `lib/db/index.ts`
  - `app/actions/student-learn.ts`
  - `components/student/tab2-fill-in.tsx`
  - `components/student/tab3-drag-drop.tsx`
  - `scripts/check-scoring-phien5.mjs`
  - `sualogic.md`

---

### Phien 6 — Quyen + ST-01 + live thoi gian/lop (FD-07, ST-01, LV-01, LV-02)

**File duoc mo**

- `app/actions/student-learn.ts` — submitTab1/2/3, resolveStudyStage, getTab3Questions.
- `lib/assignment-status.ts`
- `app/actions/assignments.ts` — cho derive status ~255-279.
- `app/actions/class-stats.ts` — cho completed/touched (~276-290, 372-395) neu dung cung cong thuc.
- `app/actions/live-quiz.ts` — submitLiveAnswer, joinQuiz (cache Set).
- `lib/live-session-state.ts` — them `classStudentIds?: Set<string>` neu can.
- `scripts/check-scoring-phien6.mjs` — unit deriveStudentAssignmentStatus.

**Viec**

1. `submitTab2/3`: nạp KP -> lessonId -> `assertLessonAccess`. Bat buoc da co dong tab1 submission. Tab 2: `selfAssessment==='known' && fillStatus!=='correct'`. Tab 3: **`selfAssessment==='unknown' && dragStatus!=='correct'`** (phuong an B — doi getTab3Questions va resolveStudyStage: bo `fill==='incorrect'`). answers: key phai la slotIndex cua KP, string <=200, key la tu choi.
2. `submitTab1`: moi key assessments phai la KP cua lessonId; value known|unknown; phai du moi KP (thieu -> error liet ke).
3. ST-01: `completed` khi va chi khi co quiz attempt `completedAt > submittedAt` (cung nghia stage done). `in_progress` khi da nop Tab 1. `progressPercent` theo buoc (tab1 25, het tab2 50, het tab3 75, nop tab4 100) — neu khong lay du stage thi: 0 / 50 (da tab1 chua quiz) / 100 (quiz xong sau tab1). `hasCompletedQuiz` **phai** loc `completedAt > submittedAt`. Doi `deriveStudentAssignmentStatus` input: bo logic `touchedKp >= totalKp` lam completed.
4. LV-01: `elapsed = Date.now() - questionStartedAt`; neu `timeLimitSec` va `elapsed > timeLimitSec*1000+1500` throw "Da het thoi gian". Khong auto reveal.
5. LV-02: kiem HS thuoc lop (cache Set luc join, miss -> query nhu joinQuiz). MC answer phai la optionId cua cau. TF moi id trong chuoi thuoc cau. SA <=200 ky tu.

**Cam:** khong bang live_answers (phien 8); khong Redis.

**Bao cao phien 6**

- Da lam:
  - `submitTab2/3`: `assertLessonAccess` qua lessonId cua KP; bat buoc da nop Tab 1; Tab 2 chi `sa=known && fill!==correct`; Tab 3 chi `sa=unknown && drag!==correct`. answers key phai la slotIndex, string <=200.
  - `getTab3Questions` + `resolveStudyStage`: phuong an B, bo `fill==='incorrect'`.
  - `submitTab1`: moi key phai la KP cua lesson; value known|unknown; thieu liet ke kpId.
  - ST-01: `completed` chi khi quiz `completedAt > submittedAt`; `in_progress` khi da nop Tab 1; progress 0/50/100. `deriveStudentAssignmentStatus` bo `touchedKp >= totalKp`.
  - LV-01: het gio `elapsed > timeLimitSec*1000+1500` throw "Da het thoi gian".
  - LV-02: cache `classStudentIds` luc join/init, miss query; MC optionId cua cau; TF id thuoc cau; SA <=200.
- Con lai / lech ke hoach:
  - `pnpm exec tsc --noEmit` van khong chay duoc (thieu node_modules / corepack).
  - Script class cu (`check-class-phien1/3/6.mjs`) van goi chu ky cu — ngoai pham vi phien 6.
- File da doi:
  - `app/actions/student-learn.ts`
  - `lib/assignment-status.ts`
  - `app/actions/assignments.ts`
  - `app/actions/class-stats.ts`
  - `app/actions/live-quiz.ts`
  - `lib/live-session-state.ts`
  - `scripts/check-scoring-phien6.mjs`
  - `sualogic.md`

---

### Phien 7 — Toan ven DB quiz + Tab 1 + reset (QZ-03, QZ-04, FD-10, FD-11)

**File duoc mo**

- `lib/db/schema.ts` — unique tab1; unique quiz_answers.
- `lib/db/index.ts` — ensureSchema: xoa trung tab1 (giu submittedAt moi nhat) roi unique; unique partial quiz_answers.
- `app/actions/student-learn.ts` — submitQuiz transaction; startQuiz reuse; submitTab1 upsert; submitTab2/3 transaction upsert; resetLessonProgress.
- `scripts/check-scoring-phien7.mjs` — khong bat buoc stress 20 request; unit reset overallStatus + score cap.

**Viec**

1. Unique `student_tab1_submissions (studentId, lessonId)`. Insert `onConflictDoNothing` = da nop.
2. `submitTab1`: 1 lan load progress, 1 `insert onConflict do update` selfAssessment+overallStatus. Khong vong N query.
3. `submitTab2/3`: `insert onConflict do nothing` dong rong, `select for update` neu driver cho phep (drizzle `for('update')`); update attempts SQL +1. Neu for update kho: van transaction + onConflict.
4. `submitQuiz`: mot `db.transaction`. Khoa: `update quiz_attempts set completedAt, score where id=? and studentId=? and completedAt is null returning id`. Khong row -> "Bai kiem tra da nop". Insert answers. Seed spaced_repetition **mot** insert onConflict do nothing. Unique answers: unique index `(attemptId, questionId)` WHERE optionId IS NULL, va `(attemptId, questionId, optionId)` WHERE optionId IS NOT NULL.
5. `startQuiz`: tim attempt `completedAt is null` cua (HS, lesson) voi `startedAt > submittedAt` (neu co submission). Co thi tra de tu `quiz_attempt_questions` + snapshot (khong tao moi). Khong thi tao nhu phien 4.
6. `resetLessonProgress`: `overallStatus` = CASE selfAssessment known->known, unknown->unknown, else not_started. Xoa fill/drag/attempts/revealed. Comment: giu lich su quiz_attempts.

**Cam:** khong QZ-07 option id (phien 8); khong live_answers.

**Bao cao phien 7**

- Da lam:
  - Unique `student_tab1_submissions (studentId, lessonId)` (`s1_student_lesson_unique`); ensureSchema xoa trung (giu submittedAt moi nhat) roi ADD CONSTRAINT IF NOT EXISTS.
  - Unique partial `quiz_answers`: `(attemptId, questionId) WHERE optionId IS NULL` va `(attemptId, questionId, optionId) WHERE optionId IS NOT NULL`.
  - `submitTab1`: insert onConflictDoNothing = da nop; 1 lan load progress, 1 insert onConflictDoUpdate selfAssessment+overallStatus (khong vong N query).
  - `submitTab2/3`: transaction, insert onConflictDoNothing dong rong, `select for update`, attempts SQL +1.
  - `submitQuiz`: mot `db.transaction`; khoa `update ... completedAt, score where id=? and studentId=? and completedAt is null returning id`; khong row -> "Bai kiem tra da nop". Insert answers. Seed spaced_repetition mot insert onConflictDoNothing.
  - `startQuiz`: reuse attempt `completedAt is null` cua (HS, lesson) voi `startedAt > submittedAt`; tra de tu `quiz_attempt_questions` + snapshot. Khong thi tao nhu phien 4.
  - `resetLessonProgress`: overallStatus CASE SA known/unknown/not_started; xoa fill/drag/attempts/revealed; giu lich su quiz_attempts.
  - Test: computeOverallStatus sau reset theo SA; score cap 10; doi chieu nguon submitQuiz/unique/reset.
  - Fix: `submitQuiz` dung `openAttempt.totalSlots` (truoc do `attempt` chua khai bao).
- Con lai / lech ke hoach:
  - `pnpm exec tsc --noEmit` van co the khong chay duoc neu thieu node_modules / corepack.
  - QZ-07 option id va live_answers chua doi (phien 8).
- File da doi:
  - `lib/db/schema.ts`
  - `lib/db/index.ts`
  - `app/actions/student-learn.ts`
  - `scripts/check-scoring-phien7.mjs`
  - `sualogic.md`

---

### Phien 8 — Live persist + scoring chung + option id + firstTry (LV-03, LV-04, QZ-07, thong ke nhe)

**File duoc mo**

- `lib/db/schema.ts` — `live_answers`; cot fillFirstTry, dragFirstTry text nullable tren student_progress.
- `lib/db/index.ts` — CREATE live_answers PK (sessionId, questionId, studentId, round); questionId **khong** CASCADE bat buoc (uuid, FK session + student du). ADD firstTry.
- `app/actions/live-quiz.ts` — submit, goToQuestion, ensureLiveState restore answers.
- `lib/live-session-state.ts`
- `lib/scoring.ts` — gradeLive dung gradeMC/TF/SA (TF theo tung y: dung het y moi `correct=true` cho live 1 cau; per-y khong hien HS).
- `app/actions/questions.ts` — `updateQuestion` giu option id; `validateOptions` MC 4/1, TF 4 (giong import).
- `app/actions/student-learn.ts` — ghi fillFirstTry/dragFirstTry **mot lan** luc cham dau chu ky (attempts tu 0).
- `app/actions/class-stats.ts` — `overconfident = known && fillFirstTry==='incorrect'` (fallback fillAttempts>1 neu firstTry null).
- `scripts/check-scoring-phien8.mjs`

**Viec**

1. `goToQuestion`: tang `round` per question (map tren state). Khong xoa DB. RAM clear roi load lai answers round hien tai.
2. `submitLiveAnswer`: insert live_answers ON CONFLICT DO NOTHING -> "Ban da tra loi". Cham bang scoring.ts. TF live: `correct` khi moi y dung (linear all-or-nothing o **cau**, khong ?? S).
3. `ensureLiveState`: sau restore snapshot, doc live_answers cau hien tai vao `state.answers`.
4. `updateQuestion`: update option theo id; option moi insert; id client khong gui thi xoa. Khong delete-all insert-all.
5. validateOptions: MC length===4 va dung 1; TF length===4. createQuestion dung cung ham.
6. firstTry: neu fillFirstTry null va day la lan cham fill (ke ca sau reset attempts=0), set correct/incorrect. Backfill SQL trong ensureSchema: incorrect neu fillStatus incorrect HOAC (correct va fillAttempts>1); correct neu correct va attempts=1.
7. Test: gradeLive TF/SA trung Tab 4; firstTry cong thuc.

**Cam:** Redis; QZ-06; QZ-08; xoa bang.

**Bao cao phien 8**

- Da lam:
  - Bang `live_answers` PK (sessionId, questionId, studentId, round); questionId **khong** FK; session + student CASCADE. Cot `fillFirstTry`/`dragFirstTry` + backfill SQL trong `ensureSchema`.
  - `gradeLive` dung `gradeMC`/`gradeTF`/`gradeSA`; TF live all-or-nothing o cau (dung het y).
  - `goToQuestion` tang `round` per question, khong xoa DB; RAM clear roi load `live_answers` round hien tai. Snapshot luu `rounds`.
  - `submitLiveAnswer` insert ON CONFLICT DO NOTHING -> "Bạn đã trả lời"; cham bang scoring.ts.
  - `ensureLiveState` restore answers cau hien tai tu DB (va max round neu snapshot thieu).
  - `updateQuestion` update option theo id; option moi insert; id khong gui thi xoa. Khong delete-all insert-all.
  - `validateOptions`: MC length===4 va dung 1; TF length===4. `createQuestion` dung cung ham.
  - `fillFirstTry`/`dragFirstTry` ghi mot lan luc cham dau chu ky (`resolveFirstTry`); reset xoa de chu ky moi.
  - `overconfident = known && fillFirstTry==='incorrect'` (fallback `fillAttempts>1` neu firstTry null).
  - Test: gradeLive TF/SA trung Tab 4 all-correct; firstTry cong thuc; doi chieu nguon DDL/live/questions.
- Con lai / lech ke hoach:
  - UI soan cau (`question-form-dialog`) chua gui `option.id` — ngoai file duoc mo. Server giu id khi client gui; UI hien tai van insert moi khi sua.
  - Live TF wire chi gui id "Dung" (giao thuc cu); unpicked = Sai. UI bat chon het y truoc khi nop.
  - `pnpm exec tsc --noEmit` co the khong chay duoc neu thieu node_modules / corepack.
- File da doi:
  - `lib/db/schema.ts`
  - `lib/db/index.ts`
  - `lib/scoring.ts`
  - `lib/grading.ts`
  - `lib/live-session-state.ts`
  - `app/actions/live-quiz.ts`
  - `app/actions/questions.ts`
  - `app/actions/student-learn.ts`
  - `app/actions/class-stats.ts`
  - `scripts/check-scoring-phien8.mjs`
  - `sualogic.md`

---

## 7. DDL gon (copy vao ensureSchema theo phien)

Phien 4:

```sql
CREATE TABLE IF NOT EXISTS quiz_attempt_questions (
  "attemptId" uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  "questionId" uuid NOT NULL,
  position integer NOT NULL,
  "optionOrder" jsonb,
  snapshot jsonb NOT NULL,
  PRIMARY KEY ("attemptId", "questionId")
);
ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS "optionId" uuid;
```

Phien 5:

```sql
ALTER TABLE student_progress
  ADD COLUMN IF NOT EXISTS "fillRevealed" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dragRevealed" boolean NOT NULL DEFAULT false;
```

Phien 7:

```sql
DELETE FROM student_tab1_submissions a USING student_tab1_submissions b
 WHERE a."studentId"=b."studentId" AND a."lessonId"=b."lessonId"
   AND (a."submittedAt", a.id) < (b."submittedAt", b.id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='s1_student_lesson_unique') THEN
    ALTER TABLE student_tab1_submissions ADD CONSTRAINT s1_student_lesson_unique UNIQUE ("studentId","lessonId");
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS quiz_answers_mc_sa_uidx ON quiz_answers ("attemptId","questionId") WHERE "optionId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS quiz_answers_tf_uidx ON quiz_answers ("attemptId","questionId","optionId") WHERE "optionId" IS NOT NULL;
```

Phien 8:

```sql
CREATE TABLE IF NOT EXISTS live_answers (
  "sessionId" uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  "questionId" uuid NOT NULL,
  "studentId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  round integer NOT NULL DEFAULT 1,
  answer text,
  "isCorrect" boolean NOT NULL,
  "answeredAt" timestamp NOT NULL DEFAULT now(),
  "responseMs" integer,
  PRIMARY KEY ("sessionId","questionId","studentId", round)
);
ALTER TABLE student_progress
  ADD COLUMN IF NOT EXISTS "fillFirstTry" text,
  ADD COLUMN IF NOT EXISTS "dragFirstTry" text;
UPDATE student_progress SET "fillFirstTry"='incorrect'
 WHERE "fillFirstTry" IS NULL AND ("fillStatus"='incorrect' OR ("fillStatus"='correct' AND "fillAttempts">1));
UPDATE student_progress SET "fillFirstTry"='correct'
 WHERE "fillFirstTry" IS NULL AND "fillStatus"='correct' AND "fillAttempts"=1;
-- tuong tu dragFirstTry / dragStatus / dragAttempts
```

---

## 8. Test toi thieu theo phien (node --experimental-strip-types)

Import ham tu `lib/*.ts` nhu `scripts/check-parser-phien8.mjs`. `process.exit(1)` neu that bai.

| Phien | Ca | Ky vong |
| --- | --- | --- |
| 1 | 3 vi du T / nucleotit / ADN; space dau; roundtrip | o dung cho da danh dau |
| 2 | timin vs xitozin 2 nhom; A, T, G va X 1 nhom; "nhan doi" 0 term | dung |
| 3 | synonyms 2 thu tu; trung dap an; 5’=5'; 0,5=0.5; 1/2!=0.5 | dung |
| 4 | scoreLinear 28/28=10; 29 slot dung van cap 10; TF thieu y = sai | dung |
| 5 | (neu tach ham) parts khong chua text term | dung |
| 6 | derive: chi tab1 -> in_progress; quiz sau submittedAt -> completed | dung |
| 7 | computeOverallStatus sau reset theo SA | known/unknown khong not_started |
| 8 | gradeTF live vs tab4 cung input | khop all-correct |

---

## 9. Quy tac git moi phien

1. Sua code + test + dien "Bao cao phien N" va bang muc 5.
2. `pnpm exec tsc --noEmit`
3. `git add` dung file phien + `sualogic.md`
4. `git commit -m "wip(scoring): phien N - <tom tat>"`

Khong commit `.env`, khong force push. Khong sua `suaui.md` / spec goc tru khi phien ghi ro.

---

## 10. Phiên bổ sung (sau phiên 8) — và/hoặc có dấu, vị trí dấu thanh, ký hiệu

Ngày: 2026-10-20. Nguồn: báo cáo lỗi chấm sai từ dữ liệu thật, đã tái hiện
bằng script trước khi sửa (43/43 ca khớp). Phiên này THAY ĐỔI hai ghi chú cũ:
(1) ghi chú phiên 2 "Regex join dùng đúng spec ASCII va/hoac (không gồm
và/hoặc)" — spec đó sai so với văn bản thật; (2) phạm vi `normalizeAnswer`
ở mục 1.2/4 được mở rộng như liệt kê dưới đây. Các quyết định khác của
mục 1 giữ nguyên, đặc biệt: KHÔNG bỏ dấu tiếng Việt, `0,5` vẫn xử lý ở
`gradeSA`, `1/2` ≠ `0.5`, matching swap-group giữ nguyên.

### 10.1 Nhóm hoán đổi: `và` / `hoặc` có dấu

- `SWAP_GROUP_JOIN_RE` (lib/worksheet-parser.ts) nay là
  `/^\s*(?:(?:[,\/\-–→]|và|hoặc|va|hoac)\s*)*$/i`: chuỗi nối chỉ gồm khoảng
  trắng, dấu nối và từ nối, cho phép tổ hợp ", và " / " và, ".
- Vẫn tách nhóm khi có chữ xen khác (" bổ sung với " — ca timin/xitozin
  phiên 2 giữ nguyên) hoặc dấu ngắt câu `. ! ? ;`.
- Test phiên 2 ở cuối file (timin và xitozin) đã cập nhật kỳ vọng: có dấu
  thì gộp nhóm `g1`.
- Dữ liệu đã import: `swapGroupId` lưu cứng trong `underlinedTerms`, sửa
  code không tự sửa dữ liệu cũ. Chạy
  `DATABASE_URL=... node scripts/backfill-swap-groups.mjs` để tính lại
  nhóm từ content + offset đã lưu (KP thiếu/lệch offset -> CSV
  needsReview, không đoán), hoặc import lại bài.

### 10.2 `normalizeAnswer`: vị trí dấu thanh + ký hiệu (lib/scoring.ts)

- Vị trí dấu thanh: thêm `canonicalizeTonePlacement` — tách NFD, di
  chuyển DUY NHẤT dấu thanh (huyền/sắc/hỏi/ngã/nặng) giữa hai nguyên âm
  của âm đôi oa/oe/uy: âm tiết mở -> nguyên âm thứ nhất (hoá->hóa,
  thuỷ->thủy, khoẻ->khỏe), âm tiết đóng -> nguyên âm thứ hai (hoàn,
  hoán, huỳnh; "hòan" cũng được đưa về "hoàn"). Ngoại lệ: "quý/quỵ"
  (u thuộc âm đầu qu) không di chuyển. Dấu chất nguyên âm (â ă ê ô ơ ư)
  không đổi nên `nucleotit` ≠ `nuclêôtit` như đã chốt.
- Ký hiệu: `->` -> `→` (trước bước đổi dash); chỉ số dưới/trên
  (₀-₉, ⁰-⁹, ₋ ⁻ ₊ ⁺) -> ký tự thường; bỏ khoảng trắng quanh `-` và
  `→` (`A - T` = `A-T`); bỏ khoảng trắng trước `%` (`50 %` = `50%`);
  bóc ngoặc đơn khi bọc toàn bộ đáp án (`(DNA)` = `DNA`).

### 10.3 Lệch client/server khi renderSlots rơi xuống legacy

- `renderSlots` (lib/slot-render.ts): legacy tìm thiếu ô -> `console.error
  "renderSlots legacy missing slots"` kèm danh sách slotIndex bị mất;
  legacy tìm đủ ô vẫn `console.warn` như cũ.
- Tab 2 (tab2-fill-in.tsx) và Tab 3 (tab3-drag-drop.tsx): nút qua câu
  dùng `allCorrect` do server trả (lưu vào state + draft), không tự tính
  chỉ theo các ô có trong parts. Draft cũ không có field này thì xét mọi
  kết quả server đã trả.

### 10.4 Nghiệm thu

- Test mới: `node --experimental-strip-types scripts/check-scoring-bo-sung.mjs`
  in `bo sung OK`.
- Toàn bộ scripts/check-*.mjs cũ vẫn PASS (trừ kỳ vọng phiên 2 đã cập
  nhật ở 10.1). `pnpm exec tsc --noEmit` cần chạy ở máy có node_modules.

---

## 11. Phiên batch 2 (2026-10-21) — sửa theo spec BUG-01..15

Ngày: 2026-10-21. Nguồn: spec `Spec_s_a_l_i_ch_m_sai_v__l_i_t_o_c_u_h_i_-_ontapsinhhoc2026.md`
(BUG-01..15), đã đối chiếu code thật và tái hiện trước khi sửa. Chi tiết
triển khai + dữ liệu cũ: `FIX-2026-10-21.md`. Các quyết định ở mục 1 và
mục 10 giữ nguyên, TRỪ thay đổi được ghi rõ ở 11.5 (BUG-05 yêu cầu 3).

### 11.1 BUG-01 — ô mất khỏi màn hình, học sinh kẹt (P0)

- `lib/slot-render.ts` thêm `prepareKpTermsForSave(content, terms)`:
  chuẩn hóa content + `term.text` về NFC, tính lại `end = start +
  text.length`, kiểm tra `content.slice(start, end) === text` cho mọi
  term; lệch -> ném lỗi rõ ràng. Dùng ở MỌI đường lưu KP:
  `app/actions/content.ts` (`createKnowledgePoint`,
  `updateKnowledgePoint`) và `lib/worksheet-import.ts` (import). Server
  không còn tin hoàn toàn `underlinedTerms` do client gửi (gộp BUG-12).
- `getTab2Questions` / `getTab3Questions`: dựng `renderClientSlots` cho
  từng KP; số ô dựng được != số term (`slotRenderMismatch`) -> LOẠI KP
  khỏi danh sách trả cho học sinh + `console.error` kèm `kpId`.
- Client Tab 2/Tab 3: `slots.length === 0` -> hiển thị thông báo lỗi dữ
  liệu, không render nút Kiểm tra.
- `console.error "renderSlots legacy missing slots"` (mục 10) giữ làm
  tín hiệu giám sát.

### 11.2 BUG-02 — import mất liên kết câu hỏi <-> KP (P0)

- `persistParseResult` bọc trong MỘT `db.transaction`.
- Insert KP có `.returning({ id })`; câu hỏi gán
  `knowledgePointId = kpRow.id` (trước: cứng `null`).
- Dữ liệu đã import trước đây: KHÔNG tự suy KP cho câu cũ. Giáo viên
  import lại bài cần thiết hoặc gán tay (quyết định triển khai, xem
  FIX-2026-10-21.md).

### 11.3 BUG-03 — file mẫu dạy cú pháp đã bỏ (P0)

- `public/templates/mau-cau-hoi.txt` + `scripts/gen-docx-template.mjs`
  (đã sinh lại `.docx`): chuyển sang `__"từ"__`, ghi rõ ngoặc kép thường
  KHÔNG tạo ô; ô hoán đổi chỉ hoạt động khi các ô `__"từ"__` đứng liền
  nhau trong cùng câu; thêm hướng dẫn `dap an: x | y` cho SA (BUG-08).
- Test mới `scripts/check-template.mjs`: parse cả hai file mẫu ->
  `isValid = true`, mọi KP >= 1 ô.

### 11.4 BUG-04 — nhóm hoán đổi với nhãn lặp (P1)

- `computeSwapRuns(content, terms, { swapOnly })` (parser, export):
  hai ô kề nhau gộp nhóm khi chuỗi giữa chúng khớp SWAP_GROUP_JOIN_RE
  (đã NFC trước khi xét) HOẶC phần còn lại sau khi bỏ dấu nối/và/hoặc là
  nhãn ngắn (<= 3 từ) VÀ nhãn đó cũng đứng ngay trước ô đầu tiên của run
  (vd `là vùng __"điều hòa"__, vùng __"mã hóa"__`). `assignSwapGroupIds`
  dùng chung cho `extractBlanks` và backfill — một nguồn sự thật.
- Cảnh báo (không chặn): `validateDocument` trả thêm `warnings` —
  (a) nhóm được gộp nhờ nhãn lặp (giáo viên rà soát danh sách thứ tự cố
  định dùng chung nhãn, vd các giai đoạn nguyên phân); (b) danh sách có
  nhãn lặp trông hoán đổi được nhưng ô chưa bật hoán đổi. Cả hai cũng
  hiện trong `kp-content-editor`; importer hiện warnings ở khối riêng.
- `scripts/backfill-swap-groups.mjs`: bỏ bản chép tay regex, import
  `assignSwapGroupIds` từ parser; thêm `--dry-run` (không ghi DB, vẫn
  xuất CSV needsReview).

### 11.5 BUG-05 — ký hiệu/số còn thiếu (P1) — CÓ THAY ĐỔI QUYẾT ĐỊNH

- `normalizeAnswer`: bỏ khoảng trắng quanh `= ≡ + : / ×` (bổ sung vào
  bước cũ cho `-`, `→`); `x` đứng độc lập giữa hai khoảng trắng với hai
  vế kề là token chữ/số (công thức) -> `×`. Đối chứng giữ nguyên: `x`
  trong từ (xitozin), `x` đầu/cuối câu không đổi.
- **THAY ĐỔI QUYẾT ĐỊNH CŨ:** mục 1.2/4 từng chốt "`0,5` xử lý ở
  `gradeSA`, không nhét vào normalize chuỗi" — cho SA vẫn đúng, nhưng
  nay `accepts` (điền khuyết Tab 2/3) cũng so sánh theo GIÁ TRỊ khi cả
  hai vế là số thuần qua `parsePureNumber` (`0,5` = `0.5` ở điền
  khuyết). Lý do: học sinh điền khuyết gõ `0.5` cho đáp án `0,5` bị
  chấm sai oan giống hệt ca SA đã xử lý ở phiên 3.
- Các chốt liên quan VẪN GIỮ và có test đối chứng bắt buộc trong
  `check-scoring-bo-sung.mjs` mục 6: `1/2` != `0.5` (parsePureNumber từ
  chối phân số), `1 500` != `1500` (từ chối số có khoảng trắng),
  `nucleotit` != `nuclêôtit` (không bỏ dấu).

### 11.6 BUG-06 — dãy gạch dưới dài thành ô rác (P1)

- `extractBlanks`: delimiter phải là đúng `__` không dính thêm gạch
  dưới (lookaround `(?<!_)__(?!_)` ở cả hai đầu) và nội dung chỉ gồm
  gạch dưới/khoảng trắng thì không tạo term. Dãy `_{3,}` ở lại nguyên
  trong content.
- `validateDocument`: KP còn `__` hoặc `_{3,}` trong content -> LỖI,
  thông báo ghi rõ dòng + hướng dẫn viết `__đáp án__`.
- `________` trong ĐỀ câu hỏi MC/TF/SA vẫn được phép (cách viết đề bình
  thường) và không biến thành ô điền khuyết.

### 11.7 BUG-07 — cắt sai option khi nội dung chứa mẫu `B.` (P1)

- `splitChoiceBlock` viết lại, thứ tự ưu tiên: (1) tách theo ĐẦU DÒNG —
  dòng bắt đầu bằng nhãn kế tiếp theo đúng thứ tự mới mở phương án mới;
  (2) khối gộp một dòng: chọn LÙI từ chữ cái cuối (ứng viên nhái trong
  nội dung phương án trước luôn đứng trước nhãn thật của phương án sau);
  (3) dự phòng thuật toán quét tiến cũ khi hai cách trên không đủ chữ.
- `validateDocument` cảnh báo khi nội dung một phương án chứa mẫu giống
  nhãn (`B.`, `c)`...) để giáo viên rà soát việc tách.

### 11.8 BUG-08 — đáp án SA dạng `x | y` (P1)

- `splitSaAcceptedAnswers` (parser): tách `correctAnswer` theo `|`
  (trim, bỏ rỗng, bỏ trùng). Import SA tạo MỘT `questionOptions`
  isCorrect cho mỗi vế; `gradeSA`/snapshot đã nhận danh sách accepted
  nên chấm đúng ngay, không cần đổi schema.
- Ghi chú: trong ô điền khuyết, `|` vẫn là cú pháp synonyms (quyết định
  cũ); đáp án chứa ký tự `|` theo nghĩa đen chưa có cú pháp thoát —
  chấp nhận giữ nguyên, giáo viên tránh dùng `|` trong đáp án điền
  khuyết ngoài nghĩa synonyms.

### 11.9 BUG-09 — gạch chân nhấn mạnh trong option (P2, LÀM MẠNH HƠN SPEC)

- Spec chỉ yêu cầu cảnh báo preview; quyết định đã chốt: CHẶN CỨNG ở
  `validateDocument` khi phần gạch chân chỉ bao MỘT PHẦN của option
  MC/TF (parser đánh dấu `ParsedOption.underlinePartial` từ
  `splitChoiceBlock`). Gạch chân bao trọn option (hoặc trọn phần nội
  dung sau nhãn) vẫn là cơ chế chỉ định đáp án hợp lệ như hiện nay.
- Hệ quả đã được chủ sản phẩm xác nhận: một câu lỗi trong file import
  thì TOÀN BỘ file bị từ chối tới khi giáo viên sửa (persistParseResult
  vốn all-or-nothing theo BUG-02, không mất dữ liệu đã lưu).

### 11.10 BUG-10..13, 15

- BUG-10: `submitQuiz` chấm SA bằng đáp án ĐẦY ĐỦ; chỉ cắt 200 ký tự
  khi lưu `studentAnswer`.
- BUG-11 (ĐÃ XÁC MINH trong `app/actions/student-learn.ts`): nhánh mở
  lại attempt lấy `content` từ DB hiện tại còn options từ snapshot;
  câu bị xóa -> stem rỗng `""`. Đã sửa: snapshot lưu thêm `stem` +
  `bodyHtml` lúc tạo đề; mở lại ưu tiên `snap.stem`, fallback DB cho
  snapshot cũ. Chấm vẫn theo snapshot như phiên 4.
- BUG-12: phần "server tin client" đã gộp vào BUG-01 (11.1). Phần
  "reset tiến độ khi sửa KP": chính sách đã CHỐT ngày 21/10/2026
  (chọn RESET khi nội dung chấm thay đổi) và đã cài đặt — xem mục 13.2.
- BUG-13: Tab 2 `onKeyDown` bỏ qua sự kiện khi
  `e.nativeEvent.isComposing` (đang gõ Telex/VNI).
- BUG-15: `validateOptions` (app/actions/questions.ts) chặn option
  MC/TF rỗng (không nội dung và không bodyHtml); `updateQuestion` giữ
  nguyên `difficulty` hiện tại khi client không gửi. Transaction của
  import ở BUG-02; `--dry-run` backfill ở BUG-04.

### 11.11 BUG-14 — ĐÃ DUYỆT, cài đặt ở mục 13.1

Bảng alias thuật ngữ: chủ sản phẩm đã duyệt đúng 4 cặp (gene/gen,
ADN/DNA, ARN/RNA, mARN/mRNA) ngày 21/10/2026 và đã cài đặt áp dụng
vào chấm điểm — xem mục 13.1.

### 11.12 Vá bảo mật Next.js

`next` 16.2.6 -> 16.4.1 bằng `pnpm add next@16.4.1` (package.json +
pnpm-lock.yaml đồng bộ). Không đổi code.

### 11.13 Nghiệm thu batch 2

- Test mới: `scripts/check-parser-batch2.mjs` (BUG-04/06/07/09 + câu
  kiểm chứng tổng hợp gene cấu trúc: đúng thứ tự, đảo thứ tự, `điều
  hoà` dấu kiểu cũ đều `allCorrect`), `scripts/check-import-batch2.mjs`
  (BUG-01/02/08/10/11/13/15), `scripts/check-template.mjs` (BUG-03),
  mở rộng `scripts/check-scoring-bo-sung.mjs` mục 6 (BUG-05).
- Toàn bộ `scripts/check-*.mjs`: 24/31 PASS; 7 FAIL là các script cũ
  đã fail từ bản gốc __10 (check-class-phien1/2/3/6,
  check-parser-phien6/8, check-preview-phien3) — không tăng thêm.
- `npx tsc --noEmit`: sạch trước và sau (baseline 2026-10-21 vốn đã
  sạch khi có node_modules).

## 12. Bảo mật (2026-10-21) — sửa theo spec SEC-01..12

Quyết định cho từng mục SEC (chi tiết triển khai: `FIX-SEC-2026-10-21.md`):

### 12.1 SEC-01 — khóa đường tự cấp quyền giáo viên [ĐÃ SỬA]

- `lib/auth.ts`: `role` để `input: false`; thêm `databaseHooks.user.create.before`
  ép mọi tài khoản mới về `role = "student"` bất kể client gửi gì. Form
  đăng ký bỏ hẳn bộ chọn vai trò và không gửi `role` nữa.
- `completeOnboarding(role, inviteCode?)` (`app/actions/onboarding.ts`):
  whitelist vai trò {"student","teacher"}; chỉ chạy khi `isOnboarded = false`;
  gọi lại sau khi đã onboard bị từ chối (hết đường tự đổi vai trò).
- Cấp quyền giáo viên: **[ĐÃ CHỐT 21/10/2026] mã mời qua env là cơ chế
  CHÍNH THỨC** (không xây thêm admin duyệt / mã mời dùng một lần /
  whitelist email). Onboarding chọn "teacher" phải nhập mã mời khớp env
  `TEACHER_INVITE_CODE` (so sánh `timingSafeEqual` trong
  `lib/teacher-invite.ts`; env chưa đặt hoặc ngắn hơn 8 ký tự thì
  fail-closed — không ai tự cấp được quyền giáo viên).
  Hệ quả cần biết: giáo viên mới CHƯA có mã mời sẽ chỉ tạo được tài khoản
  học sinh; muốn thành giáo viên phải có mã mời do đơn vị quản lý env cấp.
- Rà soát dữ liệu: `scripts/audit-teachers.mjs` (chỉ đọc) liệt kê mọi
  tài khoản `role='teacher'`; việc hạ quyền tài khoản không hợp lệ làm
  THỦ CÔNG sau khi sao lưu DB — script không tự hạ quyền ai.

### 12.2 SEC-02 — XSS lưu trữ qua bodyHtml [ĐÃ SỬA]

- Chốt thư viện sau rà soát: phía server lúc ghi dùng `sanitize-html`
  (`lib/sanitize.ts`); phía hiển thị (client component
  `components/question/question-stem.tsx`) dùng `dompurify`. DOMPurify
  KHÔNG dùng ở server (cần jsdom), sanitize-html KHÔNG dùng ở client.
- Allowlist dùng chung ở `lib/sanitize-shared.ts` (một nguồn sự thật):
  thẻ img/table/thead/tbody/tfoot/tr/th/td/caption/br/p/u; thuộc tính
  img src/alt/class (class chỉ eq-inline|eq-figure), th/td colspan/rowspan
  (chỉ số); KHÔNG nhận `style` từ đầu vào. `img src` chỉ chấp nhận
  `data:image/(png|jpeg|gif|webp|svg+xml);base64` — loại //host, http:,
  https:, javascript:, đường dẫn thường.
- Style chiều cao của ảnh eq-inline do CHÍNH app tính từ nội dung SVG
  (`equationHeightEmFromSrc`) sau khi sanitize — không phải dữ liệu vào.
- Áp dụng lúc ghi: `createQuestion`/`updateQuestion` (câu + options);
  đường import: `persistParseResult` sanitize mọi bodyHtml, và
  `parseMediaArray` giới hạn 200 phần tử/mảng + 1.000.000 ký tự/phần tử
  rồi sanitize từng phần tử trước `attachBodyHtml`.
- Dữ liệu đã lưu: `scripts/resanitize-body-html.mjs` — mặc định
  `--dry-run` (chỉ liệt kê bản ghi sẽ đổi), ghi thật khi có `--write`.
- Kiểm chứng: `scripts/check-sanitize.mjs` (toàn bộ payload tái hiện +
  nghiệm thu của spec, kể cả thẻ viết hoa, svg onload, iframe, a
  javascript:, thực thể HTML; khẳng định ảnh eq-inline/eq-figure và bảng
  hợp lệ còn nguyên).

### 12.3 SEC-03 — kiểm quyền phiên/lớp dùng chung [ĐÃ SỬA]

- Helper `lib/session-access.ts`: `assertSessionAccess(sessionId, user)`
  (chủ phiên theo `sessions.teacherId` HOẶC thành viên lớp qua
  `class_students` — đúng mẫu `app/api/sessions/[id]/stream/route.ts`) và
  `assertClassAccess(classId, user)` (giáo viên sở hữu lớp hoặc học sinh
  thuộc lớp).
- Đã áp cho `getSession`, `getActiveSessionForClass`,
  `getSessionEvents` (app/actions/sessions.ts) và `getLiveQuizSnapshot`
  (app/actions/live-quiz.ts). Cả bốn đều từ chối khi chưa đăng nhập.
- Test: `scripts/check-session-access.mjs` (đối chiếu nguồn với stream
  route + mô phỏng quy tắc trên dữ liệu giả).

### 12.4 SEC-04 — allowedOrigins Server Actions [ĐÃ SỬA]

- `next.config.mjs`: allowedOrigins lấy từ env
  `SERVER_ACTIONS_ALLOWED_ORIGINS` (phân tách bằng dấu phẩy). Env trống:
  bỏ hẳn khóa (về mặc định same-origin của Next), ngoại trừ development
  thì cho localhost + domain dev. Wildcard monkeycode chỉ xuất hiện khi
  `NODE_ENV !== 'production'` và không có env override.
- `allowedDevOrigins` giữ nguyên (chỉ có tác dụng lúc `next dev`, đã ghi
  comment nói rõ). Cookie `sameSite: "none"` trong `lib/auth.ts` ĐÃ đúng
  từ trước (chỉ nằm trong nhánh development) — xác nhận, không sửa.

### 12.5 SEC-05 — mã mời lớp [ĐÃ SỬA]

- Mã MỚI: 8 ký tự, `crypto.randomInt` trên cùng bảng 32 ký tự
  (`lib/invite-code.ts`). Cột `classes.inviteCode` nới varchar(6) -> 32
  (schema + ALTER trong ensureSchema). Mã cũ 6 ký tự vẫn được `joinClass`
  chấp nhận (chuyển tiếp).
- `joinClass`: tối đa 5 lần nhập sai / 10 phút / tài khoản (rate limit
  lưu DB, mục 12.8); đúng mã thì xoá bộ đếm.
- Xoay mã: action `rotateInviteCode` (bản chất `regenerateInviteCode` đã
  có, UI chi tiết lớp đã có nút) — mã mới sinh ra đều là mã 8 ký tự.

### 12.6 SEC-06 — DoS khi upload [ĐÃ SỬA]

- Hai route worksheet kiểm `Content-Length` TRƯỚC khi đọc body: validate
  vượt 10MB (+64KB khung multipart) -> 413. **Lưu ý có chủ đích:** route
  save đặt ngưỡng body 32MB vì ngoài file (vẫn giới hạn cứng 10MB ở
  `bufferFromFormData`/extract) nó còn nhận text + images/tables JSON
  (base64 phình ~4/3) khi giáo viên sửa bản nháp — đặt 10MB sẽ làm hỏng
  luồng lưu hợp lệ.
- `bufferFromFormData`: chặn cứng theo `file.size` và độ dài buffer.
- Zip (lib/docx-omml.ts `assertDocxZipSafe`): duyệt entry từ central
  directory TRƯỚC khi xử lý — từ chối >2000 entry, tổng giải nén >50MB,
  `word/document.xml` >20MB, 1 ảnh >5MB, >200 ảnh. Lỗi guard nổi lên
  thành lỗi từ chối file (không bị nuốt như lỗi OMML thường).
- Timeout 20s cho bước phân tích file (`extractAndParse` bọc
  Promise.race; giới hạn này ngừng chờ phía route, không huỷ được tác vụ
  đồng bộ của thư viện — đã ghi chú trong code).
- Tần suất upload: 10 lần/giờ/user (rate limit DB) -> 429.
- `pnpm audit --prod`: ngày 2026-10-21 môi trường chạy thử bị registry
  chặn endpoint audit (403 policy) nên CHƯA có kết quả — cần chạy lại ở
  môi trường/CI của dự án (xem FIX-SEC-2026-10-21.md).

### 12.7 SEC-07 — header bảo mật + CSP Report-Only [ĐÃ SỬA]

- `next.config.mjs` thêm `headers()` cho `/:path*`: CSP ở chế độ
  `Content-Security-Policy-Report-Only` (default-src 'self'; img-src
  'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self';
  frame-ancestors 'none'; base-uri 'self'; form-action 'self';
  object-src 'none'), X-Frame-Options DENY, HSTS, nosniff,
  Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy
  tắt camera/microphone/geolocation nhưng GIỮ `fullscreen=(self)` cho
  màn hình live.
- Quy trình: theo dõi báo cáo Report-Only ~1 tuần rồi mới chuyển sang
  CSP bắt buộc. Lưu ý Next có thể cần 'unsafe-inline'/'unsafe-eval' cho
  script ở một số chế độ — quyết định khi bật thật dựa trên báo cáo.

### 12.8 SEC-08 — xác thực + rate limit lưu DB [ĐÃ SỬA một phần]

- `minPasswordLength` 6 -> 8.
- Bảng `rate_limits` (key, count, windowStart) tạo bằng CREATE TABLE IF
  NOT EXISTS trong `ensureSchema` (đúng mô hình repo) + helper
  `lib/rate-limit.ts` (`hitRateLimit`/`peekRateLimit`/`resetRateLimit`,
  fail-open có log khi DB lỗi). Đã dùng cho: joinClass (SEC-05), upload
  worksheet (SEC-06), và `assertGradeBurst` trong student-learn.ts (đổi
  sang async dùng helper này, GIỮ NGUYÊN ngưỡng 10 lần/60 giây).
- **[CHỜ QUYẾT ĐỊNH]** xác minh email khi đăng ký và luồng quên mật khẩu
  qua email (hiện `sendResetPassword` vẫn ném lỗi "chưa cấu hình gửi
  email") — không làm ở phiên này.

### 12.9 SEC-09 — không lộ lỗi nội bộ [ĐÃ SỬA]

- `lib/api-error.ts` (`safeErrorMessage`): chỉ các message nghiệp vụ đã
  biết mới trả nguyên văn cho client; lỗi lạ -> message chung +
  `console.error` chi tiết phía server. Đã áp ở 3 route:
  `app/api/sessions/[id]/live`, `app/api/worksheet/validate`,
  `app/api/worksheet/save`.

### 12.10 SEC-10 — cấu hình DB [ĐÃ QUYẾT ĐỊNH 21/10/2026 — GIỮ NGUYÊN ensureSchema]

- Quyết định của chủ sản phẩm (21/10/2026): giữ nguyên mô hình hiện
  tại — `lib/db/index.ts` và `ensureSchema()` không thay đổi, KHÔNG
  chuyển sang migration, KHÔNG hạ quyền DDL của user ứng dụng. Rủi ro
  đã biết và được chấp nhận: user DB của ứng dụng giữ quyền DDL.
- Ghi chú cho lúc triển khai production: vẫn nên đặt
  `sslmode=require` (hoặc cấu hình `ssl` tương đương) trong chuỗi kết
  nối production để mã hoá đường truyền app ↔ DB; việc này không phụ
  thuộc quyết định trên.
- Nếu sau này đổi ý: điều kiện tiên quyết bắt buộc là phải có hệ
  thống migration chạy lúc triển khai THAY THẾ các thay đổi schema
  trong `ensureSchema()` TRƯỚC, rồi mới tước quyền DDL — làm ngược
  thứ tự sẽ khiến `ensureSchema()` lỗi và app hỏng các luồng ghi.

### 12.11 SEC-11 — giới hạn kết nối SSE [ĐÃ SỬA]

- Stream route: tối đa 3 kết nối đồng thời mỗi (user, phiên), đếm trong
  bộ nhớ tiến trình; kết nối thừa -> 429; `cancel()` nhả slot kết nối
  cùng lúc dọn unsubscribe/heartbeat như trước.

### 12.12 SEC-12 — phụ thuộc [ĐÃ SỬA]

- `react` + `react-dom` 19.2.4 -> 19.3.1 (bản 19.x mới nhất tại
  2026-10-21, cao hơn mốc 19.2.9 spec yêu cầu). `next` giữ 16.4.1.
- Thêm mới: `sanitize-html` 2.18.1, `dompurify` 3.4.17 (cho SEC-02) +
  `@types/sanitize-html` (dev).

### 12.13 Nghiệm thu bảo mật

- Test mới: `scripts/check-sanitize.mjs` (SEC-02),
  `scripts/check-sec01-auth.mjs` (SEC-01/08), `scripts/check-session-access.mjs`
  (SEC-03), `scripts/check-invite-code.mjs` (SEC-05),
  `scripts/check-upload-guards.mjs` (SEC-06),
  `scripts/check-security-config.mjs` (SEC-04/07/08/09/11).
- Toàn bộ `scripts/check-*.mjs`: 30/37 PASS; 7 FAIL là các script cũ đã
  fail từ bản gốc __10 (check-class-phien1/2/3/6, check-parser-phien6/8,
  check-preview-phien3) — không tăng thêm, không hồi quy BUG-01..15.
- `npx tsc --noEmit` sạch; `pnpm build` thành công.

## 13. Chốt quyết định BUG-14, BUG-12 và cơ chế cấp quyền GV (2026-10-21)

Chủ sản phẩm chốt ngày 21/10/2026 ba việc còn treo từ batch 2 và đợt
SEC (chi tiết triển khai: `FIX-BUG1214-2026-10-21.md`):

### 13.1 BUG-14 — ÁP DỤNG bảng alias thuật ngữ vào chấm điểm

- Danh sách alias ĐÃ DUYỆT — chỉ đúng 4 cặp này, muốn thêm cặp phải
  được duyệt riêng, không tự suy cặp tương tự:
  `gene` ≡ `gen`, `ADN` ≡ `DNA`, `ARN` ≡ `RNA`, `mARN` ≡ `mRNA`.
- Cài đặt tại `lib/scoring.ts`: hằng `TERM_ALIASES` (khoá theo dạng
  SAU `normalizeAnswer`, tức đã thường hoá: adn/dna, arn/rna,
  marn/mrna) + hàm `canonicalizeTermAliases` thay mỗi TỪ NGUYÊN VẸN
  thuộc bảng bằng dạng đại diện của nhóm rồi mới so bằng.
- Điểm áp dụng (một cơ chế dùng chung cho mọi đường chấm văn bản tự
  do): `accepts` — dùng cho điền khuyết Tab 2 và kéo thả Tab 3 (cả
  hai đều chấm qua `gradeSlots`, kể cả nhóm hoán đổi qua
  `maxMatching`); và `gradeSA` — câu trả lời ngắn Tab 4 và live quiz
  (qua `gradeLive`). Không còn đường chấm văn bản tự do nào khác.
  Riêng Tab 3: chip do hệ thống cấp sẵn từ chính term của KP nên học
  sinh không gõ tự do, nhưng vì dùng chung `accepts` nên hành vi vẫn
  thống nhất, không cần cơ chế riêng.
- An toàn: "từ nguyên vẹn" = dãy chữ/số tối đa giữa hai ranh giới
  không-phải-chữ/số, nên `gen` trong `genetics`/`genome`/`gen1`
  KHÔNG được tính. `canonicalizeTermAliases` là identity khi chuỗi
  không chứa alias, nên mọi chốt cũ giữ nguyên: không bóc dấu
  (nucleotit ≠ nuclêôtit), `1/2 ≠ 0.5`, `1 500 ≠ 1500`; cặp ngoài
  danh sách đã duyệt (protein/prôtêin, enzim/enzyme) vẫn khác nhau.
- Mở rộng sau này: thêm cặp vào `TERM_ALIASES` trong
  `lib/scoring.ts` (đúng một nguồn duy nhất) sau khi được duyệt, rồi
  chạy lại `scripts/check-alias.mjs`.

### 13.2 BUG-12 — RESET tiến độ khi sửa KP làm thay đổi nội dung chấm

- Chính sách ĐÃ CHỐT: giáo viên sửa KP mà nội dung chấm thay đổi thì
  tiến độ của MỌI học sinh đối với KP đó được reset để làm lại phần
  đã đổi; sửa không đụng nội dung chấm thì giữ nguyên tiến độ.
- "Nội dung chấm" đo bằng `kpGradingSignature(terms)` trong
  `lib/scoring.ts`: với mỗi ô là tập đáp án chấp nhận đã
  `normalizeAnswer` (`text` + `extraAccepted` + `synonyms`, khử
  trùng lặp, sắp xếp); các ô được gom đúng theo phân hoạch nhóm
  hoán đổi của `gradeSlots` (cùng `swapGroupId` = một nhóm, còn lại
  mỗi ô một nhóm theo `slotIndex`) và sắp xếp ở mọi cấp. Hệ quả:
  đổi thứ tự term trong mảng hoặc đặt lại tên `swapGroupId` KHÔNG
  đổi chữ ký; đổi text/đáp án một ô, thêm/bớt ô, chuyển ô vào/ra
  nhóm hoán đổi, thêm term trùng nhãn trong nhóm ĐỀU đổi chữ ký;
  sửa định dạng mà `normalizeAnswer` đã gộp (hoa/thường, khoảng
  trắng, vị trí dấu thanh, ký hiệu) KHÔNG đổi chữ ký. Thân bài
  ngoài các ô trống không nằm trong chữ ký (sửa chính tả thân bài
  không reset). Các tương đương chỉ suy ra lúc chấm (alias ở 13.1,
  số thập phân `0,5 = 0.5`) không được gấp vào chữ ký: sửa riêng
  các trường hợp đó vẫn reset — chấp nhận theo hướng an toàn (học
  sinh làm lại còn hơn giữ tiến độ chấm theo nội dung cũ).
- Cài đặt tại `updateKnowledgePoint` (`app/actions/content.ts` —
  đường sửa KP duy nhất; `createKnowledgePoint` tạo KP mới nên
  không có tiến độ để reset): so chữ ký của terms đang lưu với
  terms sau `prepareKpTermsForSave`; nếu khác, trong CÙNG
  transaction với lần cập nhật KP:
  - `student_progress` của KP: đặt lại theo đúng tiền lệ
    `resetLessonProgress` — GIỮ `selfAssessment` (Tab 1 ở cấp bài
    đã khoá; xoá nó sẽ khiến học sinh kẹt, không vào lại được
    Tab 2/3), chỉ xoá `fillStatus`/`dragStatus`, `fillAttempts`/
    `dragAttempts` về 0, `fillRevealed`/`dragRevealed` về false,
    `fillFirstTry`/`dragFirstTry` về null, `overallStatus` tính
    lại từ `selfAssessment`. Các hàm đọc tiến độ đều coi hàng
    thiếu/trường null là chưa học nên học sinh được làm lại Tab
    2/3 của KP với nội dung mới.
  - `spaced_repetition` của KP: XOÁ hàng — lịch ôn theo nội dung
    cũ không còn ý nghĩa; lần nộp quiz sau sẽ seed lại từ đầu
    (interval 1, repetitions 0) nhờ `onConflictDoNothing` sẵn có.
  - Log `console.info` kèm số hàng progress đã reset và số hàng
    spaced_repetition đã xoá.
- Ngoài phạm vi: đường import worksheet tạo KP mới (id mới); tiến
  độ gắn với KP cũ bị cascade xoá theo KP như hành vi trước đây,
  không thuộc chính sách này.

### 13.3 SEC-01 — cơ chế cấp quyền giáo viên ĐÃ CHỐT

Mã mời qua env `TEACHER_INVITE_CODE` (đã cài ở 12.1) là cơ chế cấp
quyền giáo viên CHÍNH THỨC kể từ 21/10/2026 — trạng thái ở 12.1 đã
cập nhật tương ứng. Không xây thêm admin duyệt, mã mời dùng một
lần, hay whitelist email.

### 13.4 Nghiệm thu đợt chốt quyết định

- Test mới: `scripts/check-alias.mjs` (BUG-14: 4 cặp hai chiều qua
  cả gradeSA và gradeSlots, alias trong câu nhiều từ và trong nhóm
  hoán đổi; các trường hợp không được bằng: chuỗi con
  gen/genetics/genome, nucleotit/nuclêôtit, 1/2 vs 0.5,
  protein/prôtêin), `scripts/check-kp-reset.mjs` (BUG-12: tính chất
  chữ ký + đối chiếu nguồn updateKnowledgePoint).
- Toàn bộ `scripts/check-*.mjs`: 32/39 PASS (trước đợt này 30/37;
  tăng đúng 2 script mới); 7 FAIL vẫn là các script cũ đã fail từ
  bản gốc __10 (check-class-phien1/2/3/6, check-parser-phien6/8,
  check-preview-phien3) — không tăng thêm, không hồi quy.
- `npx tsc --noEmit` sạch; `pnpm build` thành công.

## 14. Giao bài hai chiều + tạo bài từ tab Lớp học (2026-10-21)

Theo yêu cầu của người dùng (2026-10-21):

- **Tab Bài giảng — nút "Giao bài" trên từng bài giảng**: mở popup chọn môn học
  (lọc danh sách lớp theo `classes.subject`), tick nhiều lớp, giao đồng loạt
  một bài cho nhiều lớp. Dữ liệu qua `getAssignableClasses(lessonId)` (kèm cờ
  `alreadyAssigned`, lớp đã có bài hiển thị "Đã giao" và không chọn lại được)
  và `assignLessonToClasses(lessonId, classIds, dueAt?, note?)` trong
  `app/actions/assignments.ts`. Đây là chiều ngược của `assignLessons` và giữ
  NGUYÊN luật cũ: bài phải `status = "ready"` (nút bị disable với bài chưa
  ready), lớp phải thuộc GV, trùng thì `onConflictDoNothing`.
- **Tab Lớp học → "Bài tập đã giao" — nút "Tạo bài giảng"** (nút "Giao bài
  giảng" giữ nguyên): là **NÚT TẮT** mở popup gồm ĐÚNG các cách tạo bài
  của tab Bài giảng (chốt cuối ngày 2026-10-22 sau hai lần đổi ý — bản
  đầu là form tạo bài có tự giao, bản hai là form tạo bài thuần):
  1. **Nạp từ file**: liên kết tới `/teacher/lessons/import?assignToClass=<id lớp>`.
     Trang import nhận ngữ cảnh lớp (chỉ lớp thuộc chính GV), hiện banner
     báo trước; **lưu thành công thì các bài vừa nạp được giao luôn cho
     lớp đó** (gọi `assignLessons` ngay sau khi route save trả
     `lessonIds`; bài nạp file vốn `ready` nên không vướng luật
     ready-only) và điều hướng về tab "Bài tập đã giao" của lớp. Bài vẫn
     ghi vào kho chung nên đồng thời có ở tab Bài giảng.
  2. **Tạo bài trống**: form chọn chương (`getChapterOptions` trong
     `app/actions/content.ts`) + tên bài, gọi thẳng
     `createLesson(chapterId, title)` — tạo THUẦN như tab Bài giảng,
     không tự giao; giao sau bằng nút "Giao bài giảng" khi bài sẵn sàng.
  Kèm theo (trong `worksheet-importer.tsx`, áp dụng cho cả trang import
  thường): **popup nhắc khi rời trang mà chưa lưu** — khi đã có bản xem
  trước (đã kiểm tra file) mà chưa lưu thành công, đóng tab/chuyển trang
  sẽ bị chặn hỏi xác nhận (beforeunload + chặn click liên kết), tránh GV
  quên bấm Lưu rồi thoát mất bài. Tắt nhắc sau khi lưu xong hoặc khi GV
  chủ động bỏ file.

## 15. Tích hợp AI qua MCP (2026-10-22) — tiền xử lý tài liệu + giải chi tiết

Quyết định nền (người dùng chốt 2026-10-22 sau thảo luận nhiều vòng):

- **KHÔNG gọi API model.** Web app mở **cổng MCP** (HTTP, JSON-RPC, khóa
  Bearer `AI_WORKER_TOKEN` ở env server); "bộ não" là **Muse của chủ hệ
  thống** kết nối vào qua connector riêng, đóng vai worker xử lý nền.
  Giai đoạn đầu chỉ chủ hệ thống + vài GV chạy thử. Mở rộng sau: farm
  nhiều Muse (1 Muse : 3 tài khoản GV) + 1 Muse quản lý phân bổ —
  kiến trúc việc/log dưới đây đã chừa sẵn workerId + bảng phân công.
- **Đa luồng, không hàng đợi:** mỗi tài liệu là một *việc AI* độc lập;
  nhiều worker/luồng nhận các việc khác nhau song song (nhận việc =
  lật trạng thái nguyên tử kèm workerId). Tài liệu dài được worker chia
  theo chương/KP thành luồng con, ghép lại trước vòng kiểm tra.
- **Phân quyền gói (dùng thử/Pro/Trường học) LÀM SAU.** Mọi lượt xử lý
  ghi log `ai_usage_logs` ngay từ đầu (ai, khi nào, việc gì, kết quả) để
  sau này tính gói/trần lượt dùng. Cổng kiểm tra quyền tương lai gắn ở
  đúng điểm tạo việc AI.

### 15.1. Việc AI (bảng `ai_jobs`) và luồng trạng thái

`pending` (vừa tạo) → `detecting` (worker đang đọc/quét) →
`needs_solution_choice` (không thấy phần giải chi tiết, chờ GV trả lời
popup) → `processing` (đang xử lý, có `progress` 0–100 theo tỉ lệ câu đã
xong) → `ready` (đã có bản dựng hợp lệ, GV xem trước/lưu như luồng
thường) hoặc `failed` (kèm lý do; GV luôn quay lại được chế độ không AI).

GV chọn file → popup BẮT BUỘC "Bạn có sử dụng AI không" (Sử dụng AI /
Không sử dụng AI). Không AI = validate như cũ. Có AI = trích text như
validate rồi tạo việc. Worker quét: tài liệu CÓ phần giải chi tiết tách
riêng → tự gắn; KHÔNG có → việc sang `needs_solution_choice`, UI hiện
popup "Bạn có muốn AI giải chi tiết không" (Có/Không).

### 15.2. Sáu chốt chặn chống lỗi (đã duyệt)

1. Worker trả **nội dung có cấu trúc** (JSON); code phía app
   (`lib/ai/render.ts`) tự dựng văn bản đúng form worksheet — worker
   KHÔNG tự gõ định dạng thô.
2. Bản dựng chạy qua `validateDocument` ngay phía server: lỗi thì trả
   danh sách lỗi về worker để sửa, tối đa 3 vòng (`submitResult` trả
   `repairErrors`); quá vòng → `failed` kèm lỗi cuối.
3. **Đối chiếu giữ nguyên bằng máy** (`lib/ai/verify.ts`): câu trắc
   nghiệm + nội dung KP của bản gốc phải xuất hiện y nguyên trong bản
   dựng (chuẩn hoá khoảng trắng/dấu gạch chân). AI chỉ được: thêm gạch
   chân, sinh KP (khai báo `generated`), điền đáp án cho câu vốn THIẾU
   đáp án (khai báo `filledAnswers`), gắn/sinh giải chi tiết. Câu hỏi
   mới tự chế = lỗi sửa.
4. Gạch chân phải khớp nguyên văn trong KP; mỗi câu MC đúng 1 đáp án
   gạch chân (validator hiện có đã ép) — bản dựng sai thì vòng sửa xử lý.
5. KP do AI sinh + đáp án do AI điền được **đánh dấu trong bản xem
   trước** (nhãn "AI sinh"/"AI điền đáp án" theo dòng); lời giải không
   gắn được câu nào thì liệt kê riêng, tô đỏ. File gốc + bản dựng lưu
   trong việc để truy vết.
6. Sách giáo khoa là **tham chiếu cắm sau** (tool `get_textbook_excerpt`
   trả rỗng cho tới khi có kho sách); lỗi AI không chặn luồng nạp thường.

### 15.3. Giải chi tiết từng câu (tính năng AI số 2)

- Cú pháp trong form worksheet: dòng `Giải chi tiết: ...` (hoặc
  `Hướng dẫn giải: ...`) NGAY SAU câu hỏi/đáp án của nó; parser đưa vào
  `ParsedQuestion.solution` → cột `questions.solution`. Tiêu đề trần
  `HƯỚNG DẪN GIẢI` ở cuối file vẫn là mốc hết phần câu như cũ.
- Ghép lời giải sẵn có theo **NGHĨA là chính** (đọc nội dung câu hỏi và
  lời giải, khớp kiến thức/dữ kiện/kết luận); **trùng số câu là tiêu chí
  phụ** khi 2 lời giải cùng khớp nghĩa 1 câu. Không khớp rõ → không gắn.
- GV xem trước: mỗi câu có lời giải thì có nút "Hướng dẫn giải" **thu
  gọn**, bấm mới xổ.
- Học sinh (Tab 4): nút "Hướng dẫn giải" của một câu chỉ **sáng sau khi
  đã nộp bài và thấy đúng/sai của câu đó** — đặt ở phần Chi tiết kết quả
  (Tab 4 nộp cả bài một lần, đúng/sai hiện ở màn hình kết quả). Bài
  không có lời giải thì không có nút. **Live quiz: không bao giờ có.**

### 15.4. Gộp khung xem trước (áp cả 2 chế độ nạp)

Bỏ khung danh sách lỗi riêng: chỉ còn **một bản xem trước**; khối nào có
lỗi thì tô đỏ tại chỗ, GV bấm vào khối để sửa trực tiếp (trình sửa hiện
kèm thông báo lỗi của đúng khối đó); sửa đúng thì khối hết đỏ. Số lỗi
tổng vẫn hiện ở tiêu đề. Luật chặn lưu khi còn lỗi giữ nguyên.

### 15.5. MCP tools (route `/api/mcp`, Bearer `AI_WORKER_TOKEN`)

`list_pending_jobs` · `get_job` (text gốc + cờ muốn giải chi tiết + lỗi
sửa của vòng trước) · `report_detection` (có/không có phần giải chi
tiết) · `set_progress` · `submit_result` (JSON cấu trúc → dựng + kiểm
tra + đối chiếu; trả `ok` hoặc `repairErrors`) · `get_textbook_excerpt`
(chưa có sách → rỗng). Mọi tool call đều ghi `ai_usage_logs` kèm
workerId (header `X-Worker-Id`, mặc định "muse-main").

## 16. Tab 4 nộp từng câu + từ nhiễu kéo thả theo từng cụm (2026-10-22)

Chốt của user (thay hai ánh xạ tạm ở §15): (1) Tab 4 chấm TỪNG CÂU —
học sinh bấm nút **"Nộp câu hỏi"** để nộp/khóa từng câu: chấm ngay,
báo đúng/sai tại chỗ, nút hướng dẫn giải sáng lên; **đã nộp thì không
sửa được nữa trong lượt làm đó** (khóa phía máy chủ, không chỉ giao
diện), xem lại câu đã nộp ở chế độ chỉ đọc. Học sinh dừng giữa chừng
thì mở lại tiếp tục đúng vị trí (lượt làm mở giữ ở máy chủ; câu đã
nộp khôi phục từ máy chủ, đáp án đang dở + vị trí từ bản nháp máy).
Nộp bài cuối buổi khóa nốt các câu chưa nộp theo đáp án hiện tại.
(2) AI tạo **pool kéo thả riêng cho từng cụm gạch chân**: từ đúng +
**ít nhất 3 từ nhiễu** lấy nguyên văn từ phần trắc nghiệm của tài
liệu, gần nghĩa với từ đúng nhưng không điền đúng được vào chỗ trống
đó. Nạp không qua AI thì không có từ nhiễu riêng.

Hiện thực: `submitQuizQuestion(quizId, questionId, answer)` — khóa
dòng attempt FOR UPDATE, câu đã có dòng `quiz_answers` thì trả kết
quả đã lưu (idempotent, chống ghi trùng/23505), chưa có thì chấm
bằng `gradeOneFromSnapshot` (bản sao trung thực của vòng chấm trong
submitQuiz, kể cả BUG-10) và ghi ngay. `submitQuiz` dựng lại kết quả
các câu đã nộp từ `quiz_answers` (`detailFromStored`), chỉ chấm các
câu còn lại — điểm/SR/kết quả cuối không đổi ngữ nghĩa.
`getOpenQuizState(lessonId)` trả các câu đã nộp của lượt đang mở để
client khôi phục. Client (tab4-quiz): nút "Nộp câu hỏi" + hộp xác
nhận, `LockedQuestionView` chỉ đọc (đáp án của HS, đáp án đúng,
hướng dẫn giải), ô số câu hiện ✓/✗ cho câu đã nộp.

Từ nhiễu: `AiUnderline.distractors` (JSON của worker, KHÔNG qua
đường text) → `verifyAiResult` mục 5 bắt buộc ≥3/cụm, nguyên văn
trong tài liệu, không lặp, và không được `accepts()` cho bất kỳ cụm
nào cùng KP (chặn cả alias + số tương đương) → `submitJobResult` ghi
`resultMeta.distractors` (lessonIdx/kpIdx/term) → client gọi
`applyAiDistractors(jobId, lessonIds)` ngay sau khi lưu (lỗi bước
này không chặn lưu) → `applyDistractorsToLessons` gắn vào
`knowledgePoints.underlinedTerms[].distractors` (khớp theo thứ tự
bài/KP + text; GV sửa chữ thì bỏ qua mục đó). Tab 3
(`getTab3Questions`): KP có từ nhiễu riêng thì pool = từ đúng + toàn
bộ từ nhiễu của KP (vẫn qua `pickDistractors` để lọc theo
acceptedNormsOf), không có thì giữ cách cũ (mượn 3 từ KP khác).
Chấm Tab 2/3 không đổi.

## 17. Mở lại bản xem trước AI chưa lưu (2026-10-23)

Vấn đề (GV gặp thật với bài 2 tối 22/10): kết quả AI xử lý xong chỉ
sống trong bản xem trước của phiên nạp bài đang mở. GV đóng tab /
tải lại trang trước khi bấm "Lưu vào hệ thống" thì bài chưa từng
được tạo, dù kết quả còn nguyên trong `ai_jobs` (resultText/
resultMeta) — không có đường nào trong UI để lấy lại.

Chốt hành vi: việc AI chưa lưu vẫn giữ nguyên kết quả ở máy chủ;
GV vào lại trang nạp bài, bấm vào việc đó thì bảng xem trước xuất
hiện lại y như phiên gốc. Sau khi lưu thành công, việc tự rời khỏi
danh sách chờ (không mở lại/lưu trùng được nữa).

- Schema: `ai_jobs.consumedAt` (timestamp, nullable). null = còn
  chờ GV xử lý; có giá trị = GV đã xong việc với job (đã lưu bản
  xem trước, hoặc chủ động ẩn). DDL: thêm vào CREATE TABLE +
  ALTER ADD COLUMN IF NOT EXISTS riêng (bọc catch riêng, cùng
  khuôn các đợt trước) vì bảng production đã tồn tại.
- API (đều khóa theo teacherId của phiên đăng nhập):
  - `GET /api/ai/jobs` không kèm `id` -> danh sách 15 việc gần nhất
    của chính GV, chỉ cột nhẹ (id, filename, status, progress,
    stage, error, consumedAt, createdAt) — KHÔNG kèm sourceText/
    resultText. Có `id` giữ nguyên hành vi cũ (payload mở lại gồm
    resultText/resultMeta/images/tables khi ready).
  - `POST /api/ai/jobs/consume` {jobId} -> `markAiJobConsumed`:
    chỉ việc của chính GV (không phải -> 404), idempotent, ghi
    log `job_consumed`.
- UI (worksheet-importer): khối "Việc AI trước đó chưa lưu" hiện
  khi chưa có preview/aiJob đang theo dõi và còn việc chưa
  consumed. Việc ready -> nút "Mở xem trước": tải payload theo id
  rồi đi đúng đường `applyAiReady` của phiên gốc; dựng lại File từ
  resultText + filename gốc để luồng Lưu (đường text) chạy không
  đổi, `aiJobIdRef` trỏ về job đó nên sau lưu vẫn gắn từ nhiễu
  §16 như thường. Việc đang chạy dở (pending/detecting/
  processing/needs_solution_choice) -> "Theo dõi tiếp" = gắn lại
  vòng polling theo id (kể cả popup hỏi giải chi tiết). Việc failed
  hiện lỗi. Nút X = ẩn việc (consume). Sau khi lưu thành công một
  preview AI, importer tự gọi consume trước khi chuyển trang
  (lỗi consume không chặn luồng lưu).
- Kiểm chứng: E2E `test-ai-resume-e2e.mjs` 15/15 (tạo việc ->
  ready -> list thấy việc chưa consumed -> cách ly GV khác
  (list/consume 404) -> lưu từ bản mở lại tạo đúng 1 bài ->
  consume -> hết khỏi danh sách chờ -> consume lại vẫn 200 ->
  việc pending cũng được list). E2E §15 26/26 và §16 29/29 giữ
  nguyên; bộ check 33/40 (7 lỗi cũ không đổi); tsc/build sạch.

## 18. Form file mới: 1 file = 1 bài + đích lưu linh hoạt (2026-10-23)

Quyết định của chủ dự án (đã chốt): mỗi file nạp chỉ cho MỘT bài; cấu
trúc file mới giữ dòng `[Tên bài]`, bỏ khung chương trong file —
chương được CHỌN Ở GIAO DIỆN khi nạp. Mẫu mau-cau-hoi.txt/.docx đã
soạn lại theo form này.

### 18.1 Tên bài và trạng thái nháp
- Parser: dòng `[ ]`/`[]` (tên trống) được nhận diện là bài thiếu
  tên — `ParsedLesson.titleMissing = true`, validateDocument chỉ
  CẢNH BÁO (không chặn lưu như BUG-09 dành cho lỗi nội dung).
- Khi lưu: bài có tên trong file -> `ready` như cũ; bài thiếu tên
  -> tên tạm = tên file (bỏ đuôi), trạng thái **draft** chờ GV
  duyệt tên. Đường AI: worker đặt `titleGeneratedByAi: true` trên
  bài mình đặt tên (skill ai_worker_processing đã bổ sung quy tắc);
  submitJobResult tính `resultMeta.draftLessonIndexes` (chỉ số bài
  phẳng); importer truyền `draftLessonIndexes` xuống lúc lưu và
  persist ép đúng các bài đó sang draft.
- File cũ chứa nhiều bài (kèm `{chương}`) VẪN nạp được: tách
  thành các bài riêng như trước, chương lấy theo file khi GV
  không ép chương đích.

### 18.2 Đích lưu (PersistOptions ở lib/worksheet-import.ts)
Đường lưu nhận thêm: `targetChapterId` (ép mọi bài trong file
vào một chương do GV chọn/tạo ngay ở màn hình nạp — mặc định
importer chọn sẵn chương đầu tiên để file form mới không rơi
vào "Chương chưa đặt tên"), `classId` (lưu tại lớp), `intoLessonId`
(nạp cộng thêm), `draftLessonIndexes`. Mọi đích đều kiểm tra
quyền sở hữu của GV trước khi ghi; insert câu hỏi tách thành
helper `insertParsedQuestion` dùng chung (bất biến BUG-02 giữ
nguyên, check-import-batch2 đã cập nhật khẳng định tương đương).

### 18.3 Bài "lưu tại lớp" (class-only)
- Schema: `lessons.classId` (uuid, FK classes cascade) +
  `chapterId` nới thành nullable (ensureSchema ALTER, bọc catch
  riêng từng câu như mọi đợt). Bài tại lớp: chapterId = null,
  classId = lớp; persist/createClassLesson ghi luôn dòng
  class_assignments cho chính lớp đó.
- Hệ quả đã xử lý đồng bộ: thư viện (getChaptersWithLessons) tự
  loại bài tại lớp theo chapterId; getLessonDetail/getClassAssignments/
  getAssignedLessonsForStudent chuyển LEFT JOIN chương + nhãn thay
  thế; phía HS: getStudentLessons gom bài tại lớp (ready, có KP)
  thành nhóm riêng "Bài tại lớp <tên lớp>"; assignLessons/
  assignLessonToClasses CHẶN giao bài tại lớp sang lớp khác;
  removeAssignment trên bài tại lớp = XOÁ luôn bài (bài không
  tồn tại ngoài lớp).
- ensureSchema bổ sung CREATE UNIQUE INDEX IF NOT EXISTS
  ca_class_lesson_unique (schema drizzle đã khai báo nhưng DB
  lệch sẽ thiếu — thiếu thì MỌI insert giao bài dùng ON CONFLICT
  đều lỗi; phát hiện khi E2E §18 chạy trên DB local bị lệch).

### 18.4 Nạp cộng thêm vào bài có sẵn (append + chống trùng)
- Vào từ nút "Nạp file" (bài chưa từng nạp) / "Đã nạp file" (đã
  nạp — trạng thái suy từ `lessons.originalFileKey`) trên thẻ
  bài, hoặc nút "Nạp từ file" dưới tên bài ở màn hình tạo bài
  thủ công (lesson-detail). Importer mở với `?intoLesson=<id>`.
- Toàn bộ KP của file (gộp phẳng mọi bài trong file) cộng dồn
  vào bài đích: KP trùng nội dung (chuẩn hoá trim/gộp khoảng
  trắng/thường hoá — CHỈ để chống trùng, không dính logic chấm)
  thì gộp câu mới vào KP cũ; câu trùng (vân tay: loại + stem +
  options, riêng SA là tập đáp án chấp nhận đã sắp xếp) ở BẤT KỲ
  KP nào trong bài thì bỏ qua. `lib/append-dedupe.ts` dùng chung:
  client tính trước để cảnh báo ở bản xem trước (qua action
  getLessonDedupeSnapshot), server tính lại lúc lưu làm kết quả
  chính thức (trả về appended{addedKps, addedQuestions,
  skippedQuestions} + duplicateWarnings). Tên/chương/trạng thái
  của bài đích KHÔNG đổi; originalFileKey cập nhật theo file mới
  nạp. AI + nạp cộng thêm: bỏ qua gắn từ nhiễu §16 (vị trí KP đã
  lệch sau gộp) — Tab 3 dùng pool mặc định cho các KP đó.

### 18.5 Bố cục tab Bài giảng và tab Lớp
- Tab Bài giảng: BỎ nút "Nạp từ file" toàn cục ở đầu trang.
  Popup "+ Bài giảng" trên thẻ chương chỉ còn 2 nút "Tạo bài
  giảng" / "Hủy": tạo bài nháp "Bài giảng mới" rồi đi thẳng sang
  màn hình tạo bài thủ công (/teacher/lessons/[id]); nút "Nạp từ
  file" nằm ngay dưới tên bài ở màn hình đó. Giữ nút tạo chương
  như cũ.
- Tab Lớp: nạp từ file -> khi bấm "Lưu vào hệ thống", importer
  hỏi THƯ VIỆN (chọn chương, giao luôn cho lớp) hay TẠI LỚP;
  "Tạo bài trống" cũng hỏi tương tự ngay trong hộp thoại
  (createClassLesson cho nhánh tại lớp).

### 18.6 Kiểm chứng
- scripts/check-import-v18.mjs mới: 20/20 (parser titleMissing +
  cảnh báo + tách file cũ; append-dedupe 4 nhóm tình huống).
  Bộ check toàn cục 34 pass / 7 fail — đúng 7 lỗi nền cũ;
  check-import-batch2 cập nhật khẳng định BUG-02 theo helper.
- E2E live mới test-import-v18-e2e.mjs: 33/33 (chương đích +
  ready; tên trống -> draft + tên file; file cũ tách 2 bài; nạp
  cộng thêm 2 lượt với số đếm trùng khớp chính xác; snapshot;
  class-only: vô hình ở thư viện, HS thấy ở nhóm riêng khi
  ready, chặn giao chéo, gỡ = xoá; AI titleGeneratedByAi ->
  meta [0] -> lưu draft). Hồi quy E2E §15/§16/§17 đạt trên cùng
  bản build; tsc/build sạch.

### 18.7 Bổ sung cùng ngày: ẩn panel việc AI ở chế độ nạp cộng thêm
Panel "Việc AI trước đó chưa lưu" (§17) trước đây hiện ở mọi ngữ
cảnh trang nạp. Ở ngữ cảnh `?intoLesson` (nạp cộng thêm), mở lại
kết quả AI từ panel rồi lưu sẽ cộng toàn bộ nội dung vào bài đích
và bỏ qua bước gắn từ nhiễu (theo 18.4) — không phải ý định
thiết kế. Đã sửa: panel chỉ hiện khi KHÔNG có intoLesson; việc
AI vẫn nguyên trên máy chủ, mở trang nạp thường là thấy lại.
Đường KHÔNG dùng AI ở chế độ cộng thêm không bị ảnh hưởng (kiểm
tra trực tiếp + cảnh báo trùng + cộng dồn như thiết kế).

## 19. Ảnh/bảng trong điểm kiến thức + MỖI DÒNG LÀ MỘT ĐIỂM KIẾN THỨC (GV chốt 2026-10-23)

Bối cảnh: việc AI Bài 3 (lý thuyết có bảng thí nghiệm) để lộ hai lỗi:
mã giữ chỗ @@TBL0@@ in nguyên văn trong điểm kiến thức ở bản xem
trước, và AI dồn nhiều dòng của GV thành một điểm kiến thức lớn.

### 19.1 Ảnh/bảng trong điểm kiến thức (sửa gốc)
- Trước đây media chỉ được hỗ trợ trong thân/phương án câu hỏi
  (attachBodyHtml -> bodyHtml); nội dung KP không có đường nào nên
  token lọt nguyên văn vào bản xem trước, bài đã lưu và Tab 1.
- ParsedKnowledgePoint thêm `bodyHtml`; attachBodyHtml xử lý cả KP:
  phần tử media của các dòng chứa token -> bodyHtml của điểm (chỉ
  phần media, không kèm chữ xung quanh), token bị xoá khỏi content,
  và start/end của các cụm gạch chân phía sau token được TÍNH LẠI
  theo thứ tự xuất hiện (xoá token làm lệch offset; khâu lưu
  prepareKpTermsForSave kiểm tra offset rất chặt).
- DB: knowledge_points.bodyHtml (schema + ensureSchema ALTER riêng
  bọc catch); persist ghi ở cả hai đường (tạo mới + cộng thêm);
  getLessonDetail trả kèm; KnowledgePointDto thêm bodyHtml (đường
  học sinh select nguyên dòng nên tự có). Hiển thị: component dùng
  chung KpMedia (cùng lớp sanitize DOMPurify như QuestionStem) ở
  bản xem trước (worksheet-preview-doc) và thẻ điểm Tab 1
  (KPCard — cả bản tự đánh giá lẫn bản chỉ-đọc).

### 19.2 Mỗi dòng là một điểm kiến thức (luật thiết kế gốc của GV)
- Định nghĩa: một điểm kiến thức = đoạn chữ giữa hai lần Enter.
  ĐỀ MỤC (dòng tiêu đề mục) không sinh điểm. Nạp tay theo mẫu: mỗi
  dòng "- " là một điểm.
- Parser: dòng chữ thường theo sau một điểm kiến thức KHÔNG còn bị
  gộp vào điểm đó (hành vi cũ) mà mở điểm kiến thức MỚI, gạch chân
  trên chính dòng đó thành ô trống của điểm mới (extractBlanks như
  dòng "- "). Token ảnh/bảng đứng một mình trong vùng lý thuyết thì
  gắn vào điểm hiện tại thay vì biến mất.
- Hệ quả bắt buộc: điểm kiến thức KHÔNG có cụm gạch chân hạ từ LỖI
  chặn xuống CẢNH BÁO trong validateDocument — một dòng không gạch
  chân là điểm chỉ-đọc hợp lệ (Tab 1 + tự đánh giá; Tab 2/3 vốn đã
  tự bỏ qua điểm không có cụm). Không hạ thì tài liệu thật (Bài 1
  Gene: dòng "3. Kết quả: ..." không gạch chân) bị khoá toàn bộ.
  Hệ quả nhìn thấy: fixture Bài 1 parse ra 23 điểm thay vì 22;
  check-preview-phien6 đã cập nhật kỳ vọng + đọc cảnh báo KP ở
  warnings (ghi rõ §19 trong script).
- Đường AI: renderAiResult chặn KP nhiều dòng (vấn đề sửa vòng
  repair); skill ai_worker_processing thêm mục §19 — mỗi dòng một
  điểm, đề mục bỏ qua, dòng chỉ có nhãn dẫn hoặc chỉ có hình/bảng
  thì thuộc về điểm của dòng nội dung theo sau, token giữ inline.
- GV sửa bản nháp bằng Enter: bản nháp là TEXT, lưu đi qua parser
  nên luật dòng tự áp dụng — không cần tách riêng ở persist.
- Kiểm chứng: check-kp-v19 15/15; suite 34/41 -> 35/42 (giữ nguyên
  7 lỗi cũ); E2E §15/§16/§17/§18 đạt; E2E §19 trực tiếp 10/10 (lưu
  qua /api/worksheet/save: 3 dòng -> 3 điểm, KP1 có bodyHtml bảng
  thật + content sạch + offset khớp, getLessonDetail trả bodyHtml).

## 20. Ctrl+click gạch chân mất tác dụng với điểm dạng "1. ...", "a. ..." (sửa 2026-10-24)

Báo cáo của GV: điểm bắt đầu bằng "-" thì Ctrl+click gạch chân được,
điểm dạng "1. ...", "a. ..." thì không. Mẫu này chỉ khớp đúng một chỗ:
khung sửa khối ở màn hình nạp file (ImportErrorFix) quyết định bật
Ctrl+click bằng tiền tố "-" ở dòng đầu khối (isKpEditor) — luật cũ từ
trước §19. Theo luật §19, dòng "1. ..."/"a. ..." cũng là điểm riêng
nhưng không có "-", nên khung sửa tắt chức năng và không hiện cả
hướng dẫn. (Hộp thoại điểm ở màn hình bài giảng không có luật này —
mẫu báo cáo chỉ khớp khung sửa màn hình nạp file.)

- Sửa: isKpBlock mới trong lib/worksheet-source-range.ts — nhận diện
  khối điểm bằng dòng bắt đầu của khối có nằm trong tập dòng điểm
  của parseResult hay không (collectKpLines), giữ nguyên hai luật cũ
  (tiền tố "-" và thông điệp lỗi nhắc "Điểm kiến thức"). Khung sửa
  dùng tập dòng từ lần parse gần nhất.
- Sửa kèm cùng cử chỉ: applyKpWrap trước đây nở từ theo ký tự "_" nên
  Ctrl+click vào từ ĐÃ gạch (vd "__phân tử__") bọc thêm một lớp dấu
  thành "____phân__ tử__" thay vì gỡ gạch. Nay kiểm tra cụm đã gạch
  trước khi nở từ: chạm vào cụm thì gỡ sạch dấu; vùng chọn giao một
  phần với dấu thì giữ nguyên để khỏi hỏng dấu.
- Kiểm chứng: check-kp-v19 mở rộng 25/25 (10 kiểm tra mới cho hai
  sửa trên), suite 35/42 (nguyên 7 lỗi cũ), tsc sạch.

## 21. Thẻ đỏ "bài nháp chưa lưu" + lưu xong tự Sẵn sàng (GV chốt 2026-10-24)

- Bối cảnh: GV hỏi vì sao bài AI đã tạo (Bài 3) mà đang sửa chưa lưu
  thì không tìm thấy ở đâu — vì bài chưa lưu chưa phải là bài giảng:
  việc AI chỉ nằm trong panel "Việc AI trước đó chưa lưu" ở trang nạp,
  nạp thường chỉ nằm trong tab trình duyệt. GV chốt: việc đang dở phải
  HIỆN RA ở nơi GV nhìn thấy, màu đỏ, để GV biết mà sửa tiếp.
- Quy tắc chung: bất cứ bài nào đang "chưa lưu xong" thì thẻ màu đỏ +
  dòng chữ đỏ nhỏ "bài nháp chưa lưu".
- (1) Bài nháp ĐÃ tạo (kể cả bài trống vừa bấm Tạo): đã có dòng trong
  DB nên thẻ đỏ hiện ngay trong danh sách — tab Bài giảng (trong
  chương của nó) và tab Lớp (danh sách bài của lớp). Thay cho huy hiệu
  "Nháp" xám trước đây. Hết đỏ khi bài thành "Sẵn sàng".
- (2) Bài nạp file (thường hay AI) chưa bấm Lưu: chưa có dòng bài thật
  nên hiện bằng THẺ ĐỎ GIỮ CHỖ từ bảng mới import_drafts (teacherId,
  classId nullable, kind ai/upload, jobId, filename, sourceText,
  images, tables; ensureSchema tạo bảng + index, bọc catch riêng như
  mọi đợt). Lớp bắt đầu nạp -> thẻ ở tab Lớp đó; đường nạp thường ->
  thẻ ở nhóm "Chưa lưu" trên cùng tab Bài giảng. Bấm "Mở tiếp" ->
  trang nạp mở lại đúng bản xem trước đang dở (?resumeJob= / ?resumeDraft=
  + assignToClass nếu có; mở xong dọn tham số khỏi URL). Bấm X -> bỏ
  việc (việc AI thì consume luôn job). Thẻ biến mất khi lưu xong
  (save route dọn theo draftId/aiJobId; consume route dọn theo jobId)
  hoặc khi GV bỏ. HS không bao giờ thấy thẻ này (HS chỉ thấy bài ready).
- Nạp cộng thêm (intoLesson) KHÔNG sinh thẻ — bài đích đã có thẻ đỏ
  của nó nếu còn nháp; trạng thái bài đích không đổi khi nạp thêm.
- Ghi thẻ lúc nào: AI -> ngay khi tạo job xong (startAiFlow); nạp
  thường -> ngay khi có bản xem trước (doValidate xong). Nạp thường
  cùng (GV, lớp, tên file) thì thay thế dòng cũ để khỏi nhân đôi thẻ
  khi nạp lại cùng file. Bỏ file ở đường nạp thường (reset) thì xoá
  luôn dòng; reset ở đường AI thì giữ job + thẻ (đúng vòng đời panel §17).
- Mở lại việc nạp thường: dựng preview client-side từ sourceText đã
  ghi (parseTextContent + attachBodyHtml/attachOptionBodyHtml + validate
  — cùng cách applyAiReady dựng từ resultText) để giữ nguyên ảnh/bảng
  đã trích từ file gốc; KHÔNG validate lại từ file text (sẽ mất media).
  Mở lại việc AI: dùng đúng resumeReadyJob/trackJob của §17.
- (3) LƯU XONG TỰ SẴN SÀNG (thay đổi duy nhất GV yêu cầu so với đề xuất):
  persist ở lib/worksheet-import.ts giờ gán status "ready" cho MỌI bài
  mới tạo qua đường nạp file. Hệ quả CỐ Ý, đã nói rõ với GV: thay thế
  cơ chế "nháp chờ duyệt tên" của §18 cho đường nạp file — bài thiếu
  tên (tên file thay thế) và bài AI đặt tên nay lưu xong thành Sẵn sàng
  luôn, vì GV đã thấy tên ở bản xem trước rồi mới bấm Lưu; không còn
  bước chuyển trạng thái tay. Cảnh báo titleMissing, ghi chú tên bài ở
  preview và toast sau lưu đã sửa theo (không còn chữ "Nháp chờ duyệt").
  draftLessonIndexes vẫn được gửi và vẫn quyết định TÊN thay thế, chỉ
  không còn ép trạng thái.
- Ranh giới giữ nguyên (đã nêu với GV): bài trống tạo bằng nút vẫn là
  Nháp (thẻ đỏ) cho tới khi GV chuyển "Sẵn sàng" ở dropdown Trạng thái
  — màn hình bài giảng không có nút Lưu toàn bài, lưu KP là lưu tăng
  dần từng điểm nên không thể tự sẵn sàng sau một lần lưu KP (bài đang
  soạn dở mà thành sẵn sàng thì HS lớp đó thấy bài chưa xong). Bài
  giao cho lớp vẫn yêu cầu ready như cũ (assignLessons lọc readyIds);
  bài tại lớp HS chỉ thấy khi ready (getStudentLessons lọc status).
- Kiểm chứng: tsc sạch; suite 35/42 (nguyên 7 lỗi cũ); check API mới
  test-import-drafts-21.mjs 21/21 (tạo/liệt kê theo lớp-thư viện, thay
  thế cùng file, lưu kèm draftId -> ready + mất thẻ, job AI + consume
  -> mất thẻ, DELETE); E2E §18 ALL PASS (đã cập nhật 2.1/8.3 sang ready,
  7.1 bài trống tại lớp vẫn draft); E2E §17 chạy lại ALL PASS (lần chạy
  đầu rớt FAIL 9 do phiên GV thứ hai chập chờn — việc vẫn chưa bị
  consume, đúng mẫu auth lỗi đã biết khi chạy dồn); E2E §15 ALL PASS.

## 22. Ảnh import lưu lên Vercel Blob (GV chốt 2026-10-24, commit 0176d08)
- Bối cảnh: database Neon cũ hết 5 GB transfer/tháng (xem §21 và nhật ký
  sự cố 2026-10-24) — nghi ngờ lớn là ảnh base64 nằm trong DB. GV chốt
  dùng Vercel Blob trước để test trên 3 lớp ~150 học sinh; B2 Private
  giữ làm dự phòng, R2 loại vì lần đầu kích hoạt thường bắt thẻ/PayPal
  (GV không có thẻ; bucket Public của B2 cũng bắt thẻ hoặc phí $1).
- Thiết kế (điểm can thiệp duy nhất: trích xuất phía server,
  lib/extract-file.ts): ảnh raster (png/jpeg/gif/webp) upload lên Blob
  bằng @vercel/blob put() (access public, pathname = sha256 nội dung +
  đuôi file, addRandomSuffix false → ảnh giống nhau dedupe thành một
  object/URL); images[] thành URL Blob, downstream (job/draft/bodyHtml/
  preview/HS) không đổi gì. SVG công thức giữ data URI inline (code
  tính chiều cao đọc trực tiếp từ SVG). Thiếu BLOB_READ_WRITE_TOKEN →
  chạy y như cũ (base64); upload lỗi → fallback base64 + log, import
  không bao giờ gãy vì Blob. Allowlist sanitize (SEC-02) mở thêm chỉ
  đúng host *.public.blob.vercel-storage.com.
- Kiểm chứng: tsc sạch; suite 35/42 (nguyên 7 lỗi cũ); test chuyên biệt
  28/28 (fallback khi chưa có token, dedupe, chặn userinfo/host na ná,
  parser giữ ảnh Blob). Upload thật lên store chưa kiểm chứng trong
  sandbox (cần token từ store GV tạo trên Vercel) — phải test import
  thật một file docx có ảnh sau khi deploy.
- Vận hành: vượt hạn mức Blob gói miễn phí (1 GB lưu trữ / 10 GB tải
  xuống / 2.000 upload/tháng) thì ảnh ngừng hiển thị tới chu kỳ sau
  chứ không tính phí thêm. Dung lượng test: 150 em mở lần đầu bài 3 MB
  = 450 MB (4,5% hạn mức); làm lại trên cùng máy nhờ cache trình duyệt
  nên không tốn thêm.

## 23. Bỏ mã mời giáo viên lúc onboarding (GV chốt 2026-10-24)
- Quyết định đảo ngược SEC-01 (§12): giáo viên tạo tài khoản KHÔNG cần
  mã mời nữa — đăng ký rồi chọn "Giáo viên" là thành giáo viên ngay.
  Lý do trực tiếp: GV bị kẹt ở màn hình onboarding vì không nhớ mã mời
  cũ (đặt từ 21/10), và GV xác nhận lại mô hình đúng của app: mã mời
  là mã lớp 6 ký tự để học sinh vào lớp, không phải mã cấp quyền giáo
  viên.
- Phạm vi thay đổi (chỉ đường cấp quyền giáo viên, không động tới mã
  lớp): app/actions/onboarding.ts bỏ kiểm tra verifyTeacherInviteCode
  (completeOnboarding giờ chỉ nhận role); components/auth/
  onboarding-form.tsx bỏ ô nhập mã mời giáo viên; xóa lib/
  teacher-invite.ts (chỉ còn onboarding dùng tới); sửa comment ở
  lib/auth.ts. Mã lớp không đổi gì: classes.inviteCode, uniqueInviteCode,
  joinClass, joinClassSchema 6 ký tự, QR/mã ở tab Lớp giữ nguyên.
- Hệ quả CHẤP NHẬN (đã nói rõ với GV): ai cũng tự đăng ký làm giáo
  viên được — kể cả dùng AI (hiện AI tính vào chi phí vận hành cho tới
  khi hệ gói/quyền lên). Với quy mô pilot (3 lớp) thì rủi ro thấp;
  khi mở rộng thì hệ gói/quyền (§12, admin gagabux95@gmail.com) mới là
  chỗ siết lại. Biến môi trường TEACHER_INVITE_CODE trên Vercel từ
  đây không còn được code đọc tới — để lại cũng vô hại, dọn sau cũng
  được.
- Ranh giới giữ nguyên: vai trò vẫn chỉ có student/teacher (không có
  role admin trong code); đã onboard rồi thì không tự đổi vai trò qua
  đường này; đăng ký luôn tạo student, client không tự gửi role.
- Kiểm chứng: tsc sạch; suite 35/42 (nguyên 7 lỗi cũ).

## 24. Sửa takeFirstTfBlock: "a." giữa dòng không phải mốc ý mới (2026-10-25)
- Triệu chứng: việc AI Bài 1 (job 9ae1fe5f) — câu TF P2 Câu 8 có ý a
  "Genee A có chiều dài lớn hơn genee a." bị đọc thành 1 ý + báo
  leftover, chặn nộp (validate errors ở dòng 409).
- Nguyên nhân: takeFirstTfBlock tìm "a." thứ hai trong khối ý để tách
  câu thừa, với regex /(^|[\s\u00A0])\s*([aA][.)])/ — "genee a." (tên
  allele a + dấu chấm cuối ý) bị nhận nhầm thành mốc ý mới.
- Sửa (lib/worksheet-parser.ts): regex thành /(^|\n)\s*([aA][.)])/ —
  chỉ tính "a." ở đầu dòng. Các ý luôn bắt đầu ở đầu dòng (renderer
  viết mỗi ý một dòng, optionBuffer nối bằng \n) nên trường hợp câu
  thừa thật (ý của câu sau bắt đầu ở đầu dòng) vẫn tách đúng; "a."
  giữa dòng không còn cắt oan.
- Không sửa isTailHeading trong đợt này: dòng "Đáp án cần chọn là: C"
  đứng riêng cuối lời giải Câu 35 cũng từng làm TF/SA biến mất
  (isTailHeading tưởng là tiêu đề phần đáp án) — đã xử lý ở bước gộp
  của việc (nối dòng, giữ nguyên chữ); sửa code cho điểm này để dành
  đợt sau nếu GV chốt.
- Kiểm chứng: mô phỏng Bài 1 (render→parse→validate→verify) PASS:
  19 KP, 56 câu, 0 lỗi; check-parser phien 3/4/5/7 OK, phien 6/8 vẫn
  lỗi cũ y hệt bản gốc (đã đối chiếu bằng git stash);
  check-ai-pipeline OK.

## 25. Câu hỏi cấp bài học: AI gắn theo KP, nạp thường tách riêng (GV chốt 2026-10-25)
- Chốt: (a) Đường AI (GV upload + bấm "Sử dụng AI"): worker gắn mỗi
  câu hỏi vào KP mà nó kiểm tra (khớp theo nghĩa, cùng chuẩn như gắn
  lời giải); câu nào không map được vào đúng một KP thì để ở cấp bài
  học, KHÔNG dồn về KP cuối. (b) Đường nạp thường: phần trắc nghiệm
  tách riêng ở cấp bài học, không gắn vào KP cuối nữa. (c) Bản xem
  trước vốn đã trình bày KP ở trên, trắc nghiệm ở dưới — đúng mô hình
  này nên không vỡ giao diện. Tab 4: bài toàn câu cấp bài học thì hiện
  đủ theo thứ tự MC → TF → trả lời ngắn (đúng thứ tự tài liệu), không
  lấy mẫu ngẫu nhiên; câu cấp bài học bỏ qua spaced repetition vì
  không có KP để ghi.
- Dữ liệu: ParsedLesson thêm `questions: ParsedQuestion[]` (lưu với
  knowledgePointId NULL; schema đã cho phép null từ trước). KP giữ
  `questions` riêng cho câu gắn KP (đường AI + tài liệu xen kẽ).
- Parser (lib/worksheet-parser.ts): `parseTextContent(text, opts)` với
  `questionScope: "kp" | "lesson"` (mặc định "kp" = hành vi cũ).
  Chỉ thị `@@LESSON-QUESTIONS@@` trong văn bản chuyển các câu sau nó
  sang cấp bài học, tắt khi gặp dòng KP / bài / chương mới (đường AI
  xen kẽ được: câu gắn KP rồi câu chung rồi lại câu gắn KP). Đường
  thường dùng questionScope "lesson": mọi câu đều cấp bài học.
  validateDocument kiểm tra CÙNG LUẬT cho cả hai loại câu (BUG-09,
  BUG-07, đủ 4 lựa chọn, đúng 1 đáp án, SA có đáp án) — vòng kiểm tra
  dời ra ngoài vòng KP để mỗi câu kiểm tra đúng một lần; summarize,
  attachBodyHtml/attachOptionBodyHtml cộng cả câu cấp bài học. Các hàm
  này chịu được lesson dựng tay thiếu trường questions (`?? []`).
- Đường thường (khớp nhau ở mọi cửa, tránh xem trước một đằng lưu
  một nẻo): extract-file.ts (cả .txt/.docx/.pdf) dùng lesson mode —
  bao cả validate preview lẫn save từ file; importer (draft resume,
  error-fix khi không phải AI) dùng lesson mode; save route nhận cờ
  questionScope từ client (bản nháp thường đã sửa -> lesson; bản AI
  -> mặc định theo chỉ thị trong text). Đường AI (jobs.ts, importer
  resultText) giữ mặc định kp + chỉ thị.
- Đường AI: AiLesson thêm `lessonQuestions?: AiQuestion[]`; render.ts
  dựng câu chung sau chỉ thị (dùng chung hàm dựng câu với câu trong
  KP); verify.ts đối chiếu cả câu chung (flatten + kiểm tra số câu
  theo từng bài) — thứ tự phẳng hoá = câu trong KP rồi câu chung,
  khớp filledAnswers và thứ tự persist. Skill ai_worker_processing
  thêm luật §25: gắn theo nghĩa, cấm dồn về KP cuối, lessonQuestions
  chỉ là ngoại lệ cho câu không map được, merge và duplicate-shortcut
  giữ nguyên vị trí.
- Lưu (lib/worksheet-import.ts): insertParsedQuestion nhận kpId null;
  tạo bài mới lưu câu chung sau câu trong KP (nối tiếp qOrder);
  nạp cộng thêm: computeAppendPlan thêm tham số câu chung, chống trùng
  cùng bộ seen với câu trong KP, lưu với KP null. Preview-doc: khối
  "Trắc nghiệm chung của bài" sau khối KP, dùng chung khối hiển thị
  câu hỏi (đánh số Câu N nối tiếp). Trang chi tiết bài của GV không
  cần sửa: getLessonQuestions đã lấy đủ câu theo lessonId, câu null-KP
  vốn đã hiện ở khung câu hỏi "chưa gắn" và kéo-thả được vào KP.
- Tab 4 (lib/quiz-selection.ts): thêm mode "lesson" — khi không câu
  nào gắn KP mà bài có câu hỏi thì trả đủ, xếp theo order. Nhánh
  random cũ (mẫu 18 MC + 4 TF + 6 SA) chỉ còn cho đầu vào rỗng (caller
  đã chặn bài không có câu hỏi từ trước). Nộp bài đã lọc
  knowledgePointId null khỏi seed SR từ trước nên không cần sửa SR.
- Kiểm chứng: tsc sạch; test mới ~/workspace/.epg/test-lesson-questions-25.mjs
  25/25 (lesson scope, kp mặc định, AI xen kẽ + verify, tắt chỉ thị ở
  KP mới, BUG-09 cho câu chung, Tab 4 lesson/mixed, dedupe nạp thêm);
  sim Bài 1 PASS (19 KP, 56 câu, verify sạch — đường mặc định không
  đổi); suite 35/42, đúng 7 lỗi cũ (class-phien1/2/3/6, parser-phien6/8,
  preview-phien3). Lưu ý khi đối chiếu: 6 script (parser-phien4/5/7,
  preview-phien1/6, scoring-phien2) ban đầu đỏ vì đếm câu chỉ qua
  kp.questions — đã cập nhật phần flatten sau extractAndParse sang
  cộng cả câu cấp bài học (đúng hợp đồng mới), riêng scoring-phien2
  đỏ vì lesson dựng tay thiếu trường questions — đã khỏi nhờ `?? []`;
  sau cập nhật, phien8 trở lại đúng thông điệp lỗi cũ ("qua nhieu loi
  gia 11") như bản gốc.
- Chưa push: code mới ở local (master = 2d439bb + thay đổi §25 chưa
  commit) — chờ GV đưa PAT mới rồi mới commit + push như mọi lần.
