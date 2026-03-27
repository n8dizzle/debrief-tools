"use client"

import { useState } from "react"
import { MessageCircle, Sparkles, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { DashboardChat } from "./dashboard-chat"

interface MobileActionBarProps {
  homeAddress: string | null
  preAuthIntent: "replacement" | "repair" | "unsure" | null
  onSendMessage?: (message: string, action: string | null) => void
}

export function MobileActionBar({
  homeAddress,
  preAuthIntent,
  onSendMessage,
}: MobileActionBarProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Determine the primary CTA based on intent
  const ctaText = preAuthIntent
    ? `Continue HVAC ${preAuthIntent === "replacement" ? "Replacement" : preAuthIntent === "repair" ? "Repair" : ""}`
    : "What would you like to do?"

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button
          className={cn(
            "fixed bottom-0 left-0 right-0 z-40 md:hidden",
            "bg-background border-t border-border",
            "px-4 py-3 flex items-center gap-3",
            "active:bg-muted transition-colors"
          )}
        >
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-foreground">{ctaText}</p>
            <p className="text-xs text-muted-foreground">Tap to explore options</p>
          </div>
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        </button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-2xl px-0 pb-0"
      >
        <SheetHeader className="px-4 pb-0">
          <div className="flex items-center justify-center mb-2">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          <SheetTitle className="sr-only">Home Actions</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          <DashboardChat
            homeAddress={homeAddress}
            preAuthIntent={preAuthIntent}
            onSendMessage={(msg, action) => {
              onSendMessage?.(msg, action)
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
