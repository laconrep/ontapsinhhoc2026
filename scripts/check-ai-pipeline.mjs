import { register } from "node:module"
import { pathToFileURL } from "node:url"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const rootUrl = pathToFileURL(root.endsWith("/") ? root : root + "/").href

const loader = `
export async function resolve(specifier, context, nextResolve) {
  let spec = specifier
  if (spec.startsWith("@/")) spec = ${JSON.stringify(rootUrl)} + spec.slice(2)
  try {
    return await nextResolve(spec, context)
  } catch (err) {
    if (typeof spec === "string" && !spec.endsWith(".ts") && (spec.startsWith(".") || spec.startsWith("file:"))) {
      return nextResolve(spec + ".ts", context)
    }
    throw err
  }
}
`

register("data:text/javascript," + encodeURIComponent(loader), import.meta.url)

// AI-MCP (§15 sualogic): pipeline phia app cho ket qua worker —
// renderAiResult (JSON -> form worksheet), parser doc lai (kem giai chi
// tiet), validateDocument, va verifyAiResult (doi chieu giu nguyen).

const { renderAiResult } = await import("../lib/ai/render.ts")
const { verifyAiResult } = await import("../lib/ai/verify.ts")
const { parseTextContent, validateDocument } = await import("../lib/worksheet-parser.ts")

function fail(msg) {
  console.error("THAT BAI:", msg)
  process.exit(1)
}
function assert(cond, msg) {
  if (!cond) fail(msg)
}

const SOURCE = `{Chuong 1}
[Bai 1]
- Gene la mot doan DNA mang thong tin di truyen.
#
cau: Gene la gi?
A. Mot doan protein
__B. Mot doan DNA mang thong tin di truyen__
C. Mot loai duong
D. Mot loai lipid
#
cau: Cau nay thieu dap an?
A. Phuong an mot
B. Phuong an hai
C. Phuong an ba
D. Phuong an bon
###
cau: Don phan cua DNA la gi?
dap an: nucleotide

HUONG DAN GIAI
Giai cau 1: Gene la doan DNA mang thong tin.` + "\n"

function baseResult() {
  return {
    chapters: [
      {
        title: "Chuong 1",
        lessons: [
          {
            title: "Bai 1",
            knowledgePoints: [
              {
                content: "Gene la mot doan DNA mang thong tin di truyen.",
                underlines: [{ text: "Gene" }, { text: "DNA" }],
                questions: [
                  {
                    type: "MC",
                    content: "Gene la gi?",
                    options: [
                      { content: "A. Mot doan protein", isCorrect: false },
                      { content: "B. Mot doan DNA mang thong tin di truyen", isCorrect: true },
                      { content: "C. Mot loai duong", isCorrect: false },
                      { content: "D. Mot loai lipid", isCorrect: false },
                    ],
                    solution: "Gene la doan DNA mang thong tin.",
                    solutionSource: "document",
                  },
                  {
                    type: "MC",
                    content: "Cau nay thieu dap an?",
                    options: [
                      { content: "A. Phuong an mot", isCorrect: false },
                      { content: "B. Phuong an hai", isCorrect: true },
                      { content: "C. Phuong an ba", isCorrect: false },
                      { content: "D. Phuong an bon", isCorrect: false },
                    ],
                  },
                  {
                    type: "SA",
                    content: "Don phan cua DNA la gi?",
                    correctAnswer: "nucleotide",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    filledAnswers: [2],
    unmatchedSolutions: [],
  }
}

// 1. Render -> parse -> validate: ban dung phai hop le, giu dung dap an,
//    gach chan va giai chi tiet.
{
  const r = renderAiResult(baseResult())
  assert(r.text, "render phai co text: " + JSON.stringify(r.problems))
  const parsed = parseTextContent(r.text)
  const v = validateDocument(parsed)
  assert(v.isValid, "ban dung phai hop le: " + JSON.stringify(v.errors))
  const kp = parsed.chapters[0].lessons[0].knowledgePoints[0]
  assert(kp.underlinedTerms.length === 2, "KP phai co 2 o gach chan")
  const q1 = kp.questions[0]
  assert(q1.options.find((o) => o.isCorrect)?.content.startsWith("B."), "cau 1 dap an B")
  assert(q1.solution && q1.solution.includes("doan DNA"), "cau 1 phai co giai chi tiet")
  const probs = verifyAiResult(SOURCE, baseResult(), parsed)
  assert(probs.length === 0, "verify phai sach: " + JSON.stringify(probs))
}

// 2. Doi dap an cua cau DA CO dap an (khong khai bao hop le) -> verify bat.
{
  const bad = baseResult()
  bad.chapters[0].lessons[0].knowledgePoints[0].questions[0].options[1].isCorrect = false
  bad.chapters[0].lessons[0].knowledgePoints[0].questions[0].options[0].isCorrect = true
  const r = renderAiResult(bad)
  const parsed = parseTextContent(r.text)
  const probs = verifyAiResult(SOURCE, bad, parsed)
  assert(probs.some((p) => p.includes("đổi đáp án") || p.includes("dap an")), "verify phai bat doi dap an: " + JSON.stringify(probs))
}

// 3. Sua than cau hoi -> verify bat (than cau khong co nguyen van trong goc).
{
  const bad = baseResult()
  bad.chapters[0].lessons[0].knowledgePoints[0].questions[0].content = "Gene la gi the nhi?"
  const r = renderAiResult(bad)
  const parsed = parseTextContent(r.text)
  const probs = verifyAiResult(SOURCE, bad, parsed)
  assert(probs.length > 0, "verify phai bat sua than cau")
}

// 4. Dien dap an cho cau thieu NHUNG khong khai bao filledAnswers -> bat.
{
  const bad = baseResult()
  delete bad.filledAnswers
  const r = renderAiResult(bad)
  const parsed = parseTextContent(r.text)
  const probs = verifyAiResult(SOURCE, bad, parsed)
  assert(probs.length > 0, "verify phai bat dien dap an khong khai bao")
}

// 5. Gach chan khong khop nguyen van -> render bao problem.
{
  const bad = baseResult()
  bad.chapters[0].lessons[0].knowledgePoints[0].underlines = [{ text: "khong co trong kp" }]
  const r = renderAiResult(bad)
  assert(!r.text && r.problems.length > 0, "render phai bao problem khi gach chan lech")
}

// 6. KP do AI sinh (generatedByAi) duoc verify mien doi chieu noi dung.
{
  const gen = baseResult()
  gen.chapters[0].lessons[0].knowledgePoints.push({
    content: "KP nay do AI sinh hoan toan moi.",
    generatedByAi: true,
    underlines: [{ text: "AI" }],
    questions: [],
  })
  const r = renderAiResult(gen)
  const parsed = parseTextContent(r.text)
  const probs = verifyAiResult(SOURCE, gen, parsed)
  assert(probs.length === 0, "KP AI sinh phai qua verify: " + JSON.stringify(probs))
}

console.log("check-ai-pipeline: OK")
