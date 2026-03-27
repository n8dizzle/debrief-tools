/**
 * Flow Engine Cards
 *
 * Inline card components that render within the conversation flow.
 */

export { PropertyCard } from './property-card'
export { SizingCard } from './sizing-card'
export { PricingOptionsCard } from './pricing-options-card'
export { ProSelectionCard } from './pro-selection-card'
export { AddonsCard } from './addons-card'
export { CalendarCard } from './calendar-card'
export { TimeSlotCard } from './time-slot-card'
export { OrderSummaryCard } from './order-summary-card'
export { ConfirmationCard } from './confirmation-card'
export { SystemTypeCard } from './system-type-card'
export { ContactCard } from './contact-card'
export { PaymentCard } from './payment-card'

// Register all cards with the flow card system
import { registerCard } from '../flow-card'
import { PropertyCard } from './property-card'
import { SizingCard } from './sizing-card'
import { PricingOptionsCard } from './pricing-options-card'
import { ProSelectionCard } from './pro-selection-card'
import { AddonsCard } from './addons-card'
import { CalendarCard } from './calendar-card'
import { TimeSlotCard } from './time-slot-card'
import { OrderSummaryCard } from './order-summary-card'
import { ConfirmationCard } from './confirmation-card'
import { SystemTypeCard } from './system-type-card'
import { ContactCard } from './contact-card'
import { PaymentCard } from './payment-card'

// Register cards by name (matching step.card values in flow definitions)
registerCard('PropertyCard', PropertyCard)
registerCard('SizingCard', SizingCard)
registerCard('SizingExplainerCard', SizingCard) // Alias
registerCard('PricingOptionsCard', PricingOptionsCard)
registerCard('ProSelectionCard', ProSelectionCard)
registerCard('ProComparisonCard', ProSelectionCard) // Alias
registerCard('AddonsCard', AddonsCard)
registerCard('CalendarCard', CalendarCard)
registerCard('TimeSlotCard', TimeSlotCard)
registerCard('OrderSummaryCard', OrderSummaryCard)
registerCard('ConfirmationCard', ConfirmationCard)
registerCard('SystemTypeCard', SystemTypeCard)
registerCard('ContactCard', ContactCard)
registerCard('PaymentCard', PaymentCard)
