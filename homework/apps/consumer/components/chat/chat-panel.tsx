"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Loader2, MapPin } from "lucide-react"
import { useRouter } from "next/navigation"
import { usePersistentChat } from "./persistent-chat-provider"
import { ChatMessage } from "./chat-message"
import { ChatInput } from "./chat-input"
import { ChatGuidance } from "./chat-guidance"
import { useFlowStore } from "@/lib/flow-state"

// Determine if it's heating or cooling season (cooling = Apr-Oct in Texas)
const month = new Date().getMonth()
const isCoolingSeason = month >= 3 && month <= 9

const PROMPT_TAGS = [
  { label: "Replace my AC", value: "I need to replace my AC system" },
  {
    label: isCoolingSeason ? "AC not cooling" : "Heat not working",
    value: isCoolingSeason ? "My AC is not cooling properly" : "My heat is not working"
  },
  { label: "Water heater issue", value: "I have a water heater issue" },
  { label: "Just exploring", value: "I'm just exploring my options" },
]

type AddressPrediction = {
  place_id: string
  description: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
}

interface ChatPanelProps {
  showHeader?: boolean
  showCamera?: boolean
  showPromptTags?: boolean
  className?: string
}

export function ChatPanel({
  showHeader = true,
  showCamera = false,
  showPromptTags = false,
  className,
}: ChatPanelProps) {
  const router = useRouter()
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const {
    mode,
    chatPhase,
    messages,
    isLoading,
    sendMessage,
    sendPhoto,
    handleButtonClick,
    guidanceContent,
  } = usePersistentChat()

  const setHomeData = useFlowStore((s) => s.setHomeData)
  const introState = useFlowStore((s) => s.introState)
  const setIntroState = useFlowStore((s) => s.setIntroState)

  // Address autocomplete state
  const [addressQuery, setAddressQuery] = useState("")
  const [predictions, setPredictions] = useState<AddressPrediction[]>([])
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false)
  const [showPredictions, setShowPredictions] = useState(false)
  const [isSelectingAddress, setIsSelectingAddress] = useState(false)

  // Check if any message has showAddressInput
  const showAddressInput = messages.some((m) => m.showAddressInput) && !isSelectingAddress

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  // Focus address input when it appears
  useEffect(() => {
    if (showAddressInput) {
      setTimeout(() => addressInputRef.current?.focus(), 100)
    }
  }, [showAddressInput])

  // Hide tags after first message
  useEffect(() => {
    if (messages.length > 0 && introState.showTags) {
      setIntroState({ showTags: false })
    }
  }, [messages.length, introState.showTags, setIntroState])

  // Fetch address predictions
  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([])
      return
    }

    setIsLoadingPredictions(true)
    try {
      const response = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(input)}`
      )
      const data = await response.json()
      if (data.predictions) {
        setPredictions(data.predictions)
        setShowPredictions(true)
      }
    } catch (error) {
      console.error("Failed to fetch predictions:", error)
    } finally {
      setIsLoadingPredictions(false)
    }
  }, [])

  // Debounce address input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (addressQuery) {
        fetchPredictions(addressQuery)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [addressQuery, fetchPredictions])

  // Handle address selection
  const handleAddressSelect = async (prediction: AddressPrediction) => {
    setIsSelectingAddress(true)
    setShowPredictions(false)
    setAddressQuery(prediction.structured_formatting.main_text)

    try {
      const response = await fetch(
        `/api/places/details?place_id=${prediction.place_id}`
      )
      const data = await response.json()

      if (data.result) {
        const result = data.result
        const components = result.address_components || []
        const getComponent = (type: string) =>
          components.find((c: { types: string[] }) => c.types.includes(type))?.long_name || null

        const street = `${getComponent("street_number") || ""} ${getComponent("route") || ""}`.trim() || null

        const homeData = {
          address: prediction.description,
          placeId: prediction.place_id,
          formattedAddress: result.formatted_address,
          latitude: result.geometry?.location?.lat || 0,
          longitude: result.geometry?.location?.lng || 0,
          street: street || undefined,
          city: getComponent("locality") || getComponent("sublocality") || undefined,
          state: getComponent("administrative_area_level_1") || undefined,
          postalCode: getComponent("postal_code") || undefined,
          sqft: null,
          yearBuilt: null,
          beds: null,
          baths: null,
          lotSizeSqft: null,
          stories: null,
        }

        setHomeData(homeData)

        // Send confirmation message through chat
        await sendMessage(`My address is ${prediction.structured_formatting.main_text}`)

        // Navigate to loading page
        setTimeout(() => {
          router.push("/flow/loading")
        }, 800)
      }
    } catch (error) {
      console.error("Failed to get place details:", error)
      setIsSelectingAddress(false)
    }
  }

  // Handle prompt tag click
  const handleTagClick = (value: string) => {
    if (!isLoading) {
      sendMessage(value)
    }
  }

  // Guidance mode - show read-only tips
  if (mode === "guidance" && guidanceContent) {
    return (
      <div className={className}>
        <ChatGuidance content={guidanceContent} recentMessages={messages} />
      </div>
    )
  }

  // Hidden mode - render nothing
  if (mode === "hidden") {
    return null
  }

  // Interactive mode - full chat
  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      {showHeader && (
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">
            {chatPhase === "intro" ? "How can we help?" : "Chat"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {chatPhase === "intro"
              ? "Tell us what's going on"
              : "Ask questions or get help"}
          </p>
        </div>
      )}

      {/* Chat messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            {chatPhase === "intro"
              ? "Describe your issue or select an option below"
              : "Start a conversation"}
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id}>
              <ChatMessage
                message={message}
                onButtonClick={handleButtonClick}
              />

              {/* Inline address input after message that requested it */}
              {message.showAddressInput && !isSelectingAddress && (
                <div className="mt-3 relative ml-0">
                  <div className="flex items-center gap-2 rounded-xl border border-primary bg-background p-2">
                    <MapPin className="h-5 w-5 text-primary shrink-0" />
                    <input
                      ref={addressInputRef}
                      type="text"
                      value={addressQuery}
                      onChange={(e) => setAddressQuery(e.target.value)}
                      placeholder="Enter your address..."
                      className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                      autoComplete="off"
                    />
                    {isLoadingPredictions && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Predictions dropdown */}
                  {showPredictions && predictions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-10 max-h-60 overflow-y-auto">
                      {predictions.map((prediction) => (
                        <button
                          key={prediction.place_id}
                          onClick={() => handleAddressSelect(prediction)}
                          className="w-full px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {prediction.structured_formatting.main_text}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {prediction.structured_formatting.secondary_text}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Prompt tags - show only on intro with no messages */}
      {showPromptTags && chatPhase === "intro" && messages.length === 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {PROMPT_TAGS.map((tag) => (
              <button
                key={tag.value}
                onClick={() => handleTagClick(tag.value)}
                disabled={isLoading}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area - hide when address input is active */}
      {!showAddressInput && (
        <div className="p-4 border-t border-border">
          <ChatInput
            onSend={sendMessage}
            onPhotoUpload={showCamera ? sendPhoto : undefined}
            isLoading={isLoading}
            showCamera={showCamera}
            placeholder={
              chatPhase === "intro"
                ? "Describe your issue..."
                : "Type a message..."
            }
          />
        </div>
      )}
    </div>
  )
}
