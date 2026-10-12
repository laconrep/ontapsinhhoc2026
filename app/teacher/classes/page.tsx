import { getClasses } from "@/app/actions/classes"
import { ClassManager } from "@/components/teacher/class-manager"

export const dynamic = "force-dynamic"

export default async function ClassesPage() {
  const classes = await getClasses()
  return <ClassManager initialClasses={classes} />
}
