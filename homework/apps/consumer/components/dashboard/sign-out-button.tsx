"use client"

import { LogOut } from "lucide-react"
import { signOut } from "@/lib/supabase/actions"
import { useFlowStore } from "@/lib/flow-state"

export function SignOutButton() {
  const reset = useFlowStore((s) => s.reset)

  const handleSignOut = async () => {
    await signOut()
    reset()
    window.location.href = "/"
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
      title="Sign out"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  )
}
