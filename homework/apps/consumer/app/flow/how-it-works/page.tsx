"use client"

import { useRouter } from "next/navigation"
import { ArrowRight, Check, DollarSign, Home, Shield, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFlowStore } from "@/lib/flow-state"

const VALUE_PROPS = [
  {
    icon: <Home className="h-6 w-6" />,
    title: "We look up your home",
    description: "Square footage, age, and layout affect what system you need. We pull this automatically.",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "You tell us what's wrong",
    description: "A few quick questions help us understand your comfort needs and recommend the right solution.",
  },
  {
    icon: <DollarSign className="h-6 w-6" />,
    title: "You see actual prices",
    description: "Not estimates. Not \"starting at.\" Real installed prices from licensed, vetted contractors.",
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "You're protected",
    description: "Every pro is licensed, insured, and background-checked. Warranties are guaranteed.",
  },
]

export default function HowItWorksPage() {
  const router = useRouter()
  const userIntent = useFlowStore((s) => s.userIntent)

  const handleContinue = () => {
    router.push("/flow/address")
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          Here's how this works
        </h1>
        {userIntent && (
          <p className="text-muted-foreground">
            You mentioned: "{userIntent}"
          </p>
        )}
        <p className="text-muted-foreground">
          We're going to get you real pricing in about 3 minutes. No sales calls. No runaround.
        </p>
      </div>

      {/* Value props */}
      <div className="space-y-4">
        {VALUE_PROPS.map((prop, index) => (
          <div
            key={prop.title}
            className="flex items-start gap-4 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              {prop.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="font-medium text-foreground mt-0.5">{prop.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {prop.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* What we need */}
      <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
        <p className="text-sm font-medium text-foreground">What we'll ask for:</p>
        <ul className="space-y-1.5">
          {[
            "Your address (to look up your home)",
            "What's going on (quick questions)",
            "Optional: A photo of your current unit",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Privacy note */}
      <p className="text-center text-xs text-muted-foreground">
        Your information stays private. We never share your contact info without permission.
      </p>

      {/* Continue button */}
      <Button onClick={handleContinue} className="w-full" size="lg">
        Got it, let's go
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  )
}
