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
    if (code.trim().length !== 6) {
      toast.error("Mã mời gồm 6 ký tự")
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
        Nhập mã mời
      </Label>
      <div className="mt-2 flex gap-2">
        <Input
          id="invite-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="VD: ABC123"
          autoCapitalize="characters"
          className="text-base uppercase tracking-widest"
          maxLength={6}
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
