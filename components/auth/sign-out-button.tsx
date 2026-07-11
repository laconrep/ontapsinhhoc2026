"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function SignOutButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleSignOut = () => {
    startTransition(async () => {
      await authClient.signOut()
      router.push("/sign-in")
      router.refresh()
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSignOut} disabled={pending}>
      <LogOut className="h-4 w-4" />
      {pending ? "Đang thoát..." : "Đăng xuất"}
    </Button>
  )
}
