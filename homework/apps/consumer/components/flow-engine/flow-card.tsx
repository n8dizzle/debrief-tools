'use client'

import { cn } from '@/lib/utils'

// Import card components
import { SystemCard } from '@/components/conversation/cards/system-card'
import { ProductBrowseCard } from '@/components/conversation/cards/product-browse-card'
// More cards will be added here as they're built
// import { PropertyCard } from './cards/property-card'
// import { SizingCard } from './cards/sizing-card'
// etc.

interface FlowCardProps {
  /** The card type to render */
  cardType: string
  /** Props to pass to the card */
  props?: Record<string, unknown>
  /** Handler for card selection (when card has selectable options) */
  onSelect?: (value: unknown, displayText: string) => void
  /** Whether this is a completed/historical card (read-only) */
  completed?: boolean
  /** The selected value (for completed cards) */
  selectedValue?: unknown
  /** Additional class name */
  className?: string
}

/**
 * Dynamic card renderer - maps card type names to components
 */
export function FlowCard({
  cardType,
  props = {},
  onSelect,
  completed = false,
  selectedValue,
  className,
}: FlowCardProps) {
  // Get the card component
  const CardComponent = cardRegistry[cardType]

  if (!CardComponent) {
    // Placeholder for unimplemented cards
    return (
      <PlaceholderCard
        cardType={cardType}
        props={props}
        className={className}
      />
    )
  }

  return (
    <CardComponent
      {...props}
      onSelect={onSelect}
      completed={completed}
      selectedValue={selectedValue}
      className={className}
    />
  )
}

// =============================================================================
// Card Registry
// =============================================================================

type CardComponent = React.ComponentType<any>

const cardRegistry: Record<string, CardComponent> = {
  // HVAC Shopping cards
  SystemCard: SystemCard,
  ProductBrowseCard: ProductBrowseCard,

  // More cards will be added:
  // PropertyCard: PropertyCard,
  // SizingCard: SizingCard,
  // SystemTypeCard: SystemTypeCard,
  // PricingOptionsCard: PricingOptionsCard,
  // ProSelectionCard: ProSelectionCard,
  // AddonsCard: AddonsCard,
  // CalendarCard: CalendarCard,
  // TimeSlotCard: TimeSlotCard,
  // ContactCard: ContactCard,
  // OrderSummaryCard: OrderSummaryCard,
  // PaymentCard: PaymentCard,
  // ConfirmationCard: ConfirmationCard,
}

/**
 * Register a card component
 */
export function registerCard(name: string, component: CardComponent) {
  cardRegistry[name] = component
}

// =============================================================================
// Placeholder Card (for development)
// =============================================================================

interface PlaceholderCardProps {
  cardType: string
  props?: Record<string, unknown>
  className?: string
}

function PlaceholderCard({ cardType, props, className }: PlaceholderCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 border-dashed border-muted-foreground/30',
        'bg-muted/30 p-6',
        'animate-in fade-in duration-300',
        className
      )}
    >
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          {cardType}
        </p>
        <p className="text-xs text-muted-foreground/70">
          Card component not yet implemented
        </p>
        {props && Object.keys(props).length > 0 && (
          <details className="text-left mt-4">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Props
            </summary>
            <pre className="mt-2 text-xs bg-background/50 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(props, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
