/**
 * EduSync — Shared Types (nguồn sự thật duy nhất)
 * Chuyển thể từ packages/shared/src/types.ts của spec v8.8.
 * Giữ nguyên văn 20+ interface để dễ port lại sang stack Docker sau này.
 */

// === Auth ===
export type UserRole = "teacher" | "student"
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  isOnboarded: boolean
}
export interface AuthTokens {
  accessToken: string
  refreshToken: string
}
export interface JwtPayload {
  sub: string
  role: "teacher" | "student"
  jti: string
  iat: number
  exp: number
}

// === Class ===
export interface ClassDto {
  id: string
  name: string
  subject: string
  inviteCode: string
  schoolYear: string
  teacherId: string
  studentCount?: number
}
export interface OnboardingStatus {
  isOnboarded: boolean
  hasClass: boolean
  hasLesson: boolean
}

// === Lesson & KP ===
export interface ChapterDto {
  id: string
  title: string
  order: number
  lessons: LessonDto[]
}
export interface LessonDto {
  id: string
  title: string
  chapterId: string
  order: number
  status: "draft" | "processing" | "ready" | "error"
  knowledgePointCount?: number
}
export interface KnowledgePointDto {
  id: string
  lessonId: string
  content: string
  underlinedTerms: UnderlinedTerm[]
  order: number
}
export interface UnderlinedTerm {
  text: string
  slotIndex: number
  allowSwap: boolean
  swapGroupId: string | null
  extraAccepted: string[]
  /** Từ đồng nghĩa được chấp nhận (tùy chọn, để quản lý linh hoạt) */
  synonyms?: string[]
}

// === Questions ===
export interface QuestionDto {
  id: string
  knowledgePointId: string
  type: "MC" | "TF" | "SA" | "FILL" | "DRAG"
  content: string
  bodyHtml?: string | null
  options?: QuestionOptionDto[]
  correctAnswer?: string
}
export interface QuestionOptionDto {
  id: string
  content: string
  isCorrect: boolean
  order: number
}

// === Student Progress ===
export interface StudentProgressDto {
  studentId: string
  knowledgePointId: string
  selfAssessment: "known" | "unknown" | null
  fillStatus: "correct" | "incorrect" | null
  dragStatus: "correct" | "incorrect" | null
  overallStatus: "not_started" | "known" | "unknown" | "mastered"
  fillAttempts: number
  dragAttempts: number
}

// === Quiz (Tab 4) ===
export interface QuizState {
  currentIndex: number
  answers: Record<string, string>
  startedAt: string
}
export interface AutoSavePayload {
  lessonId: string
  quizId: string
  answers: Record<string, string>
  timestamp: string
}
export interface QuizResultDto {
  attemptId: string
  score: number
  maxScore: number
  totalSlots: number
  percentage: number
  details: QuizAnswerDetail[]
}
export interface QuizAnswerDetail {
  questionId: string
  questionType: string
  studentAnswer: string
  isCorrect: boolean
  correctAnswer: string
}
export interface QuizAttemptDto {
  id: string
  studentId: string
  lessonId: string
  score: number
  maxScore: number
  completedAt: string | null
}

// === Spaced Repetition ===
export interface SpacedRepetitionDto {
  id: string
  knowledgePointId: string
  interval: number
  easinessFactor: number
  nextReview: string
  repetitions: number
}

// === Session (Realtime) ===
export interface SessionDto {
  id: string
  classId: string
  status: "created" | "active" | "paused" | "ended"
  lessonPlanId?: string
  lastActivityAt: string
}
export interface LessonPlanDto {
  id: string
  title: string
  lessonId: string
  fillQuestions: string[]
  dragQuestions: string[]
  mcQuestions: string[]
}
export interface SessionEventDto {
  id: string
  sessionId: string
  studentId?: string
  eventType: string
  questionId?: string
  payload: unknown
  createdAt: string
}
export type LearningMode = "self_study" | "live_class"

// === Worksheet ===
export interface WorksheetDto {
  id: string
  title: string
  description?: string
  lessonId: string
  status: string
  sections: WorksheetSectionDto[]
}
export interface WorksheetSectionDto {
  id: string
  title: string
  order: number
  questions: WorksheetQuestionDto[]
}
export interface WorksheetQuestionDto {
  id: string
  content: string
  order: number
  terms: WorksheetTermDto[]
}
export interface WorksheetTermDto {
  text: string
  slotIndex: number
  allowSwap: boolean
  swapGroupId: string | null
  extraAccepted: string[]
}
export interface WorksheetAttemptDto {
  id: string
  studentId: string
  worksheetId: string
  score: number
  maxScore: number
  completedAt: string
}
export interface GradeResult {
  slotIndex: number
  isCorrect: boolean
  correctAnswer: string
  studentAnswer: string
}

// === Stats ===
export interface StudentStatsDto {
  streak: number
  totalReviewed: number
  badges: BadgeDto[]
  weeklyProgress: WeeklyPoint[]
  lessonProgress: {
    lessonId: string
    title: string
    knownPercent: number
    masteredPercent: number
  }[]
}
export interface BadgeDto {
  id: string
  type: BadgeType
  earnedAt: string
}
export type BadgeType =
  | "first_lesson"
  | "streak_3"
  | "streak_7"
  | "streak_30"
  | "perfect_quiz"
  | "all_mastered_chapter"
  | "speed_demon"
export interface WeeklyPoint {
  date: string // format: "YYYY-MM-DD"
  activityCount: number // tổng hoạt động trong ngày: quiz submit + tab1 submit + session events
  // [FIX-V86-06] Nguồn nhất quán với streak query: quiz_attempts.completedAt +
  // student_tab1_submissions.submittedAt + session_events.createdAt
  // [FIX-V88-01] dùng submittedAt (KHÔNG phải createdAt — bảng tab1 không có cột đó)
  // WeeklyChart hiển thị bar height = activityCount, X axis = ngày trong tuần (Mon-Sun)
}
export interface ClassStatsDto {
  students: StudentStatRow[]
  knowledgePoints: KPStatRow[]
}
export interface StudentStatRow {
  studentId: string
  name: string
  knownCount: number
  unknownCount: number
  overconfidentCount: number
  masteredCount: number
  progress: number
}
// [FIX-V88-09] overconfidentCount là chỉ số CHẨN ĐOÁN (selfAssessment='known' AND fillStatus='incorrect').
// Nó CÓ THỂ chồng với masteredCount. UI KHÔNG được hiển thị 2 cột này như thể tổng của chúng = tổng KP.
export interface KPStatRow {
  kpId: string
  content: string
  knownPercent: number
  overconfidentPercent: number
  reinforcedPercent: number
}
// [FIX-V88-09] Mẫu số mọi % = số HS đã làm bài cho KP (overallStatus != 'not_started').
export interface OverconfidentStat {
  kpId: string
  studentId: string
  selfAssessed: "known"
  fillStatus: "incorrect"
}

// === API Response ===
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
