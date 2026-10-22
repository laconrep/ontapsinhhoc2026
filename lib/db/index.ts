import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

/**
 * Một pg Pool duy nhất, dùng chung cho Drizzle (và sau này cho Better Auth ở B3).
 * Đây là lớp truy cập DB tập trung — khi port sang stack Docker chỉ cần đổi file này.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  max: 10,
})

export const db = drizzle(pool, { schema })

let schemaReady: Promise<void> | null = null

/** Cot bodyHtml them o phien 2; lessonId/order/nullable KP o phien 1; class_assignments o giao bai. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool
      .query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS "bodyHtml" text`)
      .then(() => pool.query(`ALTER TABLE question_options ADD COLUMN IF NOT EXISTS "bodyHtml" text`))
      .then(() =>
        pool.query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS "order" integer NOT NULL DEFAULT 0`),
      )
      .then(() => pool.query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS "lessonId" uuid`))
      .then(() =>
        pool.query(`
          UPDATE questions q
             SET "lessonId" = kp."lessonId"
            FROM knowledge_points kp
           WHERE q."knowledgePointId" = kp.id AND q."lessonId" IS NULL
        `),
      )
      .then(() => pool.query(`ALTER TABLE questions ALTER COLUMN "knowledgePointId" DROP NOT NULL`))
      .then(() =>
        pool.query(`
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_lessonId_lessons_id_fk') THEN
              ALTER TABLE questions
                ADD CONSTRAINT "questions_lessonId_lessons_id_fk"
                FOREIGN KEY ("lessonId") REFERENCES lessons(id) ON DELETE CASCADE;
            END IF;
          END $$;
        `),
      )
      .then(() =>
        pool.query(`
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
        `),
      )
      .then(() => pool.query(`ALTER TABLE questions ALTER COLUMN "lessonId" SET NOT NULL`))
      .then(() =>
        pool.query(`
          UPDATE questions q
             SET "knowledgePointId" = NULL
           WHERE q."knowledgePointId" IS NOT NULL
             AND NOT EXISTS (
               SELECT 1
                 FROM knowledge_points kp
                WHERE kp.id = q."knowledgePointId"
                  AND kp."lessonId" = q."lessonId"
             )
        `),
      )
      .then(() =>
        pool.query(`
          CREATE TABLE IF NOT EXISTS "class_assignments" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "classId" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
            "lessonId" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
            "teacherId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
            "dueAt" timestamp,
            "note" text,
            "createdAt" timestamp NOT NULL DEFAULT now(),
            CONSTRAINT "ca_class_lesson_unique" UNIQUE ("classId", "lessonId")
          )
        `),
      )
      .then(() =>
        pool.query(`CREATE INDEX IF NOT EXISTS "ca_class_idx" ON "class_assignments" ("classId")`),
      )
      .then(() =>
        pool.query(`
          CREATE TABLE IF NOT EXISTS quiz_attempt_questions (
            "attemptId" uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
            "questionId" uuid NOT NULL,
            position integer NOT NULL,
            "optionOrder" jsonb,
            snapshot jsonb NOT NULL,
            PRIMARY KEY ("attemptId", "questionId")
          )
        `),
      )
      .then(() => pool.query(`ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS "optionId" uuid`))
      .then(() =>
        pool.query(`
          ALTER TABLE student_progress
            ADD COLUMN IF NOT EXISTS "fillRevealed" boolean NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS "dragRevealed" boolean NOT NULL DEFAULT false
        `),
      )
      .then(() =>
        pool.query(`
          DELETE FROM student_tab1_submissions a USING student_tab1_submissions b
           WHERE a."studentId"=b."studentId" AND a."lessonId"=b."lessonId"
             AND (a."submittedAt", a.id) < (b."submittedAt", b.id)
        `),
      )
      .then(() =>
        pool.query(`
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='s1_student_lesson_unique') THEN
              ALTER TABLE student_tab1_submissions ADD CONSTRAINT s1_student_lesson_unique UNIQUE ("studentId","lessonId");
            END IF;
          END $$;
        `),
      )
      // Hai index unique của quiz_answers bọc catch riêng: nếu dữ liệu
      // production đã có dòng trùng (attemptId, questionId) thì CREATE
      // UNIQUE INDEX lỗi 23505 — chỉ log, không được làm sập cả chuỗi
      // (đây là nguyên nhân sự cố /teacher ngày 2026-10-21: index
      // mc_sa không tạo được vì quiz_answers trùng dòng).
      .then(() =>
        pool
          .query(`
          CREATE UNIQUE INDEX IF NOT EXISTS quiz_answers_mc_sa_uidx
            ON quiz_answers ("attemptId","questionId") WHERE "optionId" IS NULL
        `)
          .catch((e) => console.error("[ensureSchema] quiz_answers_mc_sa_uidx failed:", e)),
      )
      .then(() =>
        pool
          .query(`
          CREATE UNIQUE INDEX IF NOT EXISTS quiz_answers_tf_uidx
            ON quiz_answers ("attemptId","questionId","optionId") WHERE "optionId" IS NOT NULL
        `)
          .catch((e) => console.error("[ensureSchema] quiz_answers_tf_uidx failed:", e)),
      )
      .then(() =>
        pool.query(`
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
          )
        `),
      )
      .then(() =>
        pool.query(`
          ALTER TABLE student_progress
            ADD COLUMN IF NOT EXISTS "fillFirstTry" text,
            ADD COLUMN IF NOT EXISTS "dragFirstTry" text
        `),
      )
      .then(() =>
        pool.query(`
          UPDATE student_progress SET "fillFirstTry"='incorrect'
           WHERE "fillFirstTry" IS NULL AND ("fillStatus"='incorrect' OR ("fillStatus"='correct' AND "fillAttempts">1))
        `),
      )
      .then(() =>
        pool.query(`
          UPDATE student_progress SET "fillFirstTry"='correct'
           WHERE "fillFirstTry" IS NULL AND "fillStatus"='correct' AND "fillAttempts"=1
        `),
      )
      .then(() =>
        pool.query(`
          UPDATE student_progress SET "dragFirstTry"='incorrect'
           WHERE "dragFirstTry" IS NULL AND ("dragStatus"='incorrect' OR ("dragStatus"='correct' AND "dragAttempts">1))
        `),
      )
      .then(() =>
        pool.query(`
          UPDATE student_progress SET "dragFirstTry"='correct'
           WHERE "dragFirstTry" IS NULL AND "dragStatus"='correct' AND "dragAttempts"=1
        `),
      )
      // SEC-08: bảng rate_limits (xem lib/rate-limit.ts).
      // Hai lệnh DDL của đợt SEC bọc catch riêng: nếu user DB production
      // thiếu quyền DDL (không phải owner của bảng trên Supabase) thì chỉ
      // log cảnh báo, KHÔNG được làm sập ensureSchema — các hàm đọc như
      // getQuestionBank gọi ensureSchema ở đầu và sẽ ném lỗi ra trang.
      // Hệ quả khi lỗi: rate limit tự fail-open (lib/rate-limit.ts), mã
      // mời lớp mới tạm giữ 6 ký tự tới khi ALTER chạy được.
      .then(() =>
        pool
          .query(`
          CREATE TABLE IF NOT EXISTS rate_limits (
            "key" text PRIMARY KEY,
            "count" integer NOT NULL DEFAULT 0,
            "windowStart" timestamp NOT NULL DEFAULT now()
          )
        `)
          .catch((e) => console.error("[ensureSchema] rate_limits DDL failed:", e)),
      )
      // SEC-05: nới cột mã mời lớp 6 -> 32 ký tự cho mã mới 8 ký tự.
      .then(() =>
        pool
          .query(`ALTER TABLE classes ALTER COLUMN "inviteCode" TYPE varchar(32)`)
          .catch((e) => console.error("[ensureSchema] inviteCode DDL failed:", e)),
      )
      // AI-MCP (§15 sualogic): cột lời giải cho câu hỏi + 3 bảng việc AI.
      // Bọc catch riêng như các DDL đợt SEC: lỗi DDL chỉ log, không sập app.
      .then(() =>
        pool
          .query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS "solution" text`)
          .catch((e) => console.error("[ensureSchema] questions.solution DDL failed:", e)),
      )
      .then(() =>
        pool
          .query(`
          CREATE TABLE IF NOT EXISTS ai_jobs (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "teacherId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
            "workerId" text,
            "filename" text NOT NULL,
            "sourceText" text NOT NULL,
            "images" jsonb,
            "tables" jsonb,
            "status" text NOT NULL DEFAULT 'pending',
            "hasSolutions" boolean,
            "wantSolutions" boolean,
            "progress" integer NOT NULL DEFAULT 0,
            "stage" text,
            "resultText" text,
            "resultMeta" jsonb,
            "repairRound" integer NOT NULL DEFAULT 0,
            "lastErrors" jsonb,
            "error" text,
            "createdAt" timestamp NOT NULL DEFAULT now(),
            "updatedAt" timestamp NOT NULL DEFAULT now()
          )
        `)
          .catch((e) => console.error("[ensureSchema] ai_jobs DDL failed:", e)),
      )
      .then(() =>
        pool
          .query(`
          CREATE TABLE IF NOT EXISTS ai_usage_logs (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "teacherId" text REFERENCES "user"("id") ON DELETE SET NULL,
            "jobId" uuid REFERENCES ai_jobs("id") ON DELETE SET NULL,
            "workerId" text,
            "action" text NOT NULL,
            "detail" jsonb,
            "createdAt" timestamp NOT NULL DEFAULT now()
          )
        `)
          .catch((e) => console.error("[ensureSchema] ai_usage_logs DDL failed:", e)),
      )
      .then(() =>
        pool
          .query(`
          CREATE TABLE IF NOT EXISTS ai_teacher_assignments (
            "teacherId" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
            "workerId" text NOT NULL,
            "updatedAt" timestamp NOT NULL DEFAULT now()
          )
        `)
          .catch((e) => console.error("[ensureSchema] ai_teacher_assignments DDL failed:", e)),
      )
      .then(() => undefined)
      .catch((e) => {
        // 2026-10-21 (sự cố production): KHÔNG ném lỗi ra caller nữa.
        // ensureSchema là DDL best-effort chạy lúc khởi động — một lệnh
        // vấp dữ liệu production (index unique gặp dòng trùng, thiếu
        // quyền DDL...) không được phép làm sập mọi trang gọi
        // ensureSchema (vd getQuestionBank trên /teacher). Log rõ để
        // xử lý gốc rễ sau; schemaReady reset để lần gọi sau thử lại.
        console.error("[ensureSchema] failed (app continues):", e)
        schemaReady = null
      })
  }
  return schemaReady
}
