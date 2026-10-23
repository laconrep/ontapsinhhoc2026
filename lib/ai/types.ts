// AI-MCP (§15 sualogic): kiểu dữ liệu trao đổi giữa worker (Muse) và app.
//
// Worker KHÔNG gõ định dạng worksheet thô. Worker trả JSON có cấu trúc
// theo các kiểu dưới đây; code phía app (lib/ai/render.ts) dựng thành văn
// bản đúng form, rồi chạy parser + validator + đối chiếu như tài liệu
// thường. Mọi trường *Ai Flag* phục vụ truy vết ở bản xem trước.

export interface AiUnderline {
  /** Cụm từ nguyên văn trong nội dung KP sẽ được gạch chân. */
  text: string
  /** true = cụm có thể hoán đổi vị trí (nhóm swap, viết __"từ"__ khi dựng). */
  swap?: boolean
  /** §16: từ gây nhiễu kéo thả cho CHÍNH cụm này — ÍT NHẤT 3 từ, lấy
   * nguyên văn từ phần trắc nghiệm của tài liệu, gần nghĩa với từ đúng
   * nhưng không điền đúng được vào chỗ trống này. */
  distractors?: string[]
}

export interface AiOption {
  content: string
  isCorrect: boolean
}

export interface AiQuestion {
  type: "MC" | "TF" | "SA"
  content: string
  options: AiOption[]
  /** SA: đáp án đúng (có thể nhiều đáp án chấp nhận, cách nhau " | "). */
  correctAnswer?: string
  /** Giải chi tiết đã gắn cho câu này (từ tài liệu gốc hoặc AI sinh). */
  solution?: string
  /** Nguồn lời giải: "document" = có sẵn trong tài liệu, "ai" = AI sinh. */
  solutionSource?: "document" | "ai"
}

export interface AiKnowledgePoint {
  content: string
  underlines: AiUnderline[]
  /** true = KP này do AI TỰ SINH (tài liệu gốc chỉ có trắc nghiệm). */
  generatedByAi?: boolean
  questions: AiQuestion[]
}

export interface AiLesson {
  title: string
  /** §18: true = tên bài do AI đặt (tài liệu gốc không ghi tên bài) —
   * khi GV lưu, bài bị để ở trạng thái nháp chờ duyệt tên. */
  titleGeneratedByAi?: boolean
  knowledgePoints: AiKnowledgePoint[]
}

export interface AiChapter {
  title: string
  lessons: AiLesson[]
}

/** Toàn bộ kết quả worker nộp cho một việc AI. */
export interface AiResult {
  chapters: AiChapter[]
  /**
   * Chỉ số câu (đánh số toàn cục 1..N theo thứ tự xuất hiện trong bản
   * dựng) mà AI đã ĐIỀN đáp án vì bản gốc thiếu đáp án. Đối chiếu phía
   * server chỉ cho phép đổi đáp án ở đúng các câu này.
   */
  filledAnswers?: number[]
  /**
   * Lời giải có trong tài liệu gốc nhưng AI không gắn được vào câu nào
   * (không khớp nghĩa rõ ràng) — hiện riêng, tô đỏ ở bản xem trước.
   */
  unmatchedSolutions?: { text: string; reason?: string }[]
  /** Ghi chú tự do của worker về việc xử lý (hiển thị trong log). */
  note?: string
}

/** Siêu dữ liệu lưu kèm việc khi bản dựng đạt — dùng cho bản xem trước. */
/** §16: một mục từ nhiễu trong siêu dữ liệu job — vị trí theo thứ tự
 * bài/KP như khi persistParseResult tạo bài (lessonIdx = thứ tự bài đã
 * phẳng hoá qua các chương, kpIdx = thứ tự KP trong bài). */
export interface AiDistractorEntry {
  lessonIdx: number
  kpIdx: number
  term: string
  distractors: string[]
}

export interface AiResultMeta {
  /** Dòng (line) trong resultText của các KP do AI sinh. */
  generatedKpLines: number[]
  /** Dòng của các câu AI đã điền đáp án. */
  filledAnswerLines: number[]
  unmatchedSolutions: { text: string; reason?: string }[]
  workerId: string
  repairRounds: number
  /** §16: từ nhiễu kéo thả theo từng cụm — gắn vào KP sau khi GV lưu. */
  distractors?: AiDistractorEntry[]
  /** §18: chỉ số bài (phẳng) có tên do AI đặt — importer truyền xuống
   * lúc lưu để các bài đó vào trạng thái nháp chờ GV duyệt tên. */
  draftLessonIndexes?: number[]
}
