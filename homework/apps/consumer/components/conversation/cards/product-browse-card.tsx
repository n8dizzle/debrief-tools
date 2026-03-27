'use client'

import { useState, useCallback } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  Shield,
  Sparkles,
  Check,
  ArrowRight,
  Leaf,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFlowStore } from '@/lib/flow-state'
import { getProductDetail, getCheapestPro } from '@/lib/demo-data/hvac-products'
import type {
  ProductGroup,
  ProPricing,
  ProductTier,
  ProAvailability,
  HomeFitContext,
} from '@/types/hvac-shopping'
import { TIER_CONFIG } from '@/types/hvac-shopping'

// Availability display config
const AVAILABILITY_CONFIG: Record<ProAvailability, { label: string; color: string }> = {
  same_day: { label: 'Today', color: 'text-green-600' },
  next_day: { label: 'Tomorrow', color: 'text-green-600' },
  this_week: { label: 'This Week', color: 'text-blue-600' },
  next_week: { label: 'Next Week', color: 'text-muted-foreground' },
}

interface ProductBrowseCardProps {
  /** List of product groups to display */
  products: ProductGroup[]
  /** HomeFit context for display */
  homeFit?: HomeFitContext
  /** Currently selected product ID */
  selectedProductId?: string
  /** Callback when a product is selected */
  onProductSelect?: (product: ProductGroup) => void
  /** Callback when user wants to see product details */
  onViewDetails?: (product: ProductGroup) => void
  /** Callback when a pro is selected */
  onProSelect?: (product: ProductGroup, pro: ProPricing) => void
  /** Additional class name */
  className?: string
}

// =============================================================================
// Pro Card (inline comparison)
// =============================================================================

interface ProCardProps {
  pro: ProPricing
  isSelected?: boolean
  onSelect?: () => void
  compact?: boolean
}

function ProCard({ pro, isSelected, onSelect, compact = false }: ProCardProps) {
  const availabilityConfig = AVAILABILITY_CONFIG[pro.availability]

  if (compact) {
    // Compact inline version
    return (
      <button
        onClick={onSelect}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-xl border transition-all',
          isSelected
            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
            : 'border-border hover:border-primary/30 hover:bg-muted/50'
        )}
      >
        {/* Pro avatar/logo */}
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground shrink-0">
          {pro.logoUrl ? (
            <img src={pro.logoUrl} alt={pro.name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            pro.name.charAt(0)
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate">{pro.name}</span>
            <div className="flex items-center gap-0.5 text-amber-500">
              <Star className="w-3 h-3 fill-current" />
              <span className="text-xs font-medium">{pro.rating}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={availabilityConfig.color}>{availabilityConfig.label}</span>
            <span>·</span>
            <span>{pro.laborWarrantyYears}yr labor warranty</span>
          </div>
        </div>

        {/* Price */}
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-foreground">${pro.price.toLocaleString()}</p>
        </div>
      </button>
    )
  }

  // Full version with more details
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full p-4 rounded-xl border transition-all text-left',
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'border-border hover:border-primary/30 hover:bg-muted/50'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Logo */}
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xl font-semibold text-muted-foreground shrink-0">
          {pro.logoUrl ? (
            <img src={pro.logoUrl} alt={pro.name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            pro.name.charAt(0)
          )}
        </div>

        {/* Name and rating */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground">{pro.name}</h4>
          {pro.tagline && (
            <p className="text-xs text-muted-foreground truncate">{pro.tagline}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-0.5 text-amber-500">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span className="text-sm font-medium">{pro.rating}</span>
            </div>
            <span className="text-xs text-muted-foreground">({pro.reviewCount} reviews)</span>
          </div>
        </div>

        {/* Price */}
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground">${pro.price.toLocaleString()}</p>
          <p className={cn('text-xs font-medium', availabilityConfig.color)}>
            <Clock className="w-3 h-3 inline mr-1" />
            {availabilityConfig.label}
          </p>
        </div>
      </div>

      {/* Badges */}
      {pro.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
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

      {/* Included extras */}
      {pro.includedExtras.length > 0 && (
        <div className="space-y-1">
          {pro.includedExtras.slice(0, 2).map((extra) => (
            <div key={extra} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="w-3 h-3 text-green-600" />
              {extra}
            </div>
          ))}
        </div>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className="mt-3 pt-3 border-t border-primary/20 flex items-center justify-center gap-2 text-primary text-sm font-medium">
          <Check className="w-4 h-4" />
          Selected
        </div>
      )}
    </button>
  )
}

// =============================================================================
// Product Tier Card
// =============================================================================

interface ProductTierCardProps {
  product: ProductGroup
  isSelected?: boolean
  isExpanded?: boolean
  selectedProId?: string
  onSelect?: () => void
  onToggleExpand?: () => void
  onViewDetails?: () => void
  onProSelect?: (pro: ProPricing) => void
}

function ProductTierCard({
  product,
  isSelected,
  isExpanded,
  selectedProId,
  onSelect,
  onToggleExpand,
  onViewDetails,
  onProSelect,
}: ProductTierCardProps) {
  const tierConfig = TIER_CONFIG[product.tier]

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden transition-all',
        isSelected
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border',
        product.isRecommended && !isSelected && 'ring-1 ring-primary/30'
      )}
    >
      {/* Recommended badge */}
      {product.isRecommended && (
        <div className="bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium text-center">
          <Sparkles className="w-3 h-3 inline mr-1" />
          Recommended for your home
        </div>
      )}

      {/* Main card content */}
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            {/* Tier badge */}
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold mb-2',
                tierConfig.bgColor,
                tierConfig.color
              )}
            >
              {tierConfig.label}
            </span>

            {/* Brand and product line */}
            <h3 className="text-lg font-semibold text-foreground">
              {product.brand} {product.productLine}
            </h3>

            {/* Specs */}
            <p className="text-sm text-muted-foreground">{product.specs}</p>
          </div>

          {/* SEER and savings */}
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{product.seer}</div>
            <div className="text-xs text-muted-foreground">SEER</div>
            {product.savingsPercent && (
              <div className="flex items-center gap-1 mt-1 text-green-600 text-xs font-medium">
                <Leaf className="w-3 h-3" />
                Save ~{product.savingsPercent}%
              </div>
            )}
          </div>
        </div>

        {/* Price range */}
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-2xl font-bold text-foreground">
            ${product.priceRange.min.toLocaleString()}
          </span>
          <span className="text-muted-foreground">–</span>
          <span className="text-lg text-muted-foreground">
            ${product.priceRange.max.toLocaleString()}
          </span>
        </div>

        {/* Pros count and expand toggle */}
        <button
          onClick={onToggleExpand}
          className="w-full flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>{product.prosCount} pros available</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expanded pros section */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/30 p-4">
          <div className="space-y-2 mb-4">
            {product.pros.map((pro) => (
              <ProCard
                key={pro.id}
                pro={pro}
                isSelected={selectedProId === pro.id}
                onSelect={() => onProSelect?.(pro)}
                compact
              />
            ))}
          </div>

          {/* View details button */}
          <Button
            variant="outline"
            onClick={onViewDetails}
            className="w-full rounded-xl"
          >
            View full details
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main ProductBrowseCard Component
// =============================================================================

export function ProductBrowseCard({
  products,
  homeFit,
  selectedProductId,
  onProductSelect,
  onViewDetails,
  onProSelect,
  className,
}: ProductBrowseCardProps) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)
  const [selectedProIds, setSelectedProIds] = useState<Record<string, string>>({})

  // Store actions for opening sheet
  const selectProduct = useFlowStore((s) => s.selectShoppingProduct)
  const selectPro = useFlowStore((s) => s.selectShoppingPro)
  const openSheet = useFlowStore((s) => s.openSheet)

  const handleToggleExpand = (productId: string) => {
    setExpandedProductId(expandedProductId === productId ? null : productId)
  }

  const handleProSelect = (product: ProductGroup, pro: ProPricing) => {
    setSelectedProIds({ ...selectedProIds, [product.id]: pro.id })
    selectPro(pro) // Update store
    onProSelect?.(product, pro)
  }

  const handleViewDetails = useCallback((product: ProductGroup) => {
    // Get full product detail and set in store
    const productDetail = getProductDetail(product.id)
    if (productDetail) {
      // Get the selected pro for this product, or cheapest
      const selectedProId = selectedProIds[product.id]
      const pro = selectedProId
        ? product.pros.find((p) => p.id === selectedProId) || getCheapestPro(product)
        : getCheapestPro(product)

      selectProduct(productDetail)
      if (pro) selectPro(pro)
      openSheet('product-detail')
    }
    onViewDetails?.(product)
  }, [selectedProIds, selectProduct, selectPro, openSheet, onViewDetails])

  return (
    <div
      className={cn(
        'space-y-4',
        'animate-in fade-in slide-in-from-bottom-4 duration-500',
        className
      )}
    >
      {/* HomeFit context (optional inline display) */}
      {homeFit && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-muted-foreground">
            Showing options for your{' '}
            <span className="font-medium text-foreground">
              {homeFit.tonnage}T {homeFit.systemType}
            </span>
          </span>
        </div>
      )}

      {/* Product cards */}
      <div className="space-y-3">
        {products.map((product) => (
          <ProductTierCard
            key={product.id}
            product={product}
            isSelected={selectedProductId === product.id}
            isExpanded={expandedProductId === product.id}
            selectedProId={selectedProIds[product.id]}
            onSelect={() => onProductSelect?.(product)}
            onToggleExpand={() => handleToggleExpand(product.id)}
            onViewDetails={() => handleViewDetails(product)}
            onProSelect={(pro) => handleProSelect(product, pro)}
          />
        ))}
      </div>
    </div>
  )
}

// Export individual components for flexibility
export { ProductTierCard, ProCard }
export default ProductBrowseCard
