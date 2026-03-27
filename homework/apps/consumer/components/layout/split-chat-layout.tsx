"use client"

import { usePathname } from "next/navigation"
import { usePersistentChat } from "@/components/chat/persistent-chat-provider"
import { ChatPanel } from "@/components/chat/chat-panel"
import { MobileChatSheet } from "@/components/chat/mobile-chat-sheet"
import { useIsDesktop } from "@/hooks/use-media-query"

interface SplitChatLayoutProps {
  children: React.ReactNode
}

export function SplitChatLayout({ children }: SplitChatLayoutProps) {
  const { mode } = usePersistentChat()
  const isDesktop = useIsDesktop()
  const pathname = usePathname()

  // Show camera button on agent page
  const showCamera = pathname === "/flow/agent"

  // Show prompt tags on homepage
  const showPromptTags = pathname === "/"

  // Homepage handles its own mobile chat (inline), so don't show sheet there
  const isHomepage = pathname === "/"

  // Hidden mode - just render children
  if (mode === "hidden") {
    return <>{children}</>
  }

  // Desktop: Split view with chat on right
  if (isDesktop) {
    return (
      <div className="flex min-h-screen">
        {/* Main content - left side */}
        <main className="flex-1 w-1/2 overflow-y-auto">{children}</main>

        {/* Chat panel - right side */}
        <aside className="w-1/2 border-l border-border bg-card flex flex-col">
          <ChatPanel
            showHeader
            showCamera={showCamera}
            showPromptTags={showPromptTags}
            className="h-screen"
          />
        </aside>
      </div>
    )
  }

  // Mobile: Content + floating chat button (except homepage which has inline chat)
  return (
    <>
      {children}
      {!isHomepage && <MobileChatSheet />}
    </>
  )
}
