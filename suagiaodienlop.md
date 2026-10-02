# Kế hoạch: Giao bài giảng cho lớp + Thống kê kết quả ôn tập (6 phiên)

Mục tiêu: Trong trang chi tiết mỗi lớp học (`/teacher/classes/[id]`) bổ sung
(1) chức năng **giao bài giảng** từ kho bài giảng đã import cho lớp, có **hạn hoàn thành**;
(2) màn **thống kê kết quả ôn tập** của học sinh, có **điểm quiz tính vào đánh giá**.

Trạng thái: **chưa code**. File này là nguồn sự thật. Phiên sau CHỈ đọc file này +
đúng các file nêu trong phiên đó, KHÔNG đọc lại toàn repo.

Nhánh làm việc: tạo một nhánh `261003-feat-giao-bai-thong-ke-lop` từ nhánh hiện tại
(`261002-feat-ui-header-sidebar-import`) ở **Phiên 1**, rồi commit + push mỗi phiên.

Quy ước commit mỗi phiên: `wip(class): phien N - <tom tat>`.
Mỗi phiên: làm -> tự kiểm bằng script/node -> điền "Báo cáo phiên N" -> commit + push.

KHÔNG commit `package-lock.json`, `tsconfig.tsbuildinfo`, `scripts/dump-*.mjs` (nếu có tạo).

---

## 0. Quyết định đã chốt với người dùng (không hỏi lại)

1. Giao được **nhiều bài cùng lúc**, **cả lớp** (mặc định; chưa cần chọn từng HS).
2. **Có hạn hoàn thành** (`dueAt`, tuỳ chọn) + hiển thị cảnh báo sắp đến hạn / quá hạn.
3. **Điểm quiz được tính vào đánh giá** (không chỉ tham khảo).
4. Không đụng parser, màn nạp file, màn trình chiếu quiz, Ctrl+click gạch chân KP.
5. Không thêm thư viện mới (biểu đồ dùng thanh CSS hiện có, giống `StatBar`).

---

## 1. Phát hiện đã kiểm chứng (khỏi điều tra lại)

### Schema (`lib/db/schema.ts`, 410 dòng)
- `user` 20, `session` 33, `account` 46, `verification` 64.
- `classes` 77 (id, name, subject, teacherId, inviteCode, schoolYear, createdAt).
- `classStudents` 89 (classId, studentId) — HS thuộc lớp.
- `chapters` 103, `lessons` 113 (teacherId, chapterId, order, status enum draft/processing/ready/error).
- `knowledgePoints` 131 (lessonId, content, underlinedTerms jsonb, order).
- `questions` 141, `questionOptions` 154.
- `studentProgress` 165: PK (studentId, knowledgePointId); `selfAssessment` known/unknown;
  `fillStatus`, `dragStatus` correct/incorrect; `overallStatus` not_started/known/unknown/mastered;
  `fillAttempts`, `dragAttempts`, `updatedAt`.
- `studentTab1Submissions` 192 (studentId, lessonId, assessments jsonb, submittedAt, isLocked).
- `quizAttempts` 205 (studentId, lessonId, score, maxScore, totalSlots, startedAt, completedAt, isAutoSaved).
- `quizAnswers` 227 (attemptId, questionId, studentAnswer, isCorrect).
- `quizAutosave` 239. `spacedRepetition` 259 (studentId, knowledgePointId, interval, easinessFactor, nextReview, repetitions).
- `lessonPlans` 280. `sessions` 295. `sessionEvents` 315 (sessionId, studentId, eventType, questionId, payload, createdAt).
- `worksheets` 335, `worksheetSections` 352, `worksheetQuestions` 361, `worksheetAttempts` 371,
  `worksheetAnswers` 384, `classWorksheets` 397 (classId, worksheetId, assignedAt, dueAt) — **chưa dùng**.
- KHÔNG có bảng giao **bài giảng** cho lớp -> Phiên 1 thêm `class_assignments` (KHÔNG dùng `classWorksheets`).

### Migrate
- Repo không có thư mục migrate. `ensureSchema()` trong `lib/db/index.ts:18` chỉ chạy
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "bodyHtml"` (2 câu) và lưu promise 1 lần.
- **Cách thêm bảng mới**: nối thêm câu `CREATE TABLE IF NOT EXISTS ...` vào chuỗi
  `.then(...)` trong `ensureSchema`. Gọi `await ensureSchema()` ở đầu action mới (đã có
  tiền lệ `live-quiz.ts:82`). DDL phải khớp `schema.ts` (xem Phiên 1 mục 3).

### Trang lớp học giáo viên
- `app/teacher/classes/[id]/page.tsx`: gọi `getClassDetail(id)` (bắt buộc), rồi
  try/catch `getClassStats(id)`, `getActiveSessionForClass(id)`, `getDraftSessions(id)`.
  Render theo thứ tự: `<ClassDetail>`, `<SessionControl>`, `<ClassStatsPanel>`.
- `components/teacher/class-detail.tsx` (233 dòng): mã mời + QR + danh sách HS + xoá HS.
  Props `{ cls: ClassDetailData }`. Không có tab.
- `components/teacher/session-control.tsx`: quiz trình chiếu; `getLessonsForQuiz()` trả
  `QuizLessonOption[]`; `startQuizSession`, `createDraftSession`...
- `components/teacher/class-stats-panel.tsx` (157 dòng): client, 2 tab "Học sinh" /
  "Điểm kiến thức", `StatBar` cục bộ, nhận `{ stats: ClassStatsDto }`.
- `app/actions/class-stats.ts` `getClassStats(classId)`:
  - Xác thực lớp thuộc GV; lấy HS của lớp; lấy KP của các `lessons.status='ready'` thuộc GV.
  - Trả `{ students: StudentStatRow[], knowledgePoints: KPStatRow[] }`.
  - `StudentStatRow`: knownCount, unknownCount, overconfidentCount, masteredCount, progress.
  - `KPStatRow`: knownPercent, overconfidentPercent, reinforcedPercent.
  - overconfident = selfAssessment='known' AND fillStatus='incorrect'.

### Màn học sinh
- `app/student/learn/page.tsx`: `getStudentLessons()` (từ `app/actions/student-class.ts:61`)
  trả `ChapterDto[]`; render `LessonAccordion` (`components/student/lesson-accordion.tsx`).
- `getStudentLessons()` hiện trả **tất cả** bài ready của GV dạy lớp HS — chưa biết bài nào
  được giao. Phiên 3 phải đánh dấu "Được giao".
- `app/student/page.tsx`: trang chủ HS, hiện lớp + phiên live; Phiên 3 có thể thêm "Bài cần làm".
- `app/actions/student-stats.ts`:
  - `getStudentStats()` (69): streak, totalReviewed, badges, weeklyProgress, lessonProgress.
  - `getQuizProgress()` (200): theo từng lesson trả `attempts, firstScore, latestScore,
    bestScore, improvement, lastAttemptAt` (thang 10).
- `app/actions/student-class.ts`: `joinClass`, `getMyClasses`, `getStudentLessons`.

### Điểm gắn đánh giá (dữ liệu sẵn có)
- Hoàn thành bài giao: suy ra từ `studentProgress` (overallStatus != not_started cho các KP
  của lesson) HOẶC có `quizAttempts.completedAt` cho lesson.
- Điểm quiz: `quizAttempts.score / maxScore` (tính TB, best, lần gần nhất, xu hướng).
- Chỉ số chẩn đoán: `studentProgress` (known/unknown/mastered/overconfident).
- Hoạt động gần nhất: max(`studentProgress.updatedAt`, `quizAttempts.completedAt`,
  `studentTab1Submissions.submittedAt`).
- Chuỗi ngày học: tái dùng logic `computeStreak` trong `student-stats.ts` (nhưng cần bản
  theo từng HS cho cả lớp — Phiên 4 tự viết helper gọn, không export lại).

### Kiểm thử
- Project dùng `npx tsx scripts/check-*.mjs` (xem `scripts/check-preview-phien4.mjs`).
- `package.json` scripts: `dev`, `build`, `start`, `lint` (`eslint .`). Không có typecheck
  riêng; `node_modules` có thể chưa cài. Nếu chưa có `node_modules`, chạy
  `npx tsx ...` vẫn được (npx tải tạm), còn `tsc` phải cài `typescript` local mới có.
  Ghi rõ kết quả thực tế vào Báo cáo phiên.

---

## 2. Thiết kế đánh giá (chỉ số) — chốt

### A. Tổng quan lớp
- `completionRate`: % HS có hoạt động trên các bài được giao.
- `masteryRate`: mastered / tổng KP của bài được giao.
- `avgQuiz`: điểm quiz TB (%) trên mọi attempt đã hoàn thành; `medianQuiz`: trung vị.
- `atRiskCount`: số HS "cần chú ý" (điều kiện ở C).
- `weeklyActivity`: số hoạt động 7 ngày gần nhất.

### B. Theo bài giao (assignment)
- `completedCount / totalStudents` và `completionPercent`.
- `avgScore`, `bestScore`, phân bố 4 mức: 0–20 / 20–50 / 50–80 / 80–100 (%).
- `onTimeCount`, `lateCount`, `overdueCount` (chưa xong và `now > dueAt`).
- `weakKpIds`: các KP lớp yếu (knownPercent < 50 hoặc overconfidentPercent >= 30).

### C. Theo học sinh (đánh giá)
- `status`: not_started | in_progress | completed | overdue.
- `progress`: KP đã chạm / tổng KP bài giao (%).
- `masteredCount`, `knownCount`, `unknownCount`, `overconfidentCount` (giữ nguyên nghĩa cũ).
- `quizAvg` (%), `quizBest` (%), `quizAttempts` (số), `trend` (latest − first, thang 10).
- `weakKpCount`: số KP overallStatus='unknown' hoặc (selfAssessment='known' & fillStatus='incorrect').
- `streak` và `lastActivityAt`.
- `atRisk`: `unknownCount + overconfidentCount >= 3` HOẶC `overdue` HOẶC `quizAvg < 50`
  (có làm ít nhất 1 attempt). Hiển thị cảnh báo.

### D. Theo điểm kiến thức
- Giữ knownPercent / overconfidentPercent / reinforcedPercent.
- Thêm `firstTryPercent`: % HS làm đúng ngay lần đầu (suy từ `quizAnswers` của attempt đầu).
- `hardFlag`: knownPercent < 50 && (overconfidentPercent >= 20 || firstTryPercent < 40).

---

## 3. Sáu phiên code

### Phiên 1 — DB + types + server actions giao bài

**Mục tiêu:** Có nền dữ liệu và action để giao/thu hồi/đổi hạn bài giảng, chưa cần UI đẹp.

**Việc làm**
1. `lib/db/schema.ts`: thêm bảng (đặt sau `classWorksheets`):
   ```ts
   export const classAssignments = pgTable(
     "class_assignments",
     {
       id: uuid("id").primaryKey().defaultRandom(),
       classId: uuid("classId").notNull().references(() => classes.id, { onDelete: "cascade" }),
       lessonId: uuid("lessonId").notNull().references(() => lessons.id, { onDelete: "cascade" }),
       teacherId: text("teacherId").notNull().references(() => user.id, { onDelete: "cascade" }),
       dueAt: timestamp("dueAt"),
       note: text("note"),
       createdAt: timestamp("createdAt").notNull().defaultNow(),
     },
     (t) => ({
       byClass: index("ca_class_idx").on(t.classId),
       uniqClassLesson: unique("ca_class_lesson_unique").on(t.classId, t.lessonId),
     }),
   )
   ```
   Chú ý `index`/`unique` đã import sẵn ở đầu file (dòng 12–13).
2. `lib/db/index.ts` `ensureSchema`: nối thêm
   `.then(() => pool.query('CREATE TABLE IF NOT EXISTS "class_assignments" (...)'))`
   với DDL khớp schema: id uuid pk default gen_random_uuid(), "classId" uuid not null
   references classes(id) on delete cascade, "lessonId" uuid not null references lessons(id)
   on delete cascade, "teacherId" text not null references "user"(id) on delete cascade,
   "dueAt" timestamp, note text, "createdAt" timestamp not null default now(),
   + unique ("classId","lessonId"), + index ca_class_idx ("classId").
   Giữ nguyên 2 câu ALTER cũ.
3. `types/index.ts` thêm:
   ```ts
   export interface ClassAssignmentDto {
     id: string
     classId: string
     lessonId: string
     lessonTitle: string
     chapterTitle: string
     dueAt: string | null
     note: string | null
     createdAt: string
   }
   export interface AssignedLessonDto {
     lessonId: string
     lessonTitle: string
     chapterTitle: string
     dueAt: string | null
     note: string | null
     studentStatus: "not_started" | "in_progress" | "completed" | "overdue"
     progressPercent: number
   }
   ```
4. Tạo `app/actions/assignments.ts` ("use server"):
   - `assignLessons(classId, lessonIds: string[], dueAt?: string | null, note?: string | null)`:
     `requireRole("teacher")`; xác thực lớp thuộc GV; lọc lessonReady thuộc GV
     (`lessons.teacherId = teacher.id AND status='ready'`) trong `lessonIds`; insert
     `onConflictDoNothing` (unique classId+lessonId); `revalidatePath('/teacher/classes/'+classId)`;
     trả `{ assigned: number, skipped: number }`.
   - `getClassAssignments(classId): Promise<ClassAssignmentDto[]>`: join `classAssignments`
     → `lessons` → `chapters`; xác thực lớp thuộc GV; order theo `createdAt desc`.
   - `updateAssignment(classId, id, { dueAt?, note? })`: xác thực lớp thuộc GV rồi update.
   - `removeAssignment(classId, id)`: xác thực lớp thuộc GV rồi delete; revalidate.
   - `getAssignedLessonsForStudent(): Promise<AssignedLessonDto[]>`: `requireRole("student")`;
     lấy các lớp HS thuộc; join assignments theo classId; tính `studentStatus` +
     `progressPercent` từ `studentProgress` + `quizAttempts` cho chính HS; status:
     completed nếu progressPercent>=100 hoặc có quiz attempt completed; overdue nếu chưa xong
     và dueAt < now; in_progress nếu chạm >0 KP; còn lại not_started.
5. Script `scripts/check-class-phien1.mjs`: kiểm thuần DDL/type bằng string + test
   `assignLessons` shape không cần DB (nếu không có DB, assert export hàm tồn tại + regex DDL
   trong `lib/db/index.ts`). Ghi rõ nếu bỏ qua phần cần DB.

**File:** `lib/db/schema.ts`, `lib/db/index.ts`, `types/index.ts`,
`app/actions/assignments.ts` (mới), `scripts/check-class-phien1.mjs` (mới).

**Kiểm thử:** `npx tsx scripts/check-class-phien1.mjs`. Nếu `node_modules` có, `npm run build`
hoặc `npx tsc --noEmit`.

**Commit:** `wip(class): phien 1 - db va action giao bai`

**Báo cáo phiên 1 (điền sau khi code):**
- Đã làm: Thêm bảng `class_assignments` (unique classId+lessonId, index ca_class_idx). `ensureSchema` CREATE TABLE + INDEX, giữ 2 ALTER bodyHtml. Types `ClassAssignmentDto`/`AssignedLessonDto`. Action giao nhiều bài (`onConflictDoNothing`), list, sửa hạn/ghi chú, thu hồi, HS lấy bài giao + status. Tách helper `deriveStudentAssignmentStatus` để test không cần DB.
- File đã sửa/tạo: `lib/db/schema.ts`, `lib/db/index.ts`, `types/index.ts`, `app/actions/assignments.ts` (mới), `lib/assignment-status.ts` (mới), `scripts/check-class-phien1.mjs` (mới)
- Kiểm thử: `npx tsx scripts/check-class-phien1.mjs` OK. Bỏ qua DB thật (không có drizzle local). `tsc` không chạy (chưa cài node_modules).
- Việc tiếp theo (phiên 2): tab UI "Bài tập đã giao".

---

### Phiên 2 — UI giáo viên: giao bài + danh sách bài đã giao

**Mục tiêu:** GV giao nhiều bài, đặt hạn/ghi chú, xem danh sách và tiến độ lớp ở mức cơ bản.

**Việc làm**
1. Tạo `components/teacher/class-assignments.tsx` (client):
   - Props `{ classId: string; initial: ClassAssignmentDto[] }`.
   - Nút `+ Giao bài giảng` mở `Dialog`: tải danh sách bài ready bằng action mới
     `getAssignableLessons()` (thêm vào `app/actions/assignments.ts`: join chapters+lessons
     status='ready' teacherId=GV, trả `{ id, title, chapterTitle }[]`); chọn nhiều bằng
     checkbox, nhóm theo chương; input `dueAt` (type datetime-local, tuỳ chọn); textarea note.
   - Gọi `assignLessons`, toast, `router.refresh()`.
   - Danh sách thẻ bài giao: tên bài + chương, hạn (badge đỏ nếu quá hạn, vàng nếu < 3 ngày),
     ghi chú, menu `Sửa hạn` / `Thu hồi`.
2. `components/teacher/class-detail.tsx`: thêm tab. Cách gọn: tạo
   `components/teacher/class-tabs.tsx` (client) nhận `{ cls, assignments }` và render
   3 nút tab; tab "Tổng quan" = nội dung `ClassDetail` hiện tại, tab "Bài tập đã giao" =
   `ClassAssignments`, tab "Thống kê" = slot children (Phiên 5 truyền `ClassStatsPanel`).
   Để không phá vỡ page hiện tại, Phiên 2 chỉ dựng tab Tổng quan + Bài tập đã giao; tab
   Thống kê render `<ClassStatsPanel stats={stats} />` truyền từ page.
3. `app/teacher/classes/[id]/page.tsx`: gọi `getClassAssignments(id)` (try/catch fallback `[]`),
   truyền vào `ClassTabs` thay vì render rời `ClassDetail` + `ClassStatsPanel`.
   Giữ `SessionControl` (đặt trong tab Tổng quan hoặc dưới cùng — chọn dưới tab Tổng quan).

**File:** `components/teacher/class-assignments.tsx` (mới),
`components/teacher/class-tabs.tsx` (mới), `components/teacher/class-detail.tsx`,
`app/teacher/classes/[id]/page.tsx`, `app/actions/assignments.ts`.

**Kiểm thử:** `npx tsx scripts/check-class-phien2.mjs` (assert import component + string
có nhánh tab/checkbox). Build nếu được.

**Commit:** `wip(class): phien 2 - UI giao bai va danh sach`

**Báo cáo phiên 2 (điền sau khi code):**
- Đã làm: Action `getAssignableLessons` (ready, nhóm theo chương). Tab Tổng quan / Bài tập đã giao / Thống kê. Dialog giao nhiều bài (checkbox, datetime-local, note), danh sách thẻ + badge hạn đỏ/vàng, menu Sửa hạn / Thu hồi. Page gọi `getClassAssignments` fallback `[]`, SessionControl nằm tab Tổng quan.
- File đã sửa/tạo: `app/actions/assignments.ts`, `components/teacher/class-assignments.tsx` (mới), `components/teacher/class-tabs.tsx` (mới), `app/teacher/classes/[id]/page.tsx`, `scripts/check-class-phien2.mjs` (mới)
- Kiểm thử: `npx tsx scripts/check-class-phien2.mjs` OK. `tsc` không chạy (chưa cài node_modules).
- Việc tiếp theo (phiên 3): phía học sinh thấy bài được giao.

---

### Phiên 3 — Phía học sinh: bài được giao + hạn + trạng thái

**Mục tiêu:** HS biết bài nào được giao, hạn, trạng thái; có mục "Bài cần làm".

**Việc làm**
1. `components/student/lesson-accordion.tsx`: nhận thêm prop tuỳ chọn
   `assignmentByLessonId?: Record<string, AssignedLessonDto>`; mỗi bài giao hiện badge
   "Được giao", hạn, trạng thái; sắp các bài giao lên đầu chương hoặc tách mục riêng.
2. `app/student/learn/page.tsx`: gọi thêm `getAssignedLessonsForStudent()`; build map; truyền
   vào `LessonAccordion`.
3. `app/student/page.tsx`: thêm section "Bài cần làm" (các bài `not_started`/`in_progress`/
   `overdue`, ưu tiên quá hạn) link tới `/student/learn/[lessonId]`.
4. Tạo `components/student/assigned-work.tsx` cho danh sách trên (client hoặc server
   component thuần). Badge màu theo trạng thái: xám/xanh/vàng/đỏ.

**File:** `components/student/lesson-accordion.tsx`, `app/student/learn/page.tsx`,
`app/student/page.tsx`, `components/student/assigned-work.tsx` (mới).

**Kiểm thử:** `npx tsx scripts/check-class-phien3.mjs` (assert trạng thái suy đúng với
dữ liệu giả: progress 0 -> not_started; có attempt -> completed; dueAt quá khứ + chưa xong
-> overdue).

**Commit:** `wip(class): phien 3 - hoc sinh thay bai duoc giao`

**Báo cáo phiên 3 (điền sau khi code):**
- Đã làm: Accordion nhận `assignmentByLessonId`, badge "Được giao" + hạn + trạng thái, bài giao lên đầu chương. Learn page gọi `getAssignedLessonsForStudent` rồi truyền map. Trang chủ HS có mục "Bài cần làm" (not_started/in_progress/overdue, ưu tiên quá hạn) link `/student/learn/[id]`. Badge xám/xanh/vàng/đỏ theo trạng thái.
- File đã sửa/tạo: `components/student/lesson-accordion.tsx`, `app/student/learn/page.tsx`, `app/student/page.tsx`, `components/student/assigned-work.tsx` (mới), `scripts/check-class-phien3.mjs` (mới)
- Kiểm thử: `npx tsx scripts/check-class-phien3.mjs` OK. `tsc` không chạy (chưa cài node_modules).
- Việc tiếp theo (phiên 4): thống kê backend.

---

### Phiên 4 — Backend thống kê lớp (điểm quiz + đánh giá)

**Mục tiêu:** Action trả đủ chỉ số mục 2 (A/B/C/D), tính điểm quiz vào đánh giá.

**Việc làm** (mở rộng `app/actions/class-stats.ts`, thêm `app/actions/assignments.ts` nếu cần)
1. Thêm helper dùng chung trong `class-stats.ts` (không export nếu không cần):
   - `assignmentLessonIds(classId)`: các lessonId trong `classAssignments` của lớp.
   - `studentActivity(studentId, lessonIds)`: max updatedAt + completedAt + submittedAt.
2. Mở rộng `getClassStats` trả thêm (giữ tương thích): trong `StudentStatRow` bổ sung
   `quizAvg`, `quizBest`, `quizAttempts`, `trend`, `lastActivityAt`, `weakKpCount`, `atRisk`.
   Cập nhật `types/index.ts` `StudentStatRow` (thêm field optional để không vỡ UI cũ).
   Truy vấn thêm `quizAttempts` (join theo HS + lessonId thuộc lớp/GV) và `quizAnswers`
   cho firstTry nếu cần.
3. `getClassStats` thêm trả `overview` + `assignments`:
   ```ts
   export interface ClassOverviewStats {
     completionRate: number; masteryRate: number; avgQuiz: number; medianQuiz: number;
     atRiskCount: number; weeklyActivity: number;
   }
   export interface AssignmentStatRow {
     assignmentId: string; lessonId: string; lessonTitle: string; chapterTitle: string;
     dueAt: string | null; completedCount: number; totalStudents: number; completionPercent: number;
     avgScore: number; bestScore: number; distribution: { band: string; count: number }[];
     onTimeCount: number; lateCount: number; overdueCount: number; weakKpIds: string[];
   }
   export interface ClassStatsDto { students; knowledgePoints; overview; assignments }
   ```
   Cập nhật type `ClassStatsDto` (overview/assignments bắt buộc, tính rỗng khi không có).
   LƯU Ý: page hiện khởi tạo `stats = { students: [], knowledgePoints: [] }` — cập nhật
   fallback này cho khớp type mới (thêm overview/assignments mặc định).
4. `KPStatRow` thêm `firstTryPercent` + `hardFlag` (tính từ `quizAnswers` của attempt đầu).
5. Script `scripts/check-class-phien4.mjs`: test thuần hàm tính (tách hàm thuần
   `buildAssignmentStat(...)`, `buildOverview(...)` export để test không cần DB).

**File:** `app/actions/class-stats.ts`, `types/index.ts`,
`app/teacher/classes/[id]/page.tsx` (fallback stats), `scripts/check-class-phien4.mjs` (mới).

**Kiểm thử:** `npx tsx scripts/check-class-phien4.mjs`; `npm run build` nếu cài được.

**Commit:** `wip(class): phien 4 - backend thong ke lop`

**Báo cáo phiên 4 (điền sau khi code):**
- Đã làm: Tách hàm thuần `buildOverview`/`buildAssignmentStat`/`summarizeStudentQuiz`/`isAtRisk`. `getClassStats` trả `overview` + `assignments` + quizAvg/Best/Attempts/trend/lastActivityAt/weakKpCount/atRisk/status/streak; KP thêm firstTryPercent/hardFlag. Page fallback `emptyClassStats()`.
- File đã sửa/tạo: `lib/class-stats-calc.ts` (mới), `app/actions/class-stats.ts`, `types/index.ts`, `app/teacher/classes/[id]/page.tsx`, `scripts/check-class-phien4.mjs` (mới)
- Kiểm thử: `npx tsx scripts/check-class-phien4.mjs` OK. `tsc` không chạy (chưa cài node_modules).
- Việc tiếp theo (phiên 5): UI thống kê.

---

### Phiên 5 — UI thống kê lớp (dashboard)

**Mục tiêu:** Tab "Thống kê" trực quan, đủ A/B/C/D, có cảnh báo HS cần chú ý.

**Việc làm**
1. `components/teacher/class-stats-panel.tsx`: mở rộng thành 3 khối:
   - **Tổng quan**: 6 thẻ chỉ số (hoàn thành, nắm vững, quiz TB, trung vị, cần chú ý, tuần này).
   - **Theo bài giao**: bảng/thẻ mỗi assignment: tiến độ lớp, điểm TB, phân bố 4 mức
     (dùng `StatBar`), đúng hạn/trễ/quá hạn, KP yếu.
   - **Theo học sinh**: bảng sắp xếp được: trạng thái, tiến độ, quiz TB, trend (mũi tên),
     mastered/unknown/overconfident, weakKp, streak, hoạt động gần nhất; hàng `atRisk` tô đỏ nhạt;
     click mở rộng xem KP yếu (nếu có dữ liệu).
   Giữ tab "Điểm kiến thức" hiện tại, thêm cột `firstTryPercent`/`hardFlag`.
2. `ClassTabs` (Phiên 2) truyền `stats` vào tab Thống kê. Đảm bảo khi `stats` rỗng vẫn render
   thông báo phù hợp.
3. Giữ `StatBar` cục bộ; thêm helper `TrendArrow` nhỏ (lucide `ArrowUp/ArrowDown/Minus`).

**File:** `components/teacher/class-stats-panel.tsx`, `components/teacher/class-tabs.tsx`,
`app/teacher/classes/[id]/page.tsx` (nếu cần truyền thêm).

**Kiểm thử:** `npx tsx scripts/check-class-phien5.mjs` (assert render logic: status -> label,
atRisk -> tone); build nếu được.

**Commit:** `wip(class): phien 5 - UI thong ke lop`

**Báo cáo phiên 5 (điền sau khi code):**
- Đã làm: Tab Thống kê 3 khối. Tổng quan 6 thẻ (hoàn thành, nắm vững, quiz TB, trung vị, cần chú ý, tuần này). Theo bài giao: tiến độ, StatBar 4 mức, đúng hạn/trễ/quá hạn, KP yếu. Theo HS: sort, trend mũi tên, hàng atRisk tô đỏ, click xem KP yếu. Tab kiến thức thêm đúng lần đầu + cờ Khó. Empty state khi chưa có dữ liệu.
- File đã sửa/tạo: `components/teacher/class-stats-panel.tsx`, `lib/class-stats-ui.ts` (mới), `scripts/check-class-phien5.mjs` (mới)
- Kiểm thử: `npx tsx scripts/check-class-phien5.mjs` OK. `tsc` không chạy (chưa cài node_modules).
- Việc tiếp theo (phiên 6): e2e + chốt.

---

### Phiên 6 — E2E, rà soát, chốt

**Mục tiêu:** Đi hết luồng GV giao bài → HS thấy bài → GV xem thống kê; sửa bug lộ ra.

**Việc làm**
1. Script `scripts/check-class-phien6.mjs`:
   - Giao 2 bài ready (giả lập dữ liệu hoặc DB test nếu có) -> `getClassAssignments` có 2.
   - HS có progress 1 bài -> `getAssignedLessonsForStudent` trả đúng trạng thái.
   - `buildOverview`/`buildAssignmentStat` cho chỉ số đúng với input mẫu.
   - `getClassStats` shape có `overview` + `assignments` (nếu chạy được DB).
2. Rà soát UI: tab không vỡ, hạn quá khứ hiển thị đỏ, HS overdue thấy ở "Bài cần làm".
3. `npm run lint` (nếu `eslint` cài), `npm run build` nếu được; ghi rõ kết quả thực tế.
4. Cập nhật mục Trạng thái cuối file này.

**File:** `scripts/check-class-phien6.mjs` (mới), file bug nếu có, `suagiaodienlop.md`.

**Commit:** `wip(class): phien 6 - e2e va chot`

**Báo cáo phiên 6 (điền sau khi code):**
- Đã làm:
- File đã sửa/tạo:
- Kiểm thử:
- Việc tiếp theo: không.

---

## 4. Quy trình bắt buộc sau mỗi phiên

1. Tự kiểm bằng script trước khi commit.
2. Điền "Báo cáo phiên N" trong file này.
3. `git add` đúng file phiên; commit `wip(class): phien N - <tom tat>`; push.
4. Phiên sau chỉ đọc file này + file nêu trong phiên. Không đọc lại toàn repo.

## 5. Trạng thái

- Phiên hiện tại: xong 5.
- Phiên 1: xong
- Phiên 2: xong
- Phiên 3: xong
- Phiên 4: xong
- Phiên 5: xong
- Phiên 6: chưa

## 6. Việc không làm

- Không sửa parser, màn nạp file, trình chiếu quiz, Ctrl+click gạch chân.
- Không dùng bảng `classWorksheets` (kệ worksheet) cho giao bài giảng.
- Không thêm thư viện biểu đồ; không tự bịa migration runner.
- Không xoá dữ liệu hàng loạt; thao tác thu hồi bài giao chỉ xoá đúng 1 hàng theo id + quyền GV.
- Không đụng màn HS khác ngoài learn/home.
