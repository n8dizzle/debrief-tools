'use client'

import { Check, Shield, Sparkles, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TRUST_ITEMS = [
  {
    icon: Shield,
    title: 'Licensed & Insured',
    description: 'We verify state licenses and active insurance policies for every single trade.',
  },
  {
    icon: Star,
    title: 'Top Rated Only',
    description: 'Pros must maintain 4.7+ stars and have at least 50 verified Google reviews.',
  },
  {
    icon: Check,
    title: 'Zero Red Flags',
    description: 'We check Better Business Bureau scores and reject anyone with unresolved complaints.',
  },
  {
    icon: Sparkles,
    title: 'Personally Vetted',
    description: 'We interview every vendor personally to ensure they align with our values.',
  },
]

interface TrustSectionProps {
  /** Click handler for learn more button */
  onLearnMore?: () => void
  /** Additional class name */
  className?: string
}

/**
 * TrustSection - Dark section explaining the vetting process
 */
export function TrustSection({ onLearnMore, className }: TrustSectionProps) {
  return (
    <section className={cn(
      'border-t border-border bg-foreground text-background px-4 py-16 sm:py-24',
      className
    )}>
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="inline-block rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary mb-4">
              Rigorous Vetting Process
            </span>
            <h2 className="text-3xl font-semibold sm:text-4xl mb-4">
              We only work with the top 1% of pros.
            </h2>
            <p className="text-muted mb-6">
              Most marketplaces let anyone join. We don&apos;t. Every contractor goes through a strict 4-step verification process before they can ever see your project.
            </p>
            <Button
              variant="outline"
              onClick={onLearnMore}
              className="border-border text-foreground bg-background hover:bg-muted min-h-[44px]"
            >
              Learn more about our standards
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {TRUST_ITEMS.map((item) => (
              <div
                key={item.title}
                className="rounded-xl bg-muted/10 p-5 border border-muted/20"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-muted">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
