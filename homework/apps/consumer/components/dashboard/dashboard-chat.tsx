"use client"

import { useState } from "react"
import { ArrowRight, Calendar, Camera, Home, Sparkles, Send, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFlowStore } from "@/lib/flow-state"
import { getNextHVACStep, getHVACStepQuestion } from "@/lib/flow-state"

type ActionType = "hvac" | "timeline" | "homefit" | "floorplan" | null

interface ActionConfig {
  icon: React.ElementType
  title: string
  description: string
  prompts: Array<{ label: string; value: string }>
  placeholder: string
}

const ACTION_CONFIGS: Record<Exclude<ActionType, null>, ActionConfig> = {
  hvac: {
    icon: Home,
    title: "HVAC Replacement",
    description: "Get real pricing from local vetted pros",
    prompts: [
      { label: "Continue sizing", value: "continue_hvac" },
      { label: "See pricing", value: "view_pricing" },
      { label: "Start fresh", value: "start_fresh" },
    ],
    placeholder: "Ask about your HVAC system...",
  },
  timeline: {
    icon: Calendar,
    title: "Home Timeline",
    description: "Track maintenance and history",
    prompts: [
      { label: "Add past work", value: "add_history" },
      { label: "What's due soon?", value: "whats_due" },
      { label: "Maintenance tips", value: "maintenance_tips" },
    ],
    placeholder: "What would you like to track?",
  },
  homefit: {
    icon: Camera,
    title: "HomeFit Magic",
    description: "Snap photos of equipment",
    prompts: [
      { label: "Scan equipment", value: "scan_equipment" },
      { label: "Check warranty", value: "check_warranty" },
      { label: "Get specs", value: "get_specs" },
    ],
    placeholder: "Describe what you want to scan...",
  },
  floorplan: {
    icon: Home,
    title: "Digital Floor Plan",
    description: "3D rendering of your home",
    prompts: [
      { label: "Start scan", value: "start_floorplan" },
      { label: "How it works", value: "floorplan_info" },
    ],
    placeholder: "Questions about floor plans?",
  },
}

interface DashboardChatProps {
  homeAddress: string | null
  preAuthIntent: "replacement" | "repair" | "unsure" | null
  onSendMessage?: (message: string, action: ActionType) => void
}

export function DashboardChat({ homeAddress, preAuthIntent, onSendMessage }: DashboardChatProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType>(null)
  const [inputValue, setInputValue] = useState("")
  const discoveryData = useFlowStore((s) => s.discoveryData)
  const addChatMessage = useFlowStore((s) => s.addChatMessage)

  const handleActionClick = (action: ActionType) => {
    if (selectedAction === action) {
      setSelectedAction(null) // Toggle off
    } else {
      setSelectedAction(action)
    }
  }

  const handlePromptClick = (value: string) => {
    // Handle the prompt click based on the action
    if (value === "continue_hvac") {
      const hvacFlow = discoveryData?.hvacFlow || null
      const nextStep = getNextHVACStep(hvacFlow)
      const stepInfo = getHVACStepQuestion(nextStep)

      addChatMessage({
        role: "agent",
        content: stepInfo.question,
        buttons: stepInfo.options?.map((opt) => ({ label: opt.label, value: opt.value })),
        source: "agent",
      })
    } else if (value === "start_fresh") {
      addChatMessage({
        role: "agent",
        content: "No problem. Let's start fresh. To get you accurate pricing, I need to figure out your system size.",
        buttons: [
          { label: "Take a photo", value: "sizing_photo" },
          { label: "Answer questions instead", value: "sizing_questions" },
        ],
        source: "agent",
      })
    }

    onSendMessage?.(value, selectedAction)
  }

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage?.(inputValue, selectedAction)
      setInputValue("")
    }
  }

  const config = selectedAction ? ACTION_CONFIGS[selectedAction] : null

  return (
    <div className="flex flex-col h-full">
      {/* Welcome Message */}
      <div className="p-4 pb-2">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm text-foreground leading-relaxed">
              We've done the homework.
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              All your home data is saved. What would you like to do?
            </p>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        {/* HVAC Continue Card (if they have intent) */}
        {preAuthIntent && (
          <ActionCard
            icon={Home}
            title={`HVAC ${preAuthIntent === "replacement" ? "Replacement" : preAuthIntent === "repair" ? "Repair" : "Options"}`}
            description="2-3 mins to get real pricing from local vetted pros"
            isSelected={selectedAction === "hvac"}
            onClick={() => handleActionClick("hvac")}
            highlight
          />
        )}

        {/* Explore Cards */}
        <div className="pt-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Explore
          </h3>
          <div className="space-y-2">
            <ActionCard
              icon={Calendar}
              title="Home Timeline"
              description="Add history, track maintenance, see what's coming"
              isSelected={selectedAction === "timeline"}
              onClick={() => handleActionClick("timeline")}
            />
            <ActionCard
              icon={Camera}
              title="HomeFit Magic"
              description="Snap a photo of equipment and watch HomeFit work"
              isSelected={selectedAction === "homefit"}
              onClick={() => handleActionClick("homefit")}
            />
            <ActionCard
              icon={Home}
              title="Digital Floor Plan"
              description="Get a free floor plan and 3D rendering"
              isSelected={selectedAction === "floorplan"}
              onClick={() => handleActionClick("floorplan")}
            />
          </div>
        </div>
      </div>

      {/* Bottom Address Label */}
      <div className="px-4 py-2 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Your Homeroom at {homeAddress ? homeAddress.split(",")[0] : "your home"}
        </p>
      </div>

      {/* Expandable Chat Input */}
      {selectedAction && config && (
        <div className="border-t border-border bg-muted/30 animate-in slide-in-from-bottom-4 duration-200">
          {/* Collapse button */}
          <button
            onClick={() => setSelectedAction(null)}
            className="w-full py-1.5 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-3 w-3" />
            <span>Collapse</span>
          </button>

          {/* Quick prompts */}
          <div className="px-3 pb-2">
            <div className="flex flex-wrap gap-1.5">
              {config.prompts.map((prompt) => (
                <button
                  key={prompt.value}
                  onClick={() => handlePromptClick(prompt.value)}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted hover:border-primary/30 transition-colors"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text input */}
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={config.placeholder}
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="text-muted-foreground hover:text-primary disabled:opacity-50 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionCard({
  icon: Icon,
  title,
  description,
  isSelected,
  onClick,
  highlight = false,
}: {
  icon: React.ElementType
  title: string
  description: string
  isSelected: boolean
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-all",
        isSelected
          ? "border-primary bg-primary/5"
          : highlight
          ? "border-primary/30 bg-background hover:bg-muted/50 hover:border-primary/50"
          : "border-border bg-background hover:bg-muted/50 hover:border-primary/30"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
            isSelected ? "bg-primary/20" : highlight ? "bg-primary/10" : "bg-muted"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4 transition-colors",
              isSelected ? "text-primary" : highlight ? "text-primary" : "text-muted-foreground"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
        <ArrowRight
          className={cn(
            "h-4 w-4 flex-shrink-0 transition-all",
            isSelected ? "text-primary rotate-90" : "text-muted-foreground"
          )}
        />
      </div>
    </button>
  )
}
