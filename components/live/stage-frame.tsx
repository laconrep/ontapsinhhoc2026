import type { ReactNode } from "react"

const STAGE_ASPECT_CLASS = "aspect-video"

export function StageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="@container flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-black">
      <div
        className={`${STAGE_ASPECT_CLASS} h-[min(100cqh,calc(100cqw*9/16))] w-[min(100cqw,calc(100cqh*16/9))]`}
      >
        {children}
      </div>
    </div>
  )
}
