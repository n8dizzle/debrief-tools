"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useFlowStore } from "@/lib/flow-state"
import { createClient } from "@/lib/supabase/client"
import { useIsDesktop } from "@/hooks/use-media-query"
import { ChatPanel } from "@/components/chat/chat-panel"

export default function AgentPage() {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const homeData = useFlowStore((s) => s.homeData)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Check auth and redirect if not authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/flow/preview")
        return
      }
      setIsCheckingAuth(false)
    }
    checkAuth()
  }, [router])

  // Redirect if no home data
  useEffect(() => {
    if (!homeData && !isCheckingAuth) {
      router.replace("/flow/address")
    }
  }, [homeData, router, isCheckingAuth])

  if (isCheckingAuth || !homeData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Build property summary
  const propertyDetails = [
    homeData.sqft ? `${homeData.sqft.toLocaleString()} sq ft` : null,
    homeData.yearBuilt ? `Built ${homeData.yearBuilt}` : null,
    homeData.beds ? `${homeData.beds} bed` : null,
  ].filter(Boolean).join(" · ")

  return (
    <div className="flex flex-col gap-4">
      {/* Property header card */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-4">
          {/* Satellite placeholder */}
          <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Image
              src="/logo.svg"
              alt=""
              width={40}
              height={40}
              className="opacity-30"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">
              {homeData.street || homeData.formattedAddress.split(",")[0]}
            </p>
            {propertyDetails && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {propertyDetails}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Inline chat panel (desktop uses split layout) */}
      {!isDesktop && (
        <div className="flex-1 min-h-[60vh] rounded-2xl border border-border bg-card overflow-hidden">
          <ChatPanel
            showHeader={false}
            showCamera
            className="h-full"
          />
        </div>
      )}

      {/* Desktop: Just show info, chat is in split panel */}
      {isDesktop && (
        <div className="text-center text-sm text-muted-foreground py-8">
          <p>Continue the conversation in the chat panel</p>
        </div>
      )}
    </div>
  )
}
