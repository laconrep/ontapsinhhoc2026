"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChapterDto } from "@/types"

export function LessonAccordion({ chapters }: { chapters: ChapterDto[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  return (
    <div className="flex flex-col gap-3">
      {chapters.map((chapter) => {
        const isOpen = open[chapter.id] ?? false
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
                {chapter.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link
                      href={`/student/learn/${lesson.id}`}
                      className={cn(
                        "flex min-h-[52px] items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary",
                      )}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="flex-1 text-sm text-foreground">{lesson.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {lesson.knowledgePointCount} KT
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
