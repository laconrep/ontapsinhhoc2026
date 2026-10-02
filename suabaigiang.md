# Kế hoạch sửa màn bài giảng: tách 2 khung + kéo thả câu hỏi vào điểm kiến thức (6 phiên)

Mục tiêu: sau khi GV import và fix lỗi xong, màn bài giảng `app/teacher/lessons/[id]` đổi thành 2 khung:
- **Khung trái = Bộ câu hỏi** (pool của cả bài), có 2 tab: **"Chưa gán"** và **"Tổng câu hỏi"**.
- **Khung phải = Điểm kiến thức**: bình thường thu gọn chỉ hiện số câu đã gán; click vào thì sổ ra danh sách câu hỏi của KP đó.
- GV **kéo câu hỏi từ khung trái thả vào một điểm kiến thức** để gán. Câu đã gán biến khỏi tab "Chưa gán" (nhưng vẫn thấy ở tab "Tổng câu hỏi"). Có thể kéo câu từ KP trả về khung câu hỏi (bỏ gán) và kéo đổi thứ tự trong KP.
- Khi tạo đề trắc nghiệm kiểm tra chuyên đề: nếu có câu đã gán thì **bố trí câu theo từng điểm kiến thức** (theo thứ tự KP rồi tới thứ tự câu đã kéo); nếu GV không kéo thả gì thì **ngẫu nhiên như hiện tại**.
- Chức năng **Chỉnh sửa điểm kiến thức** đổi sang đúng cơ chế của màn fix lỗi sau import: textarea sửa như Word, **Ctrl + click** để gạch chân bằng `applyKpWrap`, dấu `"..."` để hoán đổi, có preview tô ô trống trực tiếp.

---

## Quyết định đã chốt (không cần hỏi lại)

1. Câu đã gán vào KP thì ẩn khỏi tab "Chưa gán"; tab "Tổng câu hỏi" vẫn hiện đủ toàn bộ câu của bài.
2. Mỗi câu chỉ thuộc **1 KP** (hoặc chưa thuộc KP nào).
3. Giữ được **thứ tự câu trong mỗi KP**.
4. **Không giới hạn số câu / mỗi KP** (bỏ trần khi đã gán theo KP).
5. Cho phép kéo câu từ KP trả về khung câu hỏi (bỏ gán).
6. Cho phép đổi DB (thêm cột, cho `knowledgePointId` nullable).
7. Sửa KP bằng **dialog** (giữ dạng dialog hiện tại, chỉ đổi ruột editor).
8. Khi xoá một KP: câu đã gán trong KP đó **trả về pool "Chưa gán"** (không xoá câu). Đổi FK `questions.knowledgePointId` sang `ON DELETE SET NULL`.
9. Chế độ "ngẫu nhiên" (không có câu nào được gán) giữ nguyên trần cũ: MC ≤ 18, TF ≤ 4, SA ≤ 6. Chế độ "theo KP" lấy **toàn bộ** câu của từng KP, không cắt.

> Ghi chú lệch nhãn: người dùng gọi "tab 3" là chỗ tạo đề trắc nghiệm. Trong code, hàm `startQuiz` của HS đang phục vụ màn quiz (thực tế là tab 4 trong UI HS). Phiên 6 sửa cả `startQuiz` (HS) và đường chọn câu của live quiz để cùng dùng chung logic chia theo KP.

---

## Điểm mốc hiện tại (đọc phần này là đủ, không cần đọc lại toàn bộ code)

### Dữ liệu
- `lib/db/schema.ts`
  - `questions` (dòng 141-152): `knowledgePointId` **NOT NULL** FK → `knowledge_points.id` `onDelete: "cascade"`; có `type` enum `MC|TF|SA|FILL|DRAG`, `content`, `bodyHtml`, `difficulty`, `timeLimitSec`, `createdAt`. **Chưa có** `lessonId` và `order`.
  - `knowledgePoints` (dòng 131-139): có `lessonId`, `content`, `underlinedTerms` (jsonb), `order`.
  - `lessons` (dòng 113-129): có `teacherId`, `chapterId`, `status`.
- `lib/db/index.ts` (dòng 18-30): `ensureSchema()` chỉ chạy `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` cho `bodyHtml`; repo **không có file migrate/create table**, DB được cấp sẵn bên ngoài. Mọi thay đổi schema phải nhét vào `ensureSchema()`.
- Chưa có tên constraint cố định trong repo. Tên FK mặc định của drizzle cho `questions.knowledgePointId` là `questions_knowledgePointId_knowledge_points_id_fk` (cần dò động cho chắc, xem Phiên 1).

### Import
- `lib/worksheet-import.ts`
  - `persistParseResult` (dòng 85-211): với mỗi `pKp` insert `knowledgePoints`, rồi với mỗi `pQ` insert `questions` gắn `knowledgePointId: kpRow.id` và `questionOptions`. Đây là chỗ phải đổi: câu import vào **pool chưa gán** (`knowledgePointId = null`) + ghi `lessonId` + `order`.
  - `validateWorksheetBuffer` / `saveWorksheetBuffer` / `saveWorksheetFromText` giữ nguyên chữ ký.
- Parser `lib/worksheet-parser.ts`: `ParsedQuestion` đã có `type/content/options/correctAnswer/bodyHtml/line`. Parser gắn mọi câu vào KP đang hiện hành (`startQuestion`, dòng 411-419). **Không sửa parser** trong đợt này.

### Server actions
- `app/actions/content.ts`
  - `getLessonDetail(id)` (dòng 132-177): trả `lesson` + `knowledgePoints` mỗi KP có `questionCount` (count qua leftJoin `questions`).
  - `createKnowledgePoint(lessonId, content, underlinedTerms)`, `updateKnowledgePoint(id, content, underlinedTerms)`, `deleteKnowledgePoint(id)`: đã có; `deleteKnowledgePoint` xoá KP (cascade xoá câu).
- `app/actions/questions.ts`
  - `getQuestionBank()` (dòng 28-68): `innerJoin knowledgePoints` → sẽ **mất câu chưa gán** sau khi đổi schema, phải sửa.
  - `getQuestionsByKp(kpId)` (dòng 87-117): lọc theo `knowledgePointId`.
  - `createQuestion`, `updateQuestion`, `deleteQuestion`: `assertKpOwner` kiểm tra quyền qua join KP→lesson.
- `app/actions/student-learn.ts`
  - `getKpIdsOfLesson(lessonId)` (dòng 52-58).
  - `startQuiz(lessonId)` (dòng 487-584): gom toàn bộ câu của bài qua `inArray(questions.knowledgePointId, kpIds)`, rồi `seededShuffle(...).slice(0, 18/4/6)` (dòng 531-536). Đây là chỗ đổi sang chia theo KP.
- `app/actions/live-quiz.ts`
  - dòng 94-96 và 185: `innerJoin knowledgePoints` trên `questions.knowledgePointId` → sau khi nullable phải chuyển sang join theo `questions.lessonId` để không mất câu chưa gán.

### UI
- `components/teacher/lesson-detail.tsx` (306 dòng): màn hiện tại. Có state `kps`, `expanded`, dialog KP (`kpDialog`), `content`. Dialog dùng `deriveTerms(content, ...)` (dòng 54-68) tách từ khoá theo dấu ngoặc kép — **cơ chế sai**, sẽ thay. KP mở rộng render `<QuestionEditor knowledgePointId=... onChanged=... />` (dòng 253-257).
- `components/teacher/question-editor.tsx` (384 dòng): tự fetch `getQuestionsByKp`, có dialog tạo/sửa câu hỏi (MC/TF/SA) và list câu có nút sửa/xoá. Sẽ tách phần dialog thành `QuestionFormDialog` dùng chung.
- `components/teacher/import-error-fix.tsx`: mẫu cơ chế sửa đúng cần bê sang sửa KP:
  - textarea `value={blockEdit}`, `onMouseUp={wrapAtSelection}` (dòng 176-187) gọi `applyKpWrap` khi `ev.ctrlKey`.
  - revalidate bằng `parseTextContent` + `validateDocument` (dòng 81-98).
  - preview bằng `PreviewDocument` / `highlightBlanks`.
- `lib/kp-blank-wrap.ts`: `applyKpWrap(text, start, end)` — toggle `__...__` quanh từ/cụm, bỏ qua media và bullet KP. Dùng nguyên cho editor KP mới.
- `lib/worksheet-parser.ts`: `extractBlanks(raw)` → `{ content, underlinedTerms }`; `underlinedTerms` có `text, slotIndex, allowSwap, swapGroupId, extraAccepted, synonyms?`.
- `lib/worksheet-source-range.ts`: `blockRange`, `spliceBlock`, `LineRange` (dùng cho fix-import, không cần cho DnD).
- `@dnd-kit/core` và `@dnd-kit/sortable` **đã có trong `package.json`** — dùng luôn, không cài thêm.

### Types
- `types/index.ts`: `QuestionDto` (dòng 77-85) có `knowledgePointId: string` (đổi thành `string | null`), cần thêm `lessonId: string`. `KnowledgePointDto` giữ nguyên.

---

## File sẽ đụng tới (toàn bộ 6 phiên)

- `lib/db/schema.ts` — thêm `lessonId`, `order`; cho `knowledgePointId` nullable; đổi FK.
- `lib/db/index.ts` — migration trong `ensureSchema()`.
- `types/index.ts` — cập nhật `QuestionDto`.
- `lib/worksheet-import.ts` — insert câu vào pool chưa gán + `lessonId` + `order`.
- `app/actions/content.ts` — `getLessonDetail` trả kèm câu theo KP; sửa text confirm xoá KP.
- `app/actions/questions.ts` — action pool, `moveQuestion`, `reorderQuestions`; sửa `getQuestionBank`.
- `app/actions/student-learn.ts` — `startQuiz` chia theo KP.
- `app/actions/live-quiz.ts` — join theo `lessonId`.
- `components/teacher/lesson-detail.tsx` — viết lại layout 2 khung + DnD.
- `components/teacher/question-editor.tsx` — tách `QuestionFormDialog`, gọn lại.
- `components/teacher/kp-content-editor.tsx` — **tạo mới**: editor KP theo cơ chế fix-import.
- `lib/quiz-selection.ts` — **tạo mới**: logic chia câu theo KP / ngẫu nhiên.
- `lib/kp-render.ts` (hoặc thêm vào `lib/kp-blank-wrap.ts`) — **tạo mới**: `renderMarkedContent(content, terms)` để mở lại editor có marker; `extractBlanks` đã có sẵn để lưu.
- `components/teacher/question-form-dialog.tsx` — **tạo mới** (tách từ `question-editor.tsx`).
- `suabaigiang.md` — báo cáo mỗi phiên.

Không đụng: `lib/worksheet-parser.ts` (rule parse/validate), màn HS (`components/student/*`), `components/live/*` (trừ `app/actions/live-quiz.ts`), `lib/grading.ts`.

---

## Phiên 1 — Nền tảng dữ liệu (schema + migration + types + import)

### Mục tiêu
Mỗi câu hỏi có thể tồn tại **không thuộc KP nào** nhưng vẫn thuộc một bài; có thứ tự. Import đưa câu vào pool "Chưa gán". Chưa đổi UI/action khác ngoài mức cần để compile.

### Việc làm
1. `lib/db/schema.ts`:
   - `questions` thêm:
     - `lessonId: uuid("lessonId").notNull().references(() => lessons.id, { onDelete: "cascade" })`
     - `order: integer("order").notNull().default(0)`
   - Đổi `knowledgePointId` thành nullable và `onDelete: "set null"`:
     `knowledgePointId: uuid("knowledgePointId").references(() => knowledgePoints.id, { onDelete: "set null" })`.
2. `lib/db/index.ts` — mở rộng `ensureSchema()` chạy tuần tự (giữ chuỗi promise như cũ), thêm các bước:
   ```sql
   ALTER TABLE questions ADD COLUMN IF NOT EXISTS "order" integer NOT NULL DEFAULT 0;
   ALTER TABLE questions ADD COLUMN IF NOT EXISTS "lessonId" uuid;
   -- backfill lessonId từ KP cho dữ liệu cũ
   UPDATE questions q
      SET "lessonId" = kp."lessonId"
     FROM knowledge_points kp
    WHERE q."knowledgePointId" = kp.id AND q."lessonId" IS NULL;
   -- bỏ NOT NULL để cho phép câu chưa gán
   ALTER TABLE questions ALTER COLUMN "knowledgePointId" DROP NOT NULL;
   ```
   - Thêm FK `lessonId` nếu chưa có (dò theo `pg_constraint`):
     ```sql
     DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_lessonId_lessons_id_fk') THEN
         ALTER TABLE questions
           ADD CONSTRAINT "questions_lessonId_lessons_id_fk"
           FOREIGN KEY ("lessonId") REFERENCES lessons(id) ON DELETE CASCADE;
       END IF;
     END $$;
     ```
   - Đổi FK `knowledgePointId` sang SET NULL: dò tên FK hiện tại trên cột rồi drop + tạo lại SET NULL (an toàn hơn hard-code tên):
     ```sql
     DO $$
     DECLARE cname text;
     BEGIN
       SELECT conname INTO cname
         FROM pg_constraint
        WHERE conrelid = 'questions'::regclass
          AND contype = 'f'
          AND pg_get_constraintdef(oid) ILIKE '%knowledgePointId%';
       IF cname IS NOT NULL THEN EXECUTE format('ALTER TABLE questions DROP CONSTRAINT %I', cname); END IF;
       IF NOT EXISTS (
         SELECT 1 FROM pg_constraint
          WHERE conrelid = 'questions'::regclass AND contype='f'
            AND pg_get_constraintdef(oid) ILIKE '%knowledgePointId%'
       ) THEN
         ALTER TABLE questions ADD CONSTRAINT "questions_knowledgePointId_fk"
           FOREIGN KEY ("knowledgePointId") REFERENCES knowledge_points(id) ON DELETE SET NULL;
       END IF;
     END $$;
     ```
   - Sau khi backfill, set `lessonId` NOT NULL:
     ```sql
     ALTER TABLE questions ALTER COLUMN "lessonId" SET NOT NULL;
     ```
     (Chạy sau cùng; nếu bảng rỗng/có dữ liệu chuẩn thì OK. Nếu còn null do câu cũ mồ côi, gán bằng cách join `knowledge_points`.)
3. `types/index.ts`:
   - `QuestionDto`: `knowledgePointId: string | null`, thêm `lessonId: string`.
4. `lib/worksheet-import.ts` — trong vòng lặp `pKp.questions`:
   - Truyền `lessonId` (đã có biến `lessonId` trong `persistParseResult`).
   - `knowledgePointId: null` (câu vào pool chưa gán) thay vì `kpRow.id`.
   - Ghi `order: i` (chỉ số câu trong bài, tăng dần). Thêm biến đếm `qOrder` ngoài vòng `pKp`.
   - `questionOptions` vẫn gắn `questionId` như cũ (SA và MC/TF).
   - Lưu ý: KP vẫn được insert bình thường; chỉ câu là không gắn KP.
5. Các chỗ khác cần chỉnh tối thiểu để `tsc` xanh:
   - `app/actions/questions.ts`: `QuestionDto` mapping thêm `lessonId`, `knowledgePointId` có thể null. `getQuestionsByKp` vẫn ổn.
   - Bất kỳ chỗ nào gán `knowledgePointId: string` từ `QuestionDto` (đọc lại bằng `tsc`).

### Kiểm thử phiên 1
- Import 1 file mẫu → vào DB (hoặc query) thấy câu có `lessonId`, `knowledgePointId = null`, `order` tăng dần.
- `getQuestionsByKp` với KP bất kỳ trả rỗng (vì chưa gán) — đúng như thiết kế.
- Chạy `pnpm exec tsc --noEmit` (hoặc `npm run lint`) không lỗi type.

### Báo cáo phiên 1 (điền sau khi code)
- Đã làm:
- File đã sửa/tạo:
- Việc tiếp theo cho phiên 2:

---

## Phiên 2 — Server actions cho pool & di chuyển câu hỏi

### Mục tiêu
Có API server cho UI: lấy toàn bộ câu của bài (kèm KP đang gán), gán/bỏ gán câu, và lưu thứ tự câu trong KP.

### Việc làm
1. `app/actions/content.ts` — mở rộng `getLessonDetail`:
   - Trả thêm `questions: LessonQuestionItem[]` cho **cả bài** (để UI có 1 nguồn dữ liệu duy nhất), hoặc tách action riêng `getLessonQuestions(lessonId)` (khuyến nghị tách riêng để màn nhẹ hơn). Định nghĩa type dùng chung:
     ```ts
     export interface LessonQuestionItem {
       id: string
       lessonId: string
       knowledgePointId: string | null
       type: "MC" | "TF" | "SA" | "FILL" | "DRAG"
       content: string
       bodyHtml: string | null
       order: number
       options: QuestionOptionDto[]   // đã gồm isCorrect để hiện preview (đây là action GV)
       correctAnswer?: string
     }
     ```
   - Query: chọn theo `questions.lessonId = lessonId`, `orderBy(asc(questions.order), asc(questions.createdAt))`, join options.
   - Đổi `deleteKnowledgePoint` text confirm ở UI (Phiên 3) — câu trả về pool, không bị xoá.
2. `app/actions/questions.ts`:
   - `getLessonQuestions(lessonId)`: xác thực quyền qua `lessons.teacherId`; trả `LessonQuestionItem[]` (dùng chung với trên, có thể để trong `content.ts` và import sang).
   - `moveQuestion(questionId, targetKpId: string | null, targetIndex?: number): Promise<void>`:
     - Xác thực quyền câu qua join `lessons.teacherId`.
     - Nếu `targetKpId != null`: xác thực KP thuộc cùng bài (so `knowledgePoints.lessonId === questions.lessonId`) → tránh gán chéo bài.
     - Update `questions.knowledgePointId = targetKpId`.
     - Nếu có `targetIndex`: chuẩn hoá lại `order` của các câu trong KP đích (dùng `reorderQuestions`).
   - `reorderQuestions(kpId: string | null, orderedIds: string[]): Promise<void>`:
     - Với từng id theo thứ tự, `update questions set order = idx, knowledgePointId = kpId where id = ...` (chỉ câu thuộc GV; `kpId = null` nghĩa là pool).
   - `getQuestionBank()`: đổi `innerJoin knowledgePoints` thành `leftJoin`, và join `lessons` qua `questions.lessonId` thay vì qua KP:
     ```
     .from(questions)
     .leftJoin(knowledgePoints, eq(knowledgePoints.id, questions.knowledgePointId))
     .innerJoin(lessons, eq(lessons.id, questions.lessonId))
     .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
     ```
     `knowledgePointId`/`knowledgePointContent` cho phép null → cập nhật type `QuestionBankItem`.
   - `createQuestion` / `updateQuestion`: vẫn gắn KP như cũ; riêng `createQuestion` cho phép `knowledgePointId: string | null` (khi tạo tay câu vào pool) → nếu null thì cần `lessonId` để xác thực. Có thể để Phiên 3/5 mới cần.
3. `revalidatePath` ở các action: `revalidatePath("/teacher/lessons")`, `revalidatePath("/teacher/questions")`, và `/teacher/lessons/[lessonId]` khi biết id.

### Kiểm thử phiên 2
- Gọi `moveQuestion` (có thể viết tạm test bằng script hoặc thao tác tay) → DB đổi `knowledgePointId`, `order`.
- `getLessonQuestions` trả đủ câu đã gán + chưa gán.
- `getQuestionBank` vẫn hiện câu chưa gán.

### Báo cáo phiên 2 (điền sau khi code)
- Đã làm:
- File đã sửa/tạo:
- Việc tiếp theo cho phiên 3:

---

## Phiên 3 — UI 2 khung + 2 tab + kéo thả gán câu vào KP

### Mục tiêu
Dựng lại `lesson-detail.tsx` thành 2 khung, có tab "Chưa gán"/"Tổng câu hỏi", và kéo câu từ khung trái thả vào KP ở khung phải. Gọi `moveQuestion`.

### Việc làm
1. Tạo component `components/teacher/question-form-dialog.tsx` bằng cách **tách dialog** khỏi `question-editor.tsx` (props: `mode create|edit`, `question?`, `defaultKnowledgePointId`, `onSaved`). Giữ nguyên UI 3 loại MC/TF/SA. Sau đó `question-editor.tsx` chỉ còn là list + nút, hoặc bỏ (xem bước 5).
2. Viết lại `components/teacher/lesson-detail.tsx`:
   - State chính:
     - `lesson`, `kps` (KnowledgePointDto + questionCount suy ra từ pool).
     - `questions: LessonQuestionItem[]` (nguồn duy nhất), nạp qua `getLessonQuestions(lesson.id)`.
     - `poolTab: "unassigned" | "all"`.
     - `expandedKpId: string | null`.
     - `activeId` cho DnD.
   - Layout: `grid md:grid-cols-2` (hoặc 5/7). Trái: panel bộ câu hỏi + Tabs. Phải: danh sách KP.
   - Khung trái:
     - Tab "Chưa gán": `questions.filter(q => q.knowledgePointId === null)`.
     - Tab "Tổng câu hỏi": toàn bộ `questions` (kèm badge KP nếu đã gán).
     - Mỗi câu render `<QuestionCard>` có `useDraggable` (chỉ bật ở tab "Chưa gán"; tab "Tổng" read-only) + nút sửa/xoá.
   - Khung phải:
     - Mỗi KP là một `useDroppable` (`id: "kp:"+kp.id`). Header thu gọn: số thứ tự, nội dung rút gọn, badge "N câu hỏi".
     - Click header → `setExpandedKpId`; khi mở: render danh sách câu đã gán cho KP đó (đã có thể kéo trong Phiên 4; Phiên 3 chỉ cần thấy + có droppable).
     - Nút "Chỉnh sửa"/"Xoá" KP giữ như hiện tại (dialog sửa sẽ đổi ở Phiên 5).
   - Pool dropzone: vùng "Chưa gán" cũng là `useDroppable` (`id: "pool"`) để Phiên 4 kéo trả về.
   - `DndContext` + `onDragStart`/`onDragEnd`:
     - `onDragEnd`: đọc `over.id`; nếu bắt đầu `kp:` → `moveQuestion(activeId, kpId, <index>)`; optimistic update state rồi gọi action; lỗi thì rollback + toast.
   - Nút "Thêm câu hỏi": mở `QuestionFormDialog` với `defaultKnowledgePointId = null` (tạo vào pool) hoặc theo KP nếu bấm từ trong KP.
   - Số câu trên header KP = `questions.filter(q => q.knowledgePointId === kp.id).length`.
3. Accessibility cơ bản: `KeyboardSensor` + `PointerSensor` (`activationConstraint: { distance: 6 }`) để không cản click mở dialog/nút.
4. Đổi text confirm xoá KP: "Xoá điểm kiến thức này? Các câu hỏi trong đó sẽ trở về khung câu hỏi (không bị xoá)."
5. Gỡ việc render `<QuestionEditor knowledgePointId=...>` cũ trong KP; thay bằng list câu + dialog dùng chung. Quyết định: giữ file `question-editor.tsx` nếu còn nơi khác dùng (kiểm tra `grep -rn "QuestionEditor"`), nếu không còn thì bỏ import (không xoá file vội nếu chưa chắc).

### Kiểm thử phiên 3
- Kéo 1 câu từ "Chưa gán" vào KP → câu mất khỏi tab "Chưa gán", tab "Tổng" vẫn thấy, KP tăng số câu; reload vẫn đúng (đã lưu DB).
- Kéo câu vào KP khác bài: không xảy ra vì UI chỉ hiện KP cùng bài; action chặn.
- Click KP mở/đóng danh sách.

### Báo cáo phiên 3 (điền sau khi code)
- Đã làm:
- File đã sửa/tạo:
- Việc tiếp theo cho phiên 4:

---

## Phiên 4 — Sắp xếp thứ tự trong KP + kéo trả về pool

### Mục tiêu
Trong một KP, kéo đổi thứ tự câu. Kéo câu từ KP thả về khung "Chưa gán" để bỏ gán. Thứ tự được lưu bằng `order`.

### Việc làm
1. Trong `lesson-detail.tsx`, danh sách câu của KP đang mở bọc bằng `SortableContext items={orderedIds} strategy={verticalListSortingStrategy}`; mỗi câu dùng `useSortable` (thay `useDraggable`).
2. `onDragEnd` xử lý 3 trường hợp:
   - active ở pool, over là `kp:<id>` → gán vào cuối KP.
   - active trong KP, over là câu khác cùng KP → `arrayMove` cục bộ rồi `reorderQuestions(kpId, newIds)`.
   - active trong KP, over là `pool` → `moveQuestion(id, null)`.
3. Optimistic update: cập nhật `questions` state ngay, gọi action, rollback nếu lỗi.
4. Hiệu ứng kéo: `DragOverlay` để card theo chuột; dropzone KP sáng viền khi `isOver`.
5. Khi kéo câu gán chéo KP này sang KP khác: cho phép; `moveQuestion` sẽ đổi `knowledgePointId` và xếp cuối KP đích.

### Kiểm thử phiên 4
- Đổi thứ tự 2 câu trong KP → reload giữ đúng thứ tự.
- Kéo câu từ KP về "Chưa gán" → `knowledgePointId = null`, xuất hiện lại tab "Chưa gán".
- Kéo câu từ KP A sang KP B.

### Báo cáo phiên 4 (điền sau khi code)
- Đã làm:
- File đã sửa/tạo:
- Việc tiếp theo cho phiên 5:

---

## Phiên 5 — Sửa điểm kiến thức bằng cơ chế fix-import

### Mục tiêu
Dialog Thêm/Sửa KP dùng đúng cơ chế của `import-error-fix.tsx`: sửa text tự do, Ctrl+click gạch chân `__...__`, `"..."` hoán đổi, preview tô ô trống. Lưu bằng `extractBlanks`.

### Việc làm
1. Tạo `lib/kp-render.ts` (hoặc thêm vào `lib/kp-blank-wrap.ts`):
   - `renderMarkedContent(content: string, terms: UnderlinedTerm[]): string`:
     - Duyệt `terms` theo `slotIndex`, chèn marker vào `content` từ con trỏ tăng dần (tìm `term.text` từ vị trí con trỏ).
     - `allowSwap` → bọc `"..."`; ngược lại bọc `__...__`.
     - Có `synonyms` → thêm `|syn1|syn2` trước dấu đóng.
     - Xử lý `allowSwap` + gạch chân: theo parser, `__"từ"__` = vừa gạch vừa swap; còn `"từ"` thuần cũng swap. Ưu tiên `__"từ"__` để giữ gạch chân khi mở lại.
   - `parseMarkedContent(raw: string): { content, underlinedTerms }` = gọi `extractBlanks(raw)` (đã có) — chỉ re-export cho rõ nghĩa.
2. Tạo `components/teacher/kp-content-editor.tsx` (client):
   - Props: `value: string` (raw có marker), `onChange(raw)`, `autoFocus?`.
   - Textarea font-mono, `onMouseUp` bắt `ev.ctrlKey` → `applyKpWrap(value, selectionStart, selectionEnd)`; cập nhật selection sau khi wrap (giống `import-error-fix.tsx` dòng 176-187).
   - Dưới textarea: preview dùng `extractBlanks(value)` + `highlightBlanks` (import từ `worksheet-preview-doc.tsx`) để tô các ô trống.
   - Dòng gợi ý: "Giữ Ctrl + click để gạch chân; thêm ngoặc kép để cho phép hoán đổi vị trí."
3. Sửa dialog KP trong `lesson-detail.tsx`:
   - Bỏ `deriveTerms` (dòng 54-68) và Textarea cũ.
   - State `rawContent` thay cho `content`:
     - Khi **tạo**: `rawContent = ""`.
     - Khi **sửa**: `rawContent = renderMarkedContent(kp.content, kp.underlinedTerms)`.
   - Nút Lưu: `const { content, underlinedTerms } = extractBlanks(rawContent)` → gọi `createKnowledgePoint(lesson.id, content, underlinedTerms)` hoặc `updateKnowledgePoint(kp.id, content, underlinedTerms)`.
   - Cảnh báo nếu `underlinedTerms.length === 0` (validate KP phải có ít nhất 1 ô) — hiện `validateDocument` cũng bắt, nhưng dialog nên nhắc trước.
4. Dọn import/không dùng: `deriveTerms`, `Textarea` nếu không còn dùng ở chỗ khác trong file.
5. (Tùy chọn, nếu không vướng) Tái sử dụng `kp-content-editor` cho ô sửa KP trong `import-error-fix.tsx` — **không bắt buộc**, tránh rủi ro làm vỡ luồng import đã ổn.

### Kiểm thử phiên 5
- Sửa KP: Ctrl+click một từ → thành `__từ__`, preview tô đúng. Thêm `"` quanh cụm → nhận diện hoán đổi (badge có ký hiệu ⇄ ở list).
- Lưu → reload: nội dung đúng, `underlinedTerms` đúng số ô.
- Tạo KP mới bằng cùng editor.

### Báo cáo phiên 5 (điền sau khi code)
- Đã làm:
- File đã sửa/tạo:
- Việc tiếp theo cho phiên 6:

---

## Phiên 6 — Chia đề theo điểm kiến thức + cập nhật live quiz + kiểm thử tổng

### Mục tiêu
Khi GV đã gán câu vào KP, đề trắc nghiệm bố trí câu theo từng KP (đúng thứ tự). Khi GV không gán câu nào, giữ ngẫu nhiên như cũ. Live quiz không mất câu chưa gán.

### Việc làm
1. Tạo `lib/quiz-selection.ts`:
   ```ts
   export interface SelectableQuestion { id: string; type: string; knowledgePointId: string | null; order: number }
   export interface SelectionResult { chosen: string[]; mode: "by-kp" | "random" }
   export function selectQuizQuestions(
     qRows: SelectableQuestion[],
     kps: { id: string; order: number }[],
     isAssigned: (q: SelectableQuestion) => boolean,
     rng: () => number,
   ): SelectionResult
   ```
   - **mode "by-kp"** khi tồn tại ít nhất 1 câu có `knowledgePointId != null`:
     - Gom theo KP, sắp xếp KP theo `kps.order`, trong KP theo `questions.order`.
     - Lấy **toàn bộ** câu của từng KP (không cắt theo loại).
     - Câu chưa gán (nếu có): xếp sau cùng, cũng lấy hết, theo `order`.
   - **mode "random"** khi không câu nào được gán: áp dụng đúng logic cũ (MC ≤ 18, TF ≤ 4, SA ≤ 6, `seededShuffle`).
   - Trả `mode` để UI/biết có đang xếp theo KP không.
2. `app/actions/student-learn.ts` — `startQuiz`:
   - Lấy câu theo `questions.lessonId = lessonId` (thay vì `inArray(knowledgePointId, kpIds)` để gồm câu chưa gán).
   - Lấy `kps` theo `asc(knowledgePoints.order)`.
   - Gọi `selectQuizQuestions(...)`; phần còn lại (options, totalSlots, pointPerSlot, insert attempt) giữ nguyên.
   - `QuizQuestionForClient` đã có `knowledgePointId: string` → đổi thành `string | null`.
3. `app/actions/live-quiz.ts`:
   - Dòng ~94-96 và ~185: join câu theo `questions.lessonId = lessonId` thay cho join qua `knowledgePoints`. Giữ `inArray(questions.type, ["MC","TF","SA"])`.
   - Nếu live quiz muốn chia theo KP, tái dùng `selectQuizQuestions`; nếu không, tối thiểu vẫn lấy được câu chưa gán.
4. Kiểm thử tổng:
   - `npm run lint` + `pnpm exec tsc --noEmit` (hoặc `npx tsc --noEmit`).
   - Kịch bản A (không gán): import bài mới → tạo đề → số câu MC/TF/SA đúng trần cũ, thứ tự ngẫu nhiên ổn định theo seed.
   - Kịch bản B (có gán): kéo vài câu vào KP1, KP2 → tạo đề → câu ra theo nhóm KP1 rồi KP2, đúng thứ tự đã kéo.
   - Kịch bản C: xoá 1 KP có câu → câu trở về pool, không mất.
   - Kịch bản D: đổi trạng thái bài sang `ready`, HS vào làm quiz và live quiz bình thường.

### Báo cáo phiên 6 (điền sau khi code)
- Đã làm:
- File đã sửa/tạo:
- Tồn đọng / việc sau:

---

## Rủi ro & lưu ý xuyên phiên

- **Migration chạy lúc runtime** (`ensureSchema`): mọi query phải idempotent. Thứ tự bắt buộc: add cột → backfill `lessonId` → drop NOT NULL → thêm FK → set NOT NULL `lessonId` sau cùng.
- Sau khi `knowledgePointId` nullable, mọi `innerJoin` cũ trên cột này sẽ **âm thầm mất câu chưa gán**. Grep toàn repo `knowledgePointId` trước khi kết thúc mỗi phiên:
  `grep -rn "questions.knowledgePointId\|QuestionDto" app lib components`.
- `ensureSchema` hiện chỉ gọi ở một số action. Phiên 1 nên đảm bảo các action mới (Phiên 2) cũng `await ensureSchema()` trước khi query cột mới.
- DnD với `@dnd-kit`: dùng `PointerSensor` có `activationConstraint.distance` để click mở dialog/nút không bị nuốt thành kéo.
- Không đổi cú pháp parser và định dạng file mẫu; câu import vào pool là thay đổi ở tầng lưu, không phải tầng parse.
- Giữ `seededRng`/`seededShuffle` (`lib/grading.ts`) để đề ngẫu nhiên ổn định theo HS + lần làm + bài.
