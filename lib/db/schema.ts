import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  doublePrecision,
  jsonb,
  varchar,
  primaryKey,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.
// Các bảng auth này sẽ được kích hoạt đầy đủ ở B3.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  // [EduSync] role phân biệt giáo viên / học sinh (spec: 'teacher' | 'student')
  role: text("role").notNull().default("student"),
  isOnboarded: boolean("isOnboarded").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// --- App tables (B2) -------------------------------------------------------
// Theo đúng SCHEMA SNAPSHOT trong spec. FK→users trỏ tới bảng `user` (Better Auth).
// Dùng text enum thay pgEnum để DDL đơn giản (không cần CREATE TYPE).

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  teacherId: text("teacherId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // SEC-05: mã mời mới dài 8 ký tự (trước đây 6) — cột nới lên 32 để chứa cả hai.
  inviteCode: varchar("inviteCode", { length: 32 }).notNull().unique(),
  schoolYear: text("schoolYear").notNull(),
  // Thống kê §38 (full): ngưỡng xếp mức riêng từng lớp — mặc định 75/50.
  statsMastery: integer("statsMastery").notNull().default(75),
  statsOk: integer("statsOk").notNull().default(50),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const classStudents = pgTable(
  "class_students",
  {
    classId: uuid("classId")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentId: text("studentId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joinedAt").notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.classId, t.studentId] }) }),
)

export const chapters = pgTable("chapters", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  teacherId: text("teacherId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  // §18: bài thuộc thư viện thì có chapterId; bài "lưu tại lớp" thì có
  // classId và chapterId = null (không vào thư viện, không giao lớp khác).
  chapterId: uuid("chapterId").references(() => chapters.id, { onDelete: "cascade" }),
  classId: uuid("classId").references(() => classes.id, { onDelete: "cascade" }),
  teacherId: text("teacherId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
  status: text("status", { enum: ["draft", "processing", "ready", "error"] })
    .notNull()
    .default("draft"),
  originalFileKey: varchar("originalFileKey", { length: 500 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const knowledgePoints = pgTable("knowledge_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lessonId")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  /** §19: HTML ảnh/bảng nằm trong nội dung điểm kiến thức. */
  bodyHtml: text("bodyHtml"),
  underlinedTerms: jsonb("underlinedTerms"),
  order: integer("order").notNull().default(0),
})

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lessonId")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  knowledgePointId: uuid("knowledgePointId").references(() => knowledgePoints.id, {
    onDelete: "set null",
  }),
  type: text("type", { enum: ["MC", "TF", "SA", "FILL", "DRAG"] }).notNull(),
  content: text("content").notNull(),
  // Giải chi tiết của câu (tính năng AI §15.3 sualogic): text thuần, có
  // thể do GV viết trong file (dòng "Giải chi tiết:") hoặc AI gắn/sinh.
  solution: text("solution"),
  // §29: HTML render của lời giải khi mang ảnh/bảng (song song với
  // bodyHtml của đề) — null khi lời giải không có media.
  solutionBodyHtml: text("solutionBodyHtml"),
  bodyHtml: text("bodyHtml"),
  difficulty: integer("difficulty").notNull().default(1),
  timeLimitSec: integer("timeLimitSec"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const questionOptions = pgTable("question_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("questionId")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  bodyHtml: text("bodyHtml"),
  isCorrect: boolean("isCorrect").notNull().default(false),
  order: integer("order").notNull().default(0),
})

export const studentProgress = pgTable(
  "student_progress",
  {
    studentId: text("studentId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    knowledgePointId: uuid("knowledgePointId")
      .notNull()
      .references(() => knowledgePoints.id, { onDelete: "cascade" }),
    selfAssessment: text("selfAssessment", { enum: ["known", "unknown"] }),
    fillStatus: text("fillStatus", { enum: ["correct", "incorrect"] }),
    dragStatus: text("dragStatus", { enum: ["correct", "incorrect"] }),
    overallStatus: text("overallStatus", {
      enum: ["not_started", "known", "unknown", "mastered"],
    })
      .notNull()
      .default("not_started"),
    fillAttempts: integer("fillAttempts").notNull().default(0),
    dragAttempts: integer("dragAttempts").notNull().default(0),
    fillRevealed: boolean("fillRevealed").notNull().default(false),
    dragRevealed: boolean("dragRevealed").notNull().default(false),
    fillFirstTry: text("fillFirstTry", { enum: ["correct", "incorrect"] }),
    dragFirstTry: text("dragFirstTry", { enum: ["correct", "incorrect"] }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.knowledgePointId] }),
    byStudent: index("sp_student_idx").on(t.studentId),
  }),
)

export const studentTab1Submissions = pgTable(
  "student_tab1_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("studentId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: uuid("lessonId")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    assessments: jsonb("assessments"),
    submittedAt: timestamp("submittedAt").notNull().defaultNow(),
    isLocked: boolean("isLocked").notNull().default(true),
  },
  (t) => ({
    uniqStudentLesson: unique("s1_student_lesson_unique").on(t.studentId, t.lessonId),
  }),
)

// §38 (full): lịch sử lượt học — một dòng mỗi lần học sinh nộp Tab 1
// (lượt mới sau mỗi lần "học lại"). Đóng lượt khi resetLessonProgress.
// Lượt không có dòng ở đây (học trước khi có bảng) được thống kê coi là lượt 1.
export const lessonRuns = pgTable(
  "lesson_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("studentId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: uuid("lessonId")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    runNo: integer("runNo").notNull(),
    status: text("status", { enum: ["active", "closed"] }).notNull().default("active"),
    tab1At: timestamp("tab1At"),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    byStudentLesson: index("lr_student_lesson_idx").on(t.studentId, t.lessonId),
    uniqRun: uniqueIndex("lr_student_lesson_run_uidx").on(t.studentId, t.lessonId, t.runNo),
  }),
)

// §38 (full): kết quả Tab 1/2/3 của từng điểm trong từng lượt học.
// Ghi khi nộp Tab 1 (selfAssessment), khi nộp Tab 2/3 (số ô đúng lần đầu,
// số lần thử, xem đáp án, trạng thái cuối). Lượt hiện tại đọc từ
// studentProgress; bảng này giữ lịch sử các lượt đã đóng.
export const kpRunResults = pgTable(
  "kp_run_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("runId")
      .notNull()
      .references(() => lessonRuns.id, { onDelete: "cascade" }),
    knowledgePointId: uuid("knowledgePointId")
      .notNull()
      .references(() => knowledgePoints.id, { onDelete: "cascade" }),
    selfAssessment: text("selfAssessment", { enum: ["known", "unknown"] }),
    fillFirstSlots: integer("fillFirstSlots"),
    fillFirstTotal: integer("fillFirstTotal"),
    fillAttempts: integer("fillAttempts").notNull().default(0),
    fillRevealed: boolean("fillRevealed").notNull().default(false),
    fillStatus: text("fillStatus", { enum: ["correct", "incorrect"] }),
    dragFirstSlots: integer("dragFirstSlots"),
    dragFirstTotal: integer("dragFirstTotal"),
    dragAttempts: integer("dragAttempts").notNull().default(0),
    dragRevealed: boolean("dragRevealed").notNull().default(false),
    dragStatus: text("dragStatus", { enum: ["correct", "incorrect"] }),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    uniqRunKp: uniqueIndex("kprr_run_kp_uidx").on(t.runId, t.knowledgePointId),
    byRun: index("kprr_run_idx").on(t.runId),
  }),
)

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("studentId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: uuid("lessonId")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    score: doublePrecision("score"),
    maxScore: doublePrecision("maxScore"),
    totalSlots: integer("totalSlots"),
    startedAt: timestamp("startedAt").notNull().defaultNow(),
    completedAt: timestamp("completedAt"),
    isAutoSaved: boolean("isAutoSaved").notNull().default(false),
  },
  (t) => ({
    byStudentLesson: index("qa_student_lesson_idx").on(t.studentId, t.lessonId),
  }),
)

export const quizAnswers = pgTable(
  "quiz_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attemptId")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("questionId")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    optionId: uuid("optionId"),
    studentAnswer: text("studentAnswer"),
    isCorrect: boolean("isCorrect"),
    // §38 (full): thời điểm nộp từng câu — cờ "làm quá nhanh từng câu".
    answeredAt: timestamp("answeredAt"),
  },
  (t) => ({
    mcSaUnique: uniqueIndex("quiz_answers_mc_sa_uidx")
      .on(t.attemptId, t.questionId)
      .where(sql`${t.optionId} IS NULL`),
    tfUnique: uniqueIndex("quiz_answers_tf_uidx")
      .on(t.attemptId, t.questionId, t.optionId)
      .where(sql`${t.optionId} IS NOT NULL`),
  }),
)

export const quizAttemptQuestions = pgTable(
  "quiz_attempt_questions",
  {
    attemptId: uuid("attemptId")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("questionId").notNull(),
    position: integer("position").notNull(),
    optionOrder: jsonb("optionOrder").$type<string[]>(),
    snapshot: jsonb("snapshot")
      .$type<{
        type: string
        /** Nội dung câu hỏi lúc tạo đề (BUG-11). Snapshot cũ không có -> fallback DB. */
        stem?: string
        bodyHtml?: string | null
        options: { id: string; content: string; isCorrect: boolean }[]
      }>()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.attemptId, t.questionId] }),
  }),
)

export const quizAutosave = pgTable(
  "quiz_autosave",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("studentId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: uuid("lessonId")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    answers: jsonb("answers"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    expiresAt: timestamp("expiresAt"),
  },
  (t) => ({
    byStudentLesson: index("qas_student_lesson_idx").on(t.studentId, t.lessonId),
    uniqStudentLesson: unique("qas_student_lesson_unique").on(t.studentId, t.lessonId),
  }),
)

export const spacedRepetition = pgTable(
  "spaced_repetition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: text("studentId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    knowledgePointId: uuid("knowledgePointId")
      .notNull()
      .references(() => knowledgePoints.id, { onDelete: "cascade" }),
    interval: integer("interval").notNull().default(1),
    easinessFactor: doublePrecision("easinessFactor").notNull().default(2.5),
    nextReview: timestamp("nextReview"),
    repetitions: integer("repetitions").notNull().default(0),
  },
  (t) => ({
    byStudentNext: index("sr_student_next_idx").on(t.studentId, t.nextReview),
    uniqStudentKp: unique("sr_student_kp_unique").on(t.studentId, t.knowledgePointId),
  }),
)

export const lessonPlans = pgTable("lesson_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: text("teacherId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  lessonId: uuid("lessonId")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  fillQuestions: jsonb("fillQuestions"),
  dragQuestions: jsonb("dragQuestions"),
  mcQuestions: jsonb("mcQuestions"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("classId")
    .notNull()
    .references(() => classes.id, { onDelete: "restrict" }),
  teacherId: text("teacherId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  lessonPlanId: uuid("lessonPlanId").references(() => lessonPlans.id, {
    onDelete: "set null",
  }),
  status: text("status", { enum: ["created", "active", "paused", "ended"] })
    .notNull()
    .default("created"),
  resumeSnapshot: jsonb("resumeSnapshot"),
  lastActivityAt: timestamp("lastActivityAt").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  endedAt: timestamp("endedAt"),
})

export const sessionEvents = pgTable(
  "session_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("sessionId")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    studentId: text("studentId").references(() => user.id, { onDelete: "cascade" }),
    eventType: varchar("eventType", { length: 50 }).notNull(),
    questionId: uuid("questionId").references(() => questions.id, {
      onDelete: "set null",
    }),
    payload: jsonb("payload"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    bySessionType: index("se_session_type_idx").on(t.sessionId, t.eventType),
  }),
)

export const worksheets = pgTable("worksheets", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  lessonId: uuid("lessonId")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  teacherId: text("teacherId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  originalFileKey: varchar("originalFileKey", { length: 500 }),
  status: text("status", { enum: ["draft", "processing", "ready", "error"] })
    .notNull()
    .default("draft"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const worksheetSections = pgTable("worksheet_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  worksheetId: uuid("worksheetId")
    .notNull()
    .references(() => worksheets.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  order: integer("order").notNull().default(0),
})

export const worksheetQuestions = pgTable("worksheet_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("sectionId")
    .notNull()
    .references(() => worksheetSections.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  order: integer("order").notNull().default(0),
  terms: jsonb("terms"),
})

export const worksheetAttempts = pgTable("worksheet_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: text("studentId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  worksheetId: uuid("worksheetId")
    .notNull()
    .references(() => worksheets.id, { onDelete: "cascade" }),
  score: doublePrecision("score"),
  maxScore: doublePrecision("maxScore"),
  completedAt: timestamp("completedAt").notNull().defaultNow(),
})

export const worksheetAnswers = pgTable("worksheet_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attemptId")
    .notNull()
    .references(() => worksheetAttempts.id, { onDelete: "cascade" }),
  questionId: uuid("questionId")
    .notNull()
    .references(() => worksheetQuestions.id, { onDelete: "cascade" }),
  termIndex: integer("termIndex"),
  studentAnswer: text("studentAnswer"),
  isCorrect: boolean("isCorrect"),
})

export const classWorksheets = pgTable(
  "class_worksheets",
  {
    classId: uuid("classId")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    worksheetId: uuid("worksheetId")
      .notNull()
      .references(() => worksheets.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assignedAt").notNull().defaultNow(),
    dueAt: timestamp("dueAt"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.classId, t.worksheetId] }) }),
)

export const classAssignments = pgTable(
  "class_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("classId")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    lessonId: uuid("lessonId")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    teacherId: text("teacherId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dueAt: timestamp("dueAt"),
    note: text("note"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    byClass: index("ca_class_idx").on(t.classId),
    uniqClassLesson: unique("ca_class_lesson_unique").on(t.classId, t.lessonId),
  }),
)

export const liveAnswers = pgTable(
  "live_answers",
  {
    sessionId: uuid("sessionId")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    questionId: uuid("questionId").notNull(),
    studentId: text("studentId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    round: integer("round").notNull().default(1),
    answer: text("answer"),
    isCorrect: boolean("isCorrect").notNull(),
    answeredAt: timestamp("answeredAt").notNull().defaultNow(),
    responseMs: integer("responseMs"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.sessionId, t.questionId, t.studentId, t.round] }),
  }),
)

// SEC-08: bộ đếm rate limit dùng chung (joinClass, upload, chấm điểm).
// Tạo bằng CREATE TABLE IF NOT EXISTS trong ensureSchema (đúng mô hình repo).
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("windowStart").notNull().defaultNow(),
})

// AI-MCP (§15 sualogic): một tài liệu GV nạp bằng chế độ AI = một việc.
// Worker (Muse của chủ hệ thống, sau này là farm) nhận việc qua cổng MCP;
// trạng thái + tiến độ nằm ở đây để UI polling và để truy vết.
export const aiJobs = pgTable(
  "ai_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: text("teacherId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Muse nào đang/đã xử lý việc (phân công farm sau này).
    workerId: text("workerId"),
    filename: text("filename").notNull(),
    sourceText: text("sourceText").notNull(),
    images: jsonb("images"),
    tables: jsonb("tables"),
    status: text("status", {
      enum: ["pending", "detecting", "needs_solution_choice", "processing", "ready", "failed"],
    })
      .notNull()
      .default("pending"),
    // Worker quét được: tài liệu có sẵn phần giải chi tiết tách riêng?
    hasSolutions: boolean("hasSolutions"),
    // GV trả lời popup "có muốn AI giải chi tiết không" (null = chưa hỏi/chưa trả lời).
    wantSolutions: boolean("wantSolutions"),
    progress: integer("progress").notNull().default(0),
    stage: text("stage"),
    // Bản dựng đúng form worksheet do app render từ JSON của worker.
    resultText: text("resultText"),
    // Cờ truy vết: KP do AI sinh, câu AI điền đáp án, lời giải không gắn được...
    resultMeta: jsonb("resultMeta"),
    repairRound: integer("repairRound").notNull().default(0),
    lastErrors: jsonb("lastErrors"),
    error: text("error"),
    // §17: mốc GV đã "xong việc" với job này — đã lưu bản xem trước vào
    // hệ thống hoặc chủ động ẩn khỏi danh sách chờ ở trang nạp bài.
    // null = còn chờ GV mở lại xem trước (kết quả không bị mất khi đóng tab).
    consumedAt: timestamp("consumedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    byTeacher: index("ai_jobs_teacher_idx").on(t.teacherId),
    byStatus: index("ai_jobs_status_idx").on(t.status),
  }),
)

// AI-MCP: log MỌI lượt tương tác AI (tạo việc, worker gọi tool, nộp bản
// dựng...) ngay từ đầu — nền cho gói/trần lượt dùng và tab quản trị sau này.
// §21: việc nạp file đang dở (chưa bấm Lưu) — thẻ đỏ giữ chỗ ở lớp / tab
// Bài giảng. Một dòng cho mỗi phiên nạp chưa xong: việc AI (jobId) hoặc
// nạp thường (sourceText + media đã trích). classId null = bắt đầu từ
// đường nạp thường (hiện ở nhóm "Chưa lưu" của tab Bài giảng);
// classId có giá trị = bắt đầu từ tab Lớp đó. Dòng biến mất khi lưu
// xong (save/consume) hoặc GV bỏ việc — không phải là bài giảng, HS
// không bao giờ thấy.
export const importDrafts = pgTable(
  "import_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: text("teacherId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    classId: uuid("classId").references(() => classes.id, {
      onDelete: "cascade",
    }),
    kind: text("kind", { enum: ["ai", "upload"] }).notNull(),
    jobId: uuid("jobId"),
    filename: text("filename").notNull(),
    sourceText: text("sourceText"),
    images: jsonb("images"),
    tables: jsonb("tables"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    byTeacher: index("import_drafts_teacher_idx").on(t.teacherId),
    byClass: index("import_drafts_class_idx").on(t.classId),
  }),
)

export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: text("teacherId").references(() => user.id, { onDelete: "set null" }),
    jobId: uuid("jobId").references(() => aiJobs.id, { onDelete: "set null" }),
    workerId: text("workerId"),
    action: text("action").notNull(),
    detail: jsonb("detail"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (t) => ({
    byTeacher: index("ai_usage_teacher_idx").on(t.teacherId),
    byJob: index("ai_usage_job_idx").on(t.jobId),
  }),
)

// AI-MCP: phân công giáo viên -> Muse phụ trách (farm 1 Muse : 3 GV).
// Giai đoạn thử chỉ có một worker mặc định; bảng này chừa sẵn cho tầng
// quản lý phân bổ sau này.
export const aiTeacherAssignments = pgTable("ai_teacher_assignments", {
  teacherId: text("teacherId")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  workerId: text("workerId").notNull(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})
