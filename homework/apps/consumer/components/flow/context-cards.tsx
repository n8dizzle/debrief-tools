"use client"

import { Check, ChevronRight, Home, MessageCircle, Thermometer, User, Calendar, Package, RotateCcw } from "lucide-react"
import { useFlowStore } from "@/lib/flow-state"
import type { FlowPhase } from "@/types/flow"
import { cn } from "@/lib/utils"

interface ContextCardsProps {
  className?: string
  onPhaseChange?: (phase: FlowPhase) => void
  onStartOver?: () => void
}

export function ContextCards({ className, onPhaseChange, onStartOver }: ContextCardsProps) {
  const flowPhase = useFlowStore((s) => s.flowPhase)
  const userIntent = useFlowStore((s) => s.userIntent)
  const homeData = useFlowStore((s) => s.homeData)
  const selectedTier = useFlowStore((s) => s.selectedTier)
  const selectedPro = useFlowStore((s) => s.selectedPro)
  const selectedAddons = useFlowStore((s) => s.selectedAddons)
  const scheduledDate = useFlowStore((s) => s.scheduledDate)
  const scheduledTime = useFlowStore((s) => s.scheduledTime)

  // Determine which cards to show based on phase
  const showIntent = userIntent && flowPhase !== "intro"
  const showHome = homeData && isPhaseAfter(flowPhase, "loading")
  const showTier = selectedTier && isPhaseAfter(flowPhase, "pricing")
  const showPro = selectedPro && isPhaseAfter(flowPhase, "pros")
  const showAddons = selectedAddons.length > 0 && isPhaseAfter(flowPhase, "addons")
  const showSchedule = scheduledDate && scheduledTime && isPhaseAfter(flowPhase, "schedule")

  // Don't render if nothing to show
  if (!showIntent && !showHome && !showTier && !showPro) {
    return null
  }

  const shortAddress = homeData
    ? homeData.street
      ? `${homeData.street}, ${homeData.city || ""}`
      : homeData.formattedAddress.split(",")[0]
    : ""

  const propertyDetails = homeData
    ? [
        homeData.sqft ? `${homeData.sqft.toLocaleString()} sq ft` : null,
        homeData.yearBuilt ? `Built ${homeData.yearBuilt}` : null,
      ].filter(Boolean).join(" · ")
    : ""

  // Can edit if we're past that phase
  const canEditTier = !!(selectedTier && isPhaseAfter(flowPhase, "pros"))
  const canEditPro = !!(selectedPro && isPhaseAfter(flowPhase, "addons"))
  const canEditAddons = !!(selectedAddons.length > 0 && isPhaseAfter(flowPhase, "schedule"))
  const canEditSchedule = !!(scheduledDate && scheduledTime && isPhaseAfter(flowPhase, "checkout"))

  return (
    <div className={cn("w-full max-w-2xl mx-auto space-y-3", className)}>
      {/* Start over button */}
      {onStartOver && (
        <button
          onClick={onStartOver}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <RotateCcw className="h-4 w-4" />
          Start over
        </button>
      )}

      {/* User intent card */}
      {showIntent && (
        <ContextCard
          icon={MessageCircle}
          label="You mentioned"
          value={userIntent}
          completed
        />
      )}

      {/* Home found card - simple summary */}
      {showHome && homeData && (
        <ContextCard
          icon={Home}
          label="Home found"
          value={shortAddress}
          subtitle={propertyDetails}
          completed
          highlight
        />
      )}

      {/* Selected tier card */}
      {showTier && (
        <ContextCard
          icon={Thermometer}
          label="System selected"
          value={`${selectedTier.brand} ${selectedTier.productLine}`}
          subtitle={`${selectedTier.seer} SEER · ${selectedTier.stages}-stage`}
          completed
          editable={canEditTier}
          onEdit={() => onPhaseChange?.("pricing")}
        />
      )}

      {/* Selected pro card */}
      {showPro && (
        <ContextCard
          icon={User}
          label="Pro selected"
          value={selectedPro.name}
          subtitle={`${selectedPro.rating} stars · ${selectedPro.laborWarrantyYears}-year labor warranty`}
          completed
          editable={canEditPro}
          onEdit={() => onPhaseChange?.("pros")}
        />
      )}

      {/* Add-ons card */}
      {showAddons && (
        <ContextCard
          icon={Package}
          label="Add-ons"
          value={selectedAddons.map((a) => a.name).join(", ")}
          completed
          editable={canEditAddons}
          onEdit={() => onPhaseChange?.("addons")}
        />
      )}

      {/* Schedule card */}
      {showSchedule && (
        <ContextCard
          icon={Calendar}
          label="Installation scheduled"
          value={formatScheduleDate(scheduledDate)}
          subtitle={scheduledTime}
          completed
          editable={canEditSchedule}
          onEdit={() => onPhaseChange?.("schedule")}
        />
      )}
    </div>
  )
}

interface ContextCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  subtitle?: string
  completed?: boolean
  highlight?: boolean
  editable?: boolean
  onEdit?: () => void
}

function ContextCard({
  icon: Icon,
  label,
  value,
  subtitle,
  completed,
  highlight,
  editable,
  onEdit,
}: ContextCardProps) {
  const content = (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
          highlight ? "bg-primary/20" : "bg-primary/10"
        )}
      >
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p
            className={cn(
              "text-xs font-medium",
              highlight ? "text-primary" : "text-muted-foreground"
            )}
          >
            {label}
          </p>
          {completed && <Check className="h-3.5 w-3.5 text-primary" />}
        </div>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {editable && (
        <div className="flex items-center text-muted-foreground">
          <span className="text-xs mr-1">Edit</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      )}
    </div>
  )

  if (editable && onEdit) {
    return (
      <button
        onClick={onEdit}
        className={cn(
          "w-full text-left rounded-2xl border p-4 animate-in fade-in slide-in-from-bottom-2 duration-300 transition-colors",
          highlight
            ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
            : "border-border bg-card hover:bg-muted/50"
        )}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
        highlight
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card"
      )}
    >
      {content}
    </div>
  )
}

// Helper to check if current phase is after a given phase
const PHASE_ORDER: FlowPhase[] = [
  "intro",
  "address",
  "loading",
  "auth",
  "discovery",
  "pricing",
  "pros",
  "addons",
  "schedule",
  "contact",
  "checkout",
  "confirmation",
]

function isPhaseAfter(current: FlowPhase, target: FlowPhase): boolean {
  const currentIndex = PHASE_ORDER.indexOf(current)
  const targetIndex = PHASE_ORDER.indexOf(target)
  return currentIndex >= targetIndex
}

function formatScheduleDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}
