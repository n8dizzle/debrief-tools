"use client"

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { useFlowStore } from "@/lib/flow-state"
import { getChatConfig, getChatApiEndpoint } from "@/lib/chat-routes"
import { getNextHVACStep, getHVACStepQuestion } from "@/lib/flow-state"
import { getInitialAgentMessage } from "@/lib/gemini"
import type { ChatMessage, ChatButton, ChatMode, ChatPhase } from "@/types/flow"

interface GuidanceContent {
  title: string
  tips: string[]
  currentStep?: string
}

interface PersistentChatContextValue {
  // Mode control
  mode: ChatMode
  chatPhase: ChatPhase

  // Chat state
  messages: ChatMessage[]
  isLoading: boolean

  // Actions
  sendMessage: (content: string) => Promise<void>
  sendPhoto: (base64: string, mimeType: string) => Promise<void>
  handleButtonClick: (button: ChatButton) => void

  // UI state (for mobile sheet)
  isExpanded: boolean
  setExpanded: (expanded: boolean) => void

  // Guidance content (for non-interactive pages)
  guidanceContent: GuidanceContent | null
}

const PersistentChatContext = createContext<PersistentChatContextValue | null>(
  null
)

export function usePersistentChat() {
  const context = useContext(PersistentChatContext)
  if (!context) {
    throw new Error(
      "usePersistentChat must be used within PersistentChatProvider"
    )
  }
  return context
}

interface PersistentChatProviderProps {
  children: ReactNode
}

export function PersistentChatProvider({
  children,
}: PersistentChatProviderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isExpanded, setExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [agentInitialized, setAgentInitialized] = useState(false)

  // Get store state and actions
  const messages = useFlowStore((s) => s.chatHistory)
  const chatPhase = useFlowStore((s) => s.chatPhase)
  const homeData = useFlowStore((s) => s.homeData)
  const discoveryData = useFlowStore((s) => s.discoveryData)
  const addChatMessage = useFlowStore((s) => s.addChatMessage)
  const updateLastMessage = useFlowStore((s) => s.updateLastMessage)
  const setChatPhase = useFlowStore((s) => s.setChatPhase)
  const setEquipment = useFlowStore((s) => s.setEquipment)
  const setComfort = useFlowStore((s) => s.setComfort)
  const setHVACFlowField = useFlowStore((s) => s.setHVACFlowField)
  const setHVACQuestionsData = useFlowStore((s) => s.setHVACQuestionsData)
  const resetHVACFlow = useFlowStore((s) => s.resetHVACFlow)

  // Get current route config
  const routeConfig = useMemo(() => getChatConfig(pathname), [pathname])
  const mode = routeConfig.mode
  const apiEndpoint = getChatApiEndpoint(pathname)

  // Update chat phase based on route
  useEffect(() => {
    if (pathname === "/" || pathname === "/flow/address") {
      if (chatPhase !== "intro") {
        setChatPhase("intro")
      }
    } else if (
      pathname === "/flow/agent" ||
      pathname.startsWith("/flow/pricing")
    ) {
      if (chatPhase !== "agent" && chatPhase !== "complete") {
        setChatPhase("agent")
      }
    }
  }, [pathname, chatPhase, setChatPhase])

  // Initialize agent greeting when entering agent page
  useEffect(() => {
    if (
      pathname === "/flow/agent" &&
      homeData &&
      !agentInitialized &&
      // Only add greeting if there are no agent messages yet
      !messages.some((m) => m.source === "agent" || m.role === "agent")
    ) {
      const initial = getInitialAgentMessage(homeData, discoveryData)
      addChatMessage({
        role: "agent",
        content: initial.message,
        buttons: initial.buttons,
        source: "agent",
      })
      setAgentInitialized(true)
    }
  }, [pathname, homeData, discoveryData, messages, agentInitialized, addChatMessage])

  // Send a text message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading || mode !== "interactive") return

      // Add user message
      addChatMessage({
        role: "user",
        content,
        source: chatPhase === "intro" ? "intro" : "agent",
      })

      // Add loading message
      addChatMessage({
        role: chatPhase === "intro" ? "assistant" : "agent",
        content: "",
        isLoading: true,
        source: chatPhase === "intro" ? "intro" : "agent",
      })

      setIsLoading(true)

      try {
        // Build chat history for API (exclude loading messages)
        const historyForApi = messages
          .filter((m) => !m.isLoading)
          .map((m) => ({ role: m.role, content: m.content }))
        historyForApi.push({ role: "user", content })

        const response = await fetch(apiEndpoint || "/api/intro/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            homeData,
            discoveryData,
            chatHistory: historyForApi,
          }),
        })

        const data = await response.json()

        // Update loading message with response
        // For intro chat, also track if address input should be shown
        if (chatPhase === "intro" && data.readyForAddress) {
          // Update the message with showAddressInput flag
          const history = useFlowStore.getState().chatHistory
          if (history.length > 0) {
            const lastMessage = history[history.length - 1]
            useFlowStore.setState({
              chatHistory: [
                ...history.slice(0, -1),
                {
                  ...lastMessage,
                  content: data.message,
                  buttons: data.buttons,
                  isLoading: false,
                  showAddressInput: true,
                },
              ],
            })
          }
        } else {
          updateLastMessage(data.message, data.buttons)
        }

        // Handle special response flags
        if (data.readyForPricing) {
          setChatPhase("complete")
          // Navigate to pricing after a short delay
          setTimeout(() => {
            router.push("/flow/pricing")
          }, 1500)
        }
      } catch (error) {
        console.error("Chat error:", error)
        updateLastMessage(
          "Sorry, I'm having trouble right now. Please try again.",
          undefined
        )
      } finally {
        setIsLoading(false)
      }
    },
    [
      isLoading,
      mode,
      chatPhase,
      messages,
      homeData,
      discoveryData,
      apiEndpoint,
      addChatMessage,
      updateLastMessage,
      setChatPhase,
    ]
  )

  // Send a photo for equipment scanning
  const sendPhoto = useCallback(
    async (base64: string, mimeType: string) => {
      if (isLoading || mode !== "interactive") return

      // Add user message showing they uploaded a photo
      addChatMessage({
        role: "user",
        content: "[Uploaded equipment photo]",
        source: "agent",
      })

      // Add loading message
      addChatMessage({
        role: "agent",
        content: "Analyzing your equipment...",
        isLoading: true,
        source: "agent",
      })

      setIsLoading(true)

      try {
        const response = await fetch("/api/equipment/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType,
          }),
        })

        const data = await response.json()

        if (data.success && data.equipment) {
          // Store equipment data
          setEquipment({
            ...data.equipment,
            method: "photo",
            photoUrl: base64,
          })

          // Build response message
          const parts: string[] = []
          if (data.equipment.brand) parts.push(`Brand: ${data.equipment.brand}`)
          if (data.equipment.model) parts.push(`Model: ${data.equipment.model}`)
          if (data.equipment.serial)
            parts.push(`Serial: ${data.equipment.serial}`)
          if (data.equipment.tonnage)
            parts.push(`Tonnage: ${data.equipment.tonnage}-ton`)
          if (data.equipment.estimatedAge)
            parts.push(`Estimated age: ~${data.equipment.estimatedAge} years`)

          const detailsText =
            parts.length > 0
              ? `Got it. Here's what I found:\n\n${parts.map((p) => `✓ ${p}`).join("\n")}`
              : "I couldn't read all the details clearly, but I'll estimate based on your home size."

          updateLastMessage(detailsText, [
            { label: "Looks right, continue", value: "continue" },
            { label: "Try another photo", value: "upload_photo" },
          ])
        } else {
          updateLastMessage(
            "I couldn't read the data plate clearly. Want to try again, or should I estimate based on your home size?",
            [
              { label: "Try another photo", value: "upload_photo" },
              { label: "Estimate for me", value: "skip" },
            ]
          )
        }
      } catch (error) {
        console.error("Scan error:", error)
        updateLastMessage(
          "Had trouble analyzing that image. Let's estimate based on your home size instead.",
          [{ label: "Continue", value: "continue" }]
        )
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, mode, addChatMessage, updateLastMessage, setEquipment]
  )

  // Handle button clicks
  const handleButtonClick = useCallback(
    (button: ChatButton) => {
      const value = button.value.toLowerCase()

      // Handle navigation buttons
      if (value === "continue_pricing" || value === "skip_to_pricing" || value === "view_pricing") {
        router.push("/flow/pricing")
        return
      }

      // Handle HVAC flow continuation from dashboard
      if (value === "continue_hvac") {
        // Get the next step in the HVAC flow
        const hvacFlow = discoveryData?.hvacFlow || null
        const nextStep = getNextHVACStep(hvacFlow)
        const stepInfo = getHVACStepQuestion(nextStep)

        // Add agent message with the next question
        addChatMessage({
          role: "agent",
          content: stepInfo.question,
          buttons: stepInfo.options?.map((opt) => ({ label: opt.label, value: opt.value })),
          source: "agent",
        })
        return
      }

      // Handle starting fresh
      if (value === "start_fresh") {
        // Reset HVAC flow data
        resetHVACFlow()
        // Add confirmation message
        addChatMessage({
          role: "agent",
          content: "No problem. Let's start fresh. To get you accurate pricing, I need to figure out your system size.",
          buttons: [
            { label: "Take a photo", value: "sizing_photo" },
            { label: "Answer questions instead", value: "sizing_questions" },
          ],
          source: "agent",
        })
        return
      }

      // Handle HVAC flow field updates based on button value prefixes
      // Intent reasons
      if (value.startsWith("intent_")) {
        const reason = value.replace("intent_", "") as "not_working" | "old_inefficient" | "exploring"
        setHVACFlowField("intentReason", reason)
      }
      // Urgency
      if (value.startsWith("urgency_")) {
        const urgency = value.replace("urgency_", "") as "emergency" | "struggling"
        setHVACFlowField("systemUrgency", urgency)
      }
      // Age
      if (value.startsWith("age_")) {
        const age = value.replace("age_", "").replace("_", "-").replace("plus", "+") as "5-10" | "10-15" | "15+" | "unknown"
        setHVACFlowField("estimatedAge", age)
      }
      // Scope
      if (value.startsWith("scope_")) {
        const scope = value.replace("scope_", "") as "whole_system" | "ac_only" | "heating_only" | "unsure"
        setHVACFlowField("scope", scope)
      }
      // Sizing method
      if (value === "sizing_photo") {
        setHVACFlowField("sizingMethod", "photo")
      } else if (value === "sizing_questions") {
        setHVACFlowField("sizingMethod", "questions")
      }
      // Thermostat count (supports both "thermostats_" and "thermostat_" prefixes)
      if (value.startsWith("thermostats_") || value.startsWith("thermostat_")) {
        const countStr = value.replace("thermostats_", "").replace("thermostat_", "")
        const count = parseInt(countStr, 10) as 1 | 2 | 3
        if (count >= 1 && count <= 3) {
          setHVACQuestionsData("thermostatCount", count)
        }
      }
      // Zone
      if (value.startsWith("zone_")) {
        const zone = value.replace("zone_", "") as "upstairs" | "downstairs" | "both"
        setHVACQuestionsData("targetZone", zone)
      }
      // Square footage (supports various naming conventions)
      if (value.startsWith("sqft_")) {
        const sqftMap: Record<string, "<1000" | "1000-1500" | "1500-2000" | "2000+" | "unknown"> = {
          "sqft_under_1000": "<1000",
          "sqft_1000_1500": "1000-1500",
          "sqft_1500_2000": "1500-2000",
          "sqft_2000_plus": "2000+",
          "sqft_over_2000": "2000+",
          "sqft_unknown": "unknown",
        }
        const sqft = sqftMap[value]
        if (sqft) setHVACQuestionsData("zoneSqft", sqft)
      }
      // Comfort issues (supports various naming conventions)
      if (value === "comfort_fine" || value === "comfort_no_issues") {
        setHVACQuestionsData("comfortIssues", false)
      } else if (value === "comfort_issues" || value === "comfort_some_issues" || value === "comfort_major_issues") {
        setHVACQuestionsData("comfortIssues", true)
      }
      // Indoor unit location
      if (value.startsWith("location_")) {
        const location = value.replace("location_", "") as "attic" | "closet" | "garage" | "basement" | "unknown"
        setHVACQuestionsData("indoorUnitLocation", location)
      }
      // Heat source
      if (value.startsWith("heat_") && !value.includes("has_gas") && !value.includes("all_electric")) {
        const heatMap: Record<string, "gas" | "electric" | "heat_pump"> = {
          "heat_gas": "gas",
          "heat_electric": "electric",
          "heat_pump": "heat_pump",
        }
        const heat = heatMap[value]
        if (heat) setHVACFlowField("heatSource", heat)
      } else if (value === "heat_has_gas") {
        setHVACFlowField("heatSource", "gas")
      } else if (value === "heat_all_electric") {
        setHVACFlowField("heatSource", "electric")
      }

      // Legacy comfort responses (keep for backward compatibility)
      if (value.includes("even") || value.includes("throughout")) {
        setComfort("tempBalance", "even")
      } else if (value.includes("some") || value.includes("spots")) {
        setComfort("tempBalance", "some_issues")
      } else if (value.includes("big") || value.includes("difference")) {
        setComfort("tempBalance", "significant")
      }

      // Handle skip equipment
      if (value === "skip" || value === "skip_for_now") {
        setEquipment({ method: "skipped" })
      }

      // Send the button VALUE as the user's response (not label)
      // This ensures the deterministic responses can match on the value
      sendMessage(button.value)
    },
    [sendMessage, setComfort, setEquipment, setHVACFlowField, setHVACQuestionsData, router, discoveryData, addChatMessage, resetHVACFlow]
  )

  // Generate guidance content based on route
  const guidanceContent = useMemo((): GuidanceContent | null => {
    if (mode !== "guidance") return null

    // Return route-specific guidance
    // This will be expanded in Phase 5
    const guidanceMap: Record<string, GuidanceContent> = {
      "/flow/address": {
        title: "Finding your home",
        currentStep: "Enter your address",
        tips: [
          "We use your address to look up property details automatically",
          "This helps us give you accurate pricing",
          "Your information is private and secure",
        ],
      },
      "/flow/preview": {
        title: "Review your home",
        currentStep: "Confirm your details",
        tips: [
          "We found your property information",
          "Sign in to continue and see pricing",
          "Your conversation will be saved",
        ],
      },
      "/flow/pricing": {
        title: "Compare your options",
        currentStep: "Choose a system tier",
        tips: [
          "Higher SEER ratings mean better efficiency",
          "Two-stage systems run quieter and control humidity better",
          "All prices include full installation",
        ],
      },
      "/flow/pros": {
        title: "Choose your pro",
        currentStep: "Select an installer",
        tips: [
          "All pros are vetted and licensed",
          "Prices shown are final - no hidden fees",
          "Labor warranties vary by installer",
        ],
      },
      "/flow/addons": {
        title: "Customize your install",
        currentStep: "Add optional extras",
        tips: [
          "Smart thermostats can save 10-15% on energy",
          "Maintenance plans keep your warranty valid",
          "Skip any you don't need",
        ],
      },
      "/flow/schedule": {
        title: "Pick your date",
        currentStep: "Schedule installation",
        tips: [
          "Most installs take 4-8 hours",
          "Next-day service available for a fee",
          "We'll confirm via text",
        ],
      },
      "/flow/checkout": {
        title: "Review and pay",
        currentStep: "Complete your order",
        tips: [
          "10% deposit due today",
          "Balance due after installation",
          "Cancel free up to 48 hours before",
        ],
      },
    }

    return guidanceMap[pathname] || null
  }, [mode, pathname])

  const value = useMemo(
    () => ({
      mode,
      chatPhase,
      messages,
      isLoading,
      sendMessage,
      sendPhoto,
      handleButtonClick,
      isExpanded,
      setExpanded,
      guidanceContent,
    }),
    [
      mode,
      chatPhase,
      messages,
      isLoading,
      sendMessage,
      sendPhoto,
      handleButtonClick,
      isExpanded,
      guidanceContent,
    ]
  )

  return (
    <PersistentChatContext.Provider value={value}>
      {children}
    </PersistentChatContext.Provider>
  )
}
