import { getClasses } from "@/app/actions/classes"
import { ClassManager } from "@/components/teacher/class-manager"

export default async function ClassesPage() {
  const classes = await getClasses()
  return <ClassManager initialClasses={classes} />
}
