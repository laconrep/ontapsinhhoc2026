import { cn } from "@/lib/utils"

export type TvOs = "win" | "mac"

export function KeyCap({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[1.6rem] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-[0_1px_0_0_var(--border)]",
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Laptop({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 88 58"
      className={cn("h-full w-full", className)}
      aria-hidden="true"
    >
      <rect x="10" y="4" width="68" height="42" rx="3" className="fill-foreground/80" />
      <rect x="13" y="7" width="62" height="36" rx="1.5" className="fill-background" />
      <rect x="2" y="46" width="84" height="8" rx="2" className="fill-foreground/70" />
      <rect x="34" y="48" width="20" height="3" rx="1" className="fill-muted-foreground/50" />
    </svg>
  )
}

export function TvSet({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 62"
      className={cn("h-full w-full", className)}
      aria-hidden="true"
    >
      <rect x="4" y="2" width="88" height="50" rx="4" className="fill-foreground/85" />
      <rect x="8" y="6" width="80" height="42" rx="2" className="fill-background" />
      <rect x="42" y="52" width="12" height="5" className="fill-foreground/70" />
      <rect x="28" y="57" width="40" height="3" rx="1.5" className="fill-foreground/60" />
    </svg>
  )
}

function ShortcutRow({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <span key={`${k}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-[11px] font-semibold text-muted-foreground">+</span>}
          <KeyCap>{k}</KeyCap>
        </span>
      ))}
    </span>
  )
}

function ConnectScene({ os }: { os: TvOs }) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3">
      <div className="flex w-28 flex-col items-center gap-1">
        <div className="h-14 w-24 text-foreground">
          <Laptop />
        </div>
        <span className="text-[11px] text-muted-foreground">{os === "win" ? "Laptop" : "Mac"}</span>
      </div>
      <div className="flex min-w-16 flex-col items-center gap-1">
        <div className="h-px w-12 border-t-2 border-dashed border-primary" />
        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
          {os === "win" ? "HDMI / Win+K" : "HDMI / AirPlay"}
        </span>
        <div className="h-px w-12 border-t-2 border-dashed border-primary" />
      </div>
      <div className="flex w-28 flex-col items-center gap-1">
        <div className="h-14 w-24 text-foreground">
          <TvSet />
        </div>
        <span className="text-[11px] text-muted-foreground">TV</span>
      </div>
    </div>
  )
}

function ExtendWinScene() {
  return (
    <div className="flex justify-center px-4 py-3">
      <div className="w-full max-w-xs rounded-lg border border-border bg-background p-3 shadow-sm">
        <p className="mb-2 text-center text-xs font-semibold text-foreground">Win+P — Chiếu</p>
        <ul className="space-y-1.5 text-center text-[12px]">
          <li className="rounded-md bg-muted px-2 py-1 text-foreground">Máy tính</li>
          <li className="relative rounded-md bg-muted px-2 py-1 text-muted-foreground">
            <span className="line-through">Nhân bản</span>
          </li>
          <li className="rounded-md bg-primary px-2 py-1.5 font-semibold text-primary-foreground">
            Mở rộng
          </li>
        </ul>
      </div>
    </div>
  )
}

function ExtendMacScene() {
  return (
    <div className="flex justify-center px-4 py-3">
      <div className="w-full max-w-xs rounded-lg border border-border bg-background p-3 shadow-sm">
        <p className="mb-2 text-center text-xs font-semibold text-foreground">
          Hiển thị — màn hình riêng
        </p>
        <ul className="space-y-1.5 text-center text-[12px]">
          <li className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
            Mirror Displays — TẮT
          </li>
          <li className="rounded-md bg-primary px-2 py-1.5 font-semibold text-primary-foreground">
            Use as Separate Display
          </li>
        </ul>
      </div>
    </div>
  )
}

function PermissionScene() {
  return (
    <div className="flex justify-center px-4 py-3">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-3 py-1.5">
          <span className="size-2.5 rounded-full bg-destructive/80" />
          <span className="size-2.5 rounded-full bg-accent" />
          <span className="size-2.5 rounded-full bg-primary" />
          <span className="ml-2 text-[11px] text-muted-foreground">Chrome / Edge</span>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xs font-semibold text-foreground">Window Management</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Cho phép xem màn hình</p>
          <span className="mt-2 inline-flex rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
            Cho phép
          </span>
        </div>
      </div>
    </div>
  )
}

function PushStageScene() {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3">
      <div className="flex w-28 flex-col items-center gap-1">
        <div className="relative h-14 w-24 text-foreground">
          <Laptop />
          <span className="absolute bottom-2 left-1/2 h-1 w-6 -translate-x-1/2 rounded-sm bg-primary" />
        </div>
        <span className="text-[11px] text-muted-foreground">Console GV</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-lg font-bold text-primary" aria-hidden="true">
          {"->"}
        </span>
      </div>
      <div className="flex w-32 flex-col items-center gap-1">
        <div className="relative h-16 w-28 text-foreground">
          <TvSet />
          <span className="absolute top-3 left-1/2 -translate-x-1/2 rounded bg-primary/80 px-1.5 py-px text-[9px] font-bold text-primary-foreground">
            16:9
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">Sân khấu TV</span>
      </div>
    </div>
  )
}

const COPY: Record<TvOs, { title: string; body: string; keys: string[] }[]> = {
  win: [
    {
      title: "Kết nối TV",
      body: "Nhấn Win+K (Miracast) hoặc cắm cáp HDMI vào TV. Chờ đến khi TV hiện như màn hình mới.",
      keys: ["Win", "K"],
    },
    {
      title: "Mở rộng, không Nhân bản",
      body: "Nhấn Win+P, chọn Mở rộng. Không chọn Nhân bản — Duplicate vẫn chỉ 1 màn.",
      keys: ["Win", "P"],
    },
    {
      title: "Cho phép Window Management",
      body: "Dùng Chrome hoặc Edge. Khi trình duyệt hỏi quyền Window Management, chọn Cho phép.",
      keys: [],
    },
    {
      title: "Mở sân khấu trên TV",
      body: "Bấm nút bên dưới. Cửa sổ chỉ mở khi hệ thống thấy màn phụ. Thất bại sẽ báo rõ, không mở trên laptop.",
      keys: [],
    },
  ],
  mac: [
    {
      title: "Kết nối TV",
      body: "Cắm HDMI, hoặc Control Center → Screen Mirroring. Phím tắt: Ctrl+Cmd+F2.",
      keys: ["Ctrl", "Cmd", "F2"],
    },
    {
      title: "Dùng như màn hình riêng",
      body: "Mở Displays, tắt Mirror, chọn Use as Separate Display. Phím tắt: Opt+F2.",
      keys: ["Opt", "F2"],
    },
    {
      title: "Cho phép Window Management",
      body: "Dùng Chrome hoặc Edge. Safari thường không đủ quyền. Cho phép Window Management khi được hỏi.",
      keys: [],
    },
    {
      title: "Mở sân khấu trên TV",
      body: "Bấm nút bên dưới. Cửa sổ chỉ mở khi hệ thống thấy màn phụ. Thất bại sẽ báo rõ, không mở trên laptop.",
      keys: [],
    },
  ],
}

export function tourStepCopy(os: TvOs, step: number) {
  return COPY[os][step]
}

export function TourStepArt({ os, step }: { os: TvOs; step: number }) {
  const copy = tourStepCopy(os, step)
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
        {step === 0 && <ConnectScene os={os} />}
        {step === 1 && (os === "win" ? <ExtendWinScene /> : <ExtendMacScene />)}
        {step === 2 && <PermissionScene />}
        {step === 3 && <PushStageScene />}
      </div>
      {copy.keys.length > 0 && (
        <div className="flex items-center justify-center">
          <ShortcutRow keys={copy.keys} />
        </div>
      )}
    </div>
  )
}
