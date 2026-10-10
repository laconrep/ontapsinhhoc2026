import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

/**
 * Một pg Pool duy nhất, dùng chung cho Drizzle (và sau này cho Better Auth ở B3).
 * Đây là lớp truy cập DB tập trung — khi port sang stack Docker chỉ cần đổi file này.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
      .then(() =>
        pool.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS quiz_answers_mc_sa_uidx
            ON quiz_answers ("attemptId","questionId") WHERE "optionId" IS NULL
        `),
      )
      .then(() =>
        pool.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS quiz_answers_tf_uidx
            ON quiz_answers ("attemptId","questionId","optionId") WHERE "optionId" IS NOT NULL
        `),
      )
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null
        throw e
      })
  }
  return schemaReady
}
