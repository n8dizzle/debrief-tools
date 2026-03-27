"use client"

import { MessageCircle, X } from "lucide-react"
import { usePathname } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"
import { usePersistentChat } from "./persistent-chat-provider"
import { ChatPanel } from "./chat-panel"
import { Button } from "@/components/ui/button"

export function MobileChatSheet() {
  const pathname = usePathname()
  const { mode, messages, isExpanded, setExpanded, chatPhase } = usePersistentChat()

  // Show camera button on agent page
  const showCamera = pathname === "/flow/agent"

  // Show prompt tags on homepage
  const showPromptTags = pathname === "/"

  // Don't show on hidden routes
  if (mode === "hidden") {
    return null
  }

  // Calculate unread count (messages since last viewed)
  const messageCount = messages.length

  return (
    <Sheet open={isExpanded} onOpenChange={setExpanded}>
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
        >
          <MessageCircle className="h-6 w-6" />
          {messageCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {messageCount > 9 ? "9+" : messageCount}
            </span>
          )}
          <span className="sr-only">Open chat</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-2xl p-0 flex flex-col"
      >
        <SheetHeader className="flex-shrink-0 flex flex-row items-center justify-between px-4 py-3 border-b border-border">
          <SheetTitle className="text-left">
            {chatPhase === "intro" ? "How can we help?" : "Chat"}
          </SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </SheetClose>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            showHeader={false}
            showCamera={showCamera}
            showPromptTags={showPromptTags}
            className="h-full"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
