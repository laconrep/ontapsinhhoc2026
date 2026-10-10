# Ke hoach sua logic cham diem (8 phien)

Trang thai: **phien 7 xong**. Day la nguon su that cho 8 phien. Phien sau CHI doc file nay + dung cac file liet ke trong phien do. KHONG doc lai toan repo. KHONG lam phan hoan (muc 3).

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
| 8 | Live answers DB, scoring chung live, giu option id, firstTry | chua |

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
  - Test: computeOverallStatus sau reset theo SA; score cap 10.
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
- Con lai / lech ke hoach:
- File da doi:

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
