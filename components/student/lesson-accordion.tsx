"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { assignmentStatusMeta, formatDueAt } from "@/components/student/assigned-work"
import type { AssignedLessonDto, ChapterDto } from "@/types"

export function LessonAccordion({
  chapters,
  assignmentByLessonId,
}: {
  chapters: ChapterDto[]
  assignmentByLessonId?: Record<string, AssignedLessonDto>
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    if (!assignmentByLessonId) return init
    for (const chapter of chapters) {
      if (chapter.lessons.some((l) => assignmentByLessonId[l.id])) init[chapter.id] = true
    }
    return init
  })

  return (
    <div className="flex flex-col gap-3">
      {chapters.map((chapter) => {
        const isOpen = open[chapter.id] ?? false
        const assigned = chapter.lessons.filter((l) => assignmentByLessonId?.[l.id])
        const rest = chapter.lessons.filter((l) => !assignmentByLessonId?.[l.id])
        const ordered = [...assigned, ...rest]
        return (
          <div key={chapter.id} className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [chapter.id]: !isOpen }))}
              className="flex min-h-[52px] w-full items-center justify-between gap-2 px-4 py-3 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-heading font-semibold text-foreground">{chapter.title}</span>
              {isOpen ? (
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
            </button>

            {isOpen && (
              <ul className="border-t border-border">
                {ordered.map((lesson) => {
                  const assignment = assignmentByLessonId?.[lesson.id]
                  const status = assignment ? assignmentStatusMeta(assignment.studentStatus) : null
                  const due = assignment ? formatDueAt(assignment.dueAt) : null
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/student/learn/${lesson.id}`}
                        className={cn(
                          "flex min-h-[52px] items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary",
                        )}
                      >
                        <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-foreground">{lesson.title}</span>
                          {due ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">Hạn {due}</span>
                          ) : null}
                        </span>
                        {assignment ? (
                          <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                            <Badge variant="secondary">Được giao</Badge>
                            {status ? (
                              <Badge variant="secondary" className={status.className}>
                                {status.label}
                              </Badge>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {lesson.knowledgePointCount} KT
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
