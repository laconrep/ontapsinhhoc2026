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
} from "drizzle-orm/pg-core"

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
  inviteCode: varchar("inviteCode", { length: 6 }).notNull().unique(),
  schoolYear: text("schoolYear").notNull(),
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
  chapterId: uuid("chapterId")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
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
  underlinedTerms: jsonb("underlinedTerms"),
  order: integer("order").notNull().default(0),
})

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  knowledgePointId: uuid("knowledgePointId")
    .notNull()
    .references(() => knowledgePoints.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["MC", "TF", "SA", "FILL", "DRAG"] }).notNull(),
  content: text("content").notNull(),
  difficulty: integer("difficulty").notNull().default(1),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const questionOptions = pgTable("question_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("questionId")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
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
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.knowledgePointId] }),
    byStudent: index("sp_student_idx").on(t.studentId),
  }),
)

export const studentTab1Submissions = pgTable("student_tab1_submissions", {
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
})

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

export const quizAnswers = pgTable("quiz_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attemptId")
    .notNull()
    .references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: uuid("questionId")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  studentAnswer: text("studentAnswer"),
  isCorrect: boolean("isCorrect"),
})

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
