'use client'

import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Project {
  category: string
  title: string
  price: string
  priceLabel: string
  features: string[]
}

const POPULAR_PROJECTS: Project[] = [
  {
    category: 'HVAC',
    title: 'AC System Replacement',
    price: '$4,800',
    priceLabel: 'Starting at',
    features: ['14+ SEER Efficiency', '10-Year Warranty'],
  },
  {
    category: 'Plumbing',
    title: 'Water Heater Replacement',
    price: '$1,850',
    priceLabel: 'Avg. Project Cost',
    features: ['Energy Star Certified', '6-Year Tank Warranty'],
  },
  {
    category: 'HVAC',
    title: 'Seasonal HVAC Tune-Up',
    price: '$129',
    priceLabel: 'Fixed Price',
    features: ['Lower Energy Bills', 'Prevent Breakdowns'],
  },
]

interface PopularProjectsSectionProps {
  /** Click handler for project cards */
  onProjectClick?: (project: Project) => void
  /** Additional class name */
  className?: string
}

/**
 * PopularProjectsSection - Grid of popular project cards with pricing
 */
export function PopularProjectsSection({
  onProjectClick,
  className,
}: PopularProjectsSectionProps) {
  return (
    <section className={cn('border-t border-border px-4 py-16 sm:py-24', className)}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
              Popular Projects
            </h2>
            <p className="mt-2 text-muted-foreground">
              Standardized pricing for common home needs.
            </p>
          </div>
          <Link
            href="/services"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View All Services
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {POPULAR_PROJECTS.map((project) => (
            <div
              key={project.title}
              className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all"
            >
              <div className="relative h-40 bg-gradient-to-br from-muted to-muted/50">
                <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground">
                  {project.category}
                </span>
                <div className="absolute bottom-3 left-3">
                  <p className="text-xs text-muted-foreground">{project.priceLabel}</p>
                  <p className="text-2xl font-bold text-foreground">{project.price}</p>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-foreground mb-2">{project.title}</h3>
                <ul className="space-y-1">
                  {project.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onProjectClick?.(project)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors group-hover:border-primary/30 min-h-[44px]"
                >
                  View Pricing
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
