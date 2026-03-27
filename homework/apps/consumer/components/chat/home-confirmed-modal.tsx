"use client"

import { Calendar, Check, DollarSign, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface HomeConfirmedModalProps {
  open: boolean
  onContinue: () => void
}

export function HomeConfirmedModal({ open, onContinue }: HomeConfirmedModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Check className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl">We found your home</DialogTitle>
          <DialogDescription className="text-base">
            Here's what happens next
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">A quick chat about your needs</p>
              <p className="text-sm text-muted-foreground">~2 minutes</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Instant pricing options</p>
              <p className="text-sm text-muted-foreground">Customized for your home</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Choose your pro and schedule</p>
              <p className="text-sm text-muted-foreground">Installation on your timeline</p>
            </div>
          </div>
        </div>

        <Button onClick={onContinue} className="w-full" size="lg">
          Let's get started
        </Button>
      </DialogContent>
    </Dialog>
  )
}
