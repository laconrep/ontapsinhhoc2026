import { getQuestionBank } from "@/app/actions/questions"
import { QuestionBank } from "@/components/teacher/question-bank"

export default async function TeacherQuestionsPage() {
  const items = await getQuestionBank()
  return <QuestionBank items={items} />
}
