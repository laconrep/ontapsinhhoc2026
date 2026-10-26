"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { joinClass } from "@/app/actions/student-class"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LogIn } from "lucide-react"

export function JoinClassCard() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [pending, startTransition] = useTransition()

  const handleJoin = () => {
    // §28: mã mới 8 ký tự, mã cũ 6 ký tự vẫn được chấp nhận (khớp
    // isInviteCodeFormat ở lib/invite-code.ts — không import trực tiếp
    // vì file đó dùng node:crypto, không dùng được phía client).
    const len = code.trim().length
    if (len !== 6 && len !== 8) {
      toast.error("Mã lớp gồm 6 hoặc 8 ký tự")
      return
    }
    startTransition(async () => {
      try {
        const res = await joinClass(code)
        if (res.alreadyJoined) {
          toast.info(`Bạn đã ở trong lớp "${res.className}"`)
        } else {
          toast.success(`Đã tham gia lớp "${res.className}"`)
        }
        setCode("")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không thể tham gia lớp")
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Label htmlFor="invite-code" className="text-sm font-semibold text-foreground">
        Nhập mã lớp
      </Label>
      <p className="mt-1 text-xs text-muted-foreground">Mã gồm 6 hoặc 8 ký tự do giáo viên cấp</p>
      <div className="mt-2 flex gap-2">
        <Input
          id="invite-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
          placeholder="VD: ABCD2345"
          autoCapitalize="characters"
          className="text-base uppercase tracking-widest"
          maxLength={8}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) handleJoin()
          }}
        />
        <Button onClick={handleJoin} disabled={pending} className="min-h-11 shrink-0">
          <LogIn className="h-4 w-4" />
          {pending ? "..." : "Vào lớp"}
        </Button>
      </div>
    </div>
  )
}
