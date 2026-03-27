'use client'

import { useState } from 'react'
import {
  X,
  Star,
  Clock,
  Shield,
  Check,
  ChevronDown,
  ChevronUp,
  Leaf,
  Zap,
  Plus,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import type {
  ProductDetail,
  ProductGroup,
  ProPricing,
  ProAvailability,
  TonnageOption,
  PaymentOption,
  HomeFitContext,
  RecommendedUpgrade,
} from '@/types/hvac-shopping'
import { TIER_CONFIG } from '@/types/hvac-shopping'

// Availability display config
const AVAILABILITY_CONFIG: Record<ProAvailability, { label: string; color: string }> = {
  same_day: { label: 'Available Today', color: 'text-green-600' },
  next_day: { label: 'Available Tomorrow', color: 'text-green-600' },
  this_week: { label: 'Available This Week', color: 'text-blue-600' },
  next_week: { label: 'Available Next Week', color: 'text-muted-foreground' },
}

interface ProductDetailSheetProps {
  /** Whether the sheet is open */
  open: boolean
  /** Callback when sheet should close */
  onClose: () => void
  /** The product to display (null = don't render content) */
  product: ProductDetail | null
  /** The currently selected pro (null = don't render content) */
  selectedPro: ProPricing | null
  /** HomeFit context */
  homeFit: HomeFitContext
  /** Currently selected tonnage */
  selectedTonnage?: number
  /** Currently selected upgrades */
  selectedUpgrades?: string[]
  /** Callback to change the selected pro */
  onChangePro?: () => void
  /** Callback when user selects a size */
  onSelectSize?: (tonnage: number) => void
  /** Callback when user toggles an upgrade */
  onToggleUpgrade?: (upgradeId: string) => void
  /** Callback when user proceeds to checkout */
  onAddToCart?: (config: {
    productId: string
    proId: string
    tonnage: number
    paymentType: 'cash' | 'financing'
    selectedUpgrades: string[]
  }) => void
  className?: string
}

// =============================================================================
// Selected Pro Section (AT TOP)
// =============================================================================

interface SelectedProSectionProps {
  pro: ProPricing
  onChangePro?: () => void
}

function SelectedProSection({ pro, onChangePro }: SelectedProSectionProps) {
  const availabilityConfig = AVAILABILITY_CONFIG[pro.availability]

  return (
    <div className="bg-gradient-to-r from-primary/5 to-transparent border-b border-border">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Pro logo */}
          <div className="w-14 h-14 rounded-xl bg-white border border-border flex items-center justify-center text-xl font-bold text-muted-foreground shrink-0 shadow-sm">
            {pro.logoUrl ? (
              <img src={pro.logoUrl} alt={pro.name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              pro.name.charAt(0)
            )}
          </div>

          {/* Pro info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">{pro.name}</h3>
              <div className="flex items-center gap-0.5 text-amber-500">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span className="text-sm font-medium">{pro.rating}</span>
              </div>
              <span className="text-xs text-muted-foreground">({pro.reviewCount})</span>
            </div>
            <p className={cn('text-sm font-medium', availabilityConfig.color)}>
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              {availabilityConfig.label}
            </p>
            {pro.laborWarrantyYears > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                <Shield className="w-3 h-3 inline mr-1" />
                {pro.laborWarrantyYears} year labor warranty
              </p>
            )}
          </div>

          {/* Price and change */}
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-foreground">${pro.price.toLocaleString()}</p>
            {onChangePro && (
              <button
                onClick={onChangePro}
                className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Change pro
              </button>
            )}
          </div>
        </div>

        {/* Badges */}
        {pro.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {pro.badges.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// HomeFit Context Bar
// =============================================================================

interface HomeFitBarProps {
  homeFit: HomeFitContext
  product: ProductDetail
}

function HomeFitBar({ homeFit, product }: HomeFitBarProps) {
  const tierConfig = TIER_CONFIG[product.tier]

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border overflow-x-auto scrollbar-hide">
      <Sparkles className="w-4 h-4 text-primary shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0">Your HomeFit:</span>
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
        {homeFit.tonnage}T
      </span>
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium shrink-0">
        {homeFit.systemType}
      </span>
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
        tierConfig.bgColor,
        tierConfig.color
      )}>
        {tierConfig.label}
      </span>
    </div>
  )
}

// =============================================================================
// Size Selector
// =============================================================================

interface SizeSelectorProps {
  sizes: TonnageOption[]
  selectedTonnage: number
  onSelect: (tonnage: number) => void
}

function SizeSelector({ sizes, selectedTonnage, onSelect }: SizeSelectorProps) {
  return (
    <div className="p-4 border-b border-border">
      <h4 className="text-sm font-semibold text-foreground mb-3">System Size</h4>
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => (
          <button
            key={size.tonnage}
            onClick={() => onSelect(size.tonnage)}
            className={cn(
              'relative px-4 py-2 rounded-xl border transition-all',
              selectedTonnage === size.tonnage
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:border-primary/30'
            )}
          >
            {size.isFit && (
              <span className="absolute -top-2 -right-2 inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-500 text-white text-[10px] font-medium">
                Fit
              </span>
            )}
            <div className="text-lg font-bold text-foreground">{size.tonnage}T</div>
            <div className="text-xs text-muted-foreground">${size.price.toLocaleString()}</div>
            {size.sqftRange && (
              <div className="text-[10px] text-muted-foreground/70">{size.sqftRange}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Payment Toggle
// =============================================================================

interface PaymentToggleProps {
  options: PaymentOption[]
  selectedType: 'cash' | 'financing'
  onSelect: (type: 'cash' | 'financing') => void
}

function PaymentToggle({ options, selectedType, onSelect }: PaymentToggleProps) {
  const cashOption = options.find(o => o.type === 'cash')
  const financingOption = options.find(o => o.type === 'financing')

  return (
    <div className="p-4 border-b border-border">
      <h4 className="text-sm font-semibold text-foreground mb-3">Payment Method</h4>
      <div className="grid grid-cols-2 gap-3">
        {/* Cash option */}
        {cashOption && (
          <button
            onClick={() => onSelect('cash')}
            className={cn(
              'p-3 rounded-xl border text-left transition-all',
              selectedType === 'cash'
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:border-primary/30'
            )}
          >
            <div className="text-sm font-medium text-foreground mb-1">Pay in Full</div>
            <div className="text-xl font-bold text-foreground">${cashOption.price.toLocaleString()}</div>
          </button>
        )}

        {/* Financing option */}
        {financingOption && (
          <button
            onClick={() => onSelect('financing')}
            className={cn(
              'p-3 rounded-xl border text-left transition-all',
              selectedType === 'financing'
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:border-primary/30'
            )}
          >
            <div className="text-sm font-medium text-foreground mb-1">Finance</div>
            <div className="text-xl font-bold text-foreground">
              ${financingOption.monthlyPayment?.toLocaleString()}<span className="text-sm font-normal">/mo</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {financingOption.apr}% APR · {financingOption.termMonths} months
            </div>
            {financingOption.provider && (
              <div className="text-[10px] text-muted-foreground/70">via {financingOption.provider}</div>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Warranties Section
// =============================================================================

interface WarrantiesSectionProps {
  warranties: ProductDetail['warranties']
  laborYears: number // From pro
}

function WarrantiesSection({ warranties, laborYears }: WarrantiesSectionProps) {
  return (
    <div className="p-4 border-b border-border">
      <h4 className="text-sm font-semibold text-foreground mb-3">Warranty Coverage</h4>
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-muted/50 text-center">
          <div className="text-2xl font-bold text-foreground">{warranties.partsYears}</div>
          <div className="text-xs text-muted-foreground">Year Parts</div>
        </div>
        <div className="p-3 rounded-xl bg-muted/50 text-center">
          <div className="text-2xl font-bold text-foreground">{laborYears}</div>
          <div className="text-xs text-muted-foreground">Year Labor</div>
        </div>
        <div className="p-3 rounded-xl bg-muted/50 text-center">
          <div className="text-2xl font-bold text-foreground">{warranties.compressorYears}</div>
          <div className="text-xs text-muted-foreground">Year Compressor</div>
        </div>
      </div>
      {warranties.registrationRequired && (
        <p className="text-xs text-muted-foreground mt-2">
          * Registration required within 60 days for full warranty
        </p>
      )}
    </div>
  )
}

// =============================================================================
// Scope of Work
// =============================================================================

interface ScopeOfWorkProps {
  items: string[]
}

function ScopeOfWork({ items }: ScopeOfWorkProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const displayItems = isExpanded ? items : items.slice(0, 4)

  return (
    <div className="p-4 border-b border-border">
      <h4 className="text-sm font-semibold text-foreground mb-3">Scope of Work</h4>
      <div className="space-y-2">
        {displayItems.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            <span className="text-sm text-muted-foreground">{item}</span>
          </div>
        ))}
      </div>
      {items.length > 4 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 mt-3 text-sm text-primary hover:underline"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {items.length - 4} more items
            </>
          )}
        </button>
      )}
    </div>
  )
}

// =============================================================================
// Energy Savings
// =============================================================================

interface EnergySavingsProps {
  savings: ProductDetail['energySavings']
}

function EnergySavings({ savings }: EnergySavingsProps) {
  if (!savings) return null

  return (
    <div className="p-4 border-b border-border">
      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Leaf className="w-4 h-4 text-green-600" />
        Energy Savings
      </h4>
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-green-50 text-center">
          <div className="text-xl font-bold text-green-700">${savings.annualDollars}</div>
          <div className="text-xs text-green-600">Per Year</div>
        </div>
        <div className="p-3 rounded-xl bg-green-50 text-center">
          <div className="text-xl font-bold text-green-700">${savings.tenYearDollars.toLocaleString()}</div>
          <div className="text-xs text-green-600">10 Year Savings</div>
        </div>
        <div className="p-3 rounded-xl bg-green-50 text-center">
          <div className="text-xl font-bold text-green-700">{savings.percentMoreEfficient}%</div>
          <div className="text-xs text-green-600">More Efficient</div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Recommended Upgrades
// =============================================================================

interface RecommendedUpgradesProps {
  upgrades: RecommendedUpgrade[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

function RecommendedUpgrades({ upgrades, selectedIds, onToggle }: RecommendedUpgradesProps) {
  if (upgrades.length === 0) return null

  return (
    <div className="p-4 border-b border-border">
      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500" />
        Recommended Upgrades
      </h4>
      <div className="space-y-2">
        {upgrades.map((upgrade) => {
          const isSelected = selectedIds.includes(upgrade.id)
          return (
            <button
              key={upgrade.id}
              onClick={() => onToggle(upgrade.id)}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5',
                isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
              )}>
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">{upgrade.name}</div>
                <div className="text-xs text-muted-foreground">{upgrade.description}</div>
              </div>
              <div className="text-sm font-medium text-muted-foreground shrink-0">
                +${upgrade.priceRange.min.toLocaleString()}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// Main ProductDetailSheet Component
// =============================================================================

export function ProductDetailSheet({
  open,
  onClose,
  product,
  selectedPro,
  homeFit,
  selectedTonnage: externalSelectedTonnage,
  selectedUpgrades: externalSelectedUpgrades = [],
  onChangePro,
  onSelectSize,
  onToggleUpgrade,
  onAddToCart,
  className,
}: ProductDetailSheetProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  // Use external state if provided, otherwise internal
  const [internalTonnage, setInternalTonnage] = useState(
    product?.availableSizes?.find(s => s.isFit)?.tonnage || product?.availableSizes?.[0]?.tonnage || homeFit.tonnage
  )
  const [paymentType, setPaymentType] = useState<'cash' | 'financing'>('cash')
  const [internalUpgrades, setInternalUpgrades] = useState<string[]>([])

  const selectedTonnage = externalSelectedTonnage ?? internalTonnage
  const selectedUpgrades = externalSelectedUpgrades.length > 0 ? externalSelectedUpgrades : internalUpgrades

  const handleSelectSize = (tonnage: number) => {
    setInternalTonnage(tonnage)
    onSelectSize?.(tonnage)
  }

  const handleToggleUpgrade = (id: string) => {
    const newSelected = selectedUpgrades.includes(id)
      ? selectedUpgrades.filter(u => u !== id)
      : [...selectedUpgrades, id]
    setInternalUpgrades(newSelected)
    onToggleUpgrade?.(id)
  }

  // Don't render content if product or pro is null
  if (!product || !selectedPro) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent
          side={isDesktop ? 'right' : 'bottom'}
          className="p-0 overflow-hidden"
        >
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const handleAddToCart = () => {
    onAddToCart?.({
      productId: product.id,
      proId: selectedPro.id,
      tonnage: selectedTonnage,
      paymentType,
      selectedUpgrades,
    })
  }

  // Calculate total price
  const sizePrice = product.availableSizes.find(s => s.tonnage === selectedTonnage)?.price || selectedPro.price
  const upgradesPrice = selectedUpgrades.reduce((sum, id) => {
    const upgrade = product.recommendedUpgrades.find(u => u.id === id)
    return sum + (upgrade?.priceRange.min || 0)
  }, 0)
  const totalPrice = sizePrice + upgradesPrice

  const tierConfig = TIER_CONFIG[product.tier]

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className={cn(
          isDesktop
            ? 'w-[480px] sm:max-w-[480px]'
            : 'h-[90vh] max-h-[90vh] rounded-t-2xl',
          'p-0 flex flex-col',
          className
        )}
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 flex flex-row items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
              tierConfig.bgColor,
              tierConfig.color
            )}>
              {tierConfig.label}
            </span>
            <SheetTitle className="text-left">
              {product.brand} {product.productLine}
            </SheetTitle>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </SheetClose>
        </SheetHeader>

        {/* Selected Pro (AT TOP) */}
        <SelectedProSection pro={selectedPro} onChangePro={onChangePro} />

        {/* HomeFit Context Bar */}
        <HomeFitBar homeFit={homeFit} product={product} />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Product description */}
          {product.description && (
            <div className="p-4 border-b border-border">
              <p className="text-sm text-muted-foreground">{product.description}</p>
            </div>
          )}

          {/* Size Selector */}
          {product.availableSizes.length > 1 && (
            <SizeSelector
              sizes={product.availableSizes}
              selectedTonnage={selectedTonnage}
              onSelect={handleSelectSize}
            />
          )}

          {/* Payment Toggle */}
          {product.paymentOptions.length > 0 && (
            <PaymentToggle
              options={product.paymentOptions}
              selectedType={paymentType}
              onSelect={setPaymentType}
            />
          )}

          {/* Warranties */}
          <WarrantiesSection
            warranties={product.warranties}
            laborYears={selectedPro.laborWarrantyYears}
          />

          {/* Scope of Work */}
          {product.scopeOfWork.length > 0 && (
            <ScopeOfWork items={product.scopeOfWork} />
          )}

          {/* Energy Savings */}
          <EnergySavings savings={product.energySavings} />

          {/* Recommended Upgrades */}
          <RecommendedUpgrades
            upgrades={product.recommendedUpgrades}
            selectedIds={selectedUpgrades}
            onToggle={handleToggleUpgrade}
          />

          {/* Features list */}
          {product.features.length > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Features</h4>
              <div className="space-y-2">
                {product.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <SheetFooter className="flex-shrink-0 p-4 border-t border-border bg-background">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-foreground">${totalPrice.toLocaleString()}</p>
              {paymentType === 'financing' && product.paymentOptions.find(o => o.type === 'financing') && (
                <p className="text-xs text-muted-foreground">
                  or ${product.paymentOptions.find(o => o.type === 'financing')?.monthlyPayment}/mo
                </p>
              )}
            </div>
            {selectedUpgrades.length > 0 && (
              <div className="text-right text-xs text-muted-foreground">
                +${upgradesPrice.toLocaleString()} in upgrades
              </div>
            )}
          </div>
          <Button
            onClick={handleAddToCart}
            className="w-full rounded-xl"
            size="lg"
          >
            Continue to Checkout
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default ProductDetailSheet
