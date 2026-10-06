"use client"

import { KPCard } from "@/components/student/tab1-self-assess"
import type { KnowledgePointDto } from "@/types"

export function Tab1Readonly({
  knowledgePoints,
  assessments,
}: {
  knowledgePoints: KnowledgePointDto[]
  assessments: Record<string, "known" | "unknown">
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Bạn đang xem lại kiến thức đã chọn. Không thể sửa đánh giá.
      </p>
      {knowledgePoints.map((kp, i) => (
        <KPCard
          key={kp.id}
          index={i + 1}
          content={kp.content}
          value={assessments[kp.id]}
          readOnly
        />
      ))}
    </div>
  )
}
