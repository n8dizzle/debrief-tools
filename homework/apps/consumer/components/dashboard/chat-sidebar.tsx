"use client"

import { ArrowRight, Calendar, Camera, Home, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ChatSidebarProps {
  homeAddress: string | null
  preAuthIntent: "replacement" | "repair" | "unsure" | null
}

export function ChatSidebar({ homeAddress, preAuthIntent }: ChatSidebarProps) {
  return (
    <div className="flex flex-col h-full p-4">
      {/* Welcome Message */}
      <div className="mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm text-foreground leading-relaxed">
              We've done the homework.
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed pl-11">
          All your home data is now saved in your Homeroom — and it only gets smarter the more you share.
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-border my-4" />

      {/* Continue Flow Card */}
      {preAuthIntent && (
        <div className="mb-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Continue where you left off
          </h3>
          <Link href="/?continue=true" className="block">
            <div className="rounded-xl border border-border bg-background p-4 hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer group">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Home className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">
                    HVAC {preAuthIntent === "replacement" ? "Replacement" : preAuthIntent === "repair" ? "Repair" : "Options"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Ready to continue? Should only take 2-3 mins to get real pricing from local vetted pros.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border my-4" />

      {/* Exploration Cards */}
      <div className="flex-1">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          What else can you do?
        </h3>
        <div className="space-y-3">
          <ExploreCard
            icon={Calendar}
            title="Explore Your Timeline"
            description="Add home history, track maintenance, see what's coming"
            href="/dashboard/timeline"
          />
          <ExploreCard
            icon={Camera}
            title="HomeFit Magic"
            description="Snap a photo of any equipment and watch HomeFit work its magic"
            href="/dashboard/homefit"
          />
          <ExploreCard
            icon={Home}
            title="Digital Floor Plan"
            description="Get a free floor plan and 3D rendering of your home"
            href="/dashboard/floorplan"
          />
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="mt-auto pt-4">
        <p className="text-xs text-muted-foreground text-center">
          Your Homeroom at {homeAddress ? homeAddress.split(",")[0] : "your home"}
        </p>
      </div>
    </div>
  )
}

function ExploreCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType
  title: string
  description: string
  href: string
}) {
  return (
    <Link href={href} className="block">
      <div className="rounded-lg border border-border bg-background p-3 hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer group">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">
              {title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
