'use client'

import { Home, FileText, Scale, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HowItWorksSectionProps {
  /** Additional class name */
  className?: string
}

const STEPS = [
  {
    step: '01',
    icon: Home,
    title: 'We Start With Your Home',
    description: 'We pull in public home data and combine it with what you share to build a smart, living profile for your address.',
    align: 'right' as const,
  },
  {
    step: '02',
    icon: FileText,
    title: 'We Define the Work',
    description: 'Homework creates clear, standardized scopes for common projects. Local pros price against them, and we flag common additions upfront.',
    align: 'left' as const,
  },
  {
    step: '03',
    icon: Scale,
    title: 'Compare Trusted Options',
    description: 'Clear prices and scopes from trusted local pros, compared side by side.',
    align: 'right' as const,
  },
  {
    step: '04',
    icon: ArrowRight,
    title: 'Move Forward With Confidence',
    description: "Choose your pro, schedule the job, and know what's included before work begins.",
    align: 'left' as const,
  },
]

/**
 * HowItWorksSection - 4-step timeline showing the Homework process
 */
export function HowItWorksSection({ className }: HowItWorksSectionProps) {
  return (
    <section className={cn(
      'border-t border-border bg-background px-4 py-12 sm:py-16 overflow-hidden',
      className
    )}>
      <div className="mx-auto max-w-5xl">
        {/* Section Header */}
        <div className="text-center mb-10">
          <p className="text-sm font-medium tracking-widest text-primary uppercase mb-2">
            How it works
          </p>
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
            Clarity at every step
          </h2>
        </div>

        {/* Steps Timeline */}
        <div className="relative">
          {/* Vertical connecting line - hidden on mobile, visible on desktop */}
          <div className="hidden lg:block absolute left-1/2 top-4 bottom-4 w-px bg-gradient-to-b from-border via-primary/30 to-border -translate-x-1/2" />

          <div className="space-y-4 lg:space-y-0">
            {STEPS.map((item, index) => (
              <div
                key={item.step}
                className={cn(
                  'relative lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center',
                  index > 0 && 'lg:mt-6'
                )}
              >
                {/* Card */}
                <div
                  className={cn(
                    'relative',
                    item.align === 'left' ? 'lg:col-start-2' : 'lg:col-start-1'
                  )}
                >
                  <div className="group relative bg-card rounded-xl border border-border p-4 sm:p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5">
                    {/* Step number badge */}
                    <div className="absolute -top-3 left-4 sm:left-5 bg-background rounded-full">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide">
                        {item.step}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="pt-1">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-foreground/70 group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-300">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-foreground mb-1">
                            {item.title}
                          </h3>
                          <p className="text-muted-foreground text-sm leading-snug">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Center dot on timeline - desktop only */}
                <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />

                {/* Empty column for alternating layout */}
                <div className={cn(
                  'hidden lg:block',
                  item.align === 'left' ? 'lg:col-start-1 lg:row-start-1' : 'lg:col-start-2'
                )} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * FooterCTA - Call-to-action section at the bottom
 */
export function FooterCTA({
  onStartProject,
  className,
}: {
  onStartProject?: () => void
  className?: string
}) {
  return (
    <section className={cn('border-t border-border px-4 py-16', className)}>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold text-foreground sm:text-3xl mb-4">
          Ready to get started?
        </h2>
        <p className="text-muted-foreground mb-6">
          Describe your project above and get instant pricing in minutes.
        </p>
        <button
          onClick={onStartProject}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors min-h-[44px]"
        >
          Start a Project
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  )
}
