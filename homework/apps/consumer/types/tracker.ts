import type { Tables } from './database'

// Base database types
export type Order = Tables<'orders'>
export type OrderStage = Tables<'order_stages'>
export type Contractor = Tables<'contractors'>
export type ServiceType = Tables<'service_types'>
export type StageTemplate = Tables<'stage_templates'>
export type StageTemplateItem = Tables<'stage_template_items'>
export type ContractorMagicLink = Tables<'contractor_magic_links'>

// Order status enum
export type OrderStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

// Stage status enum
export type StageStatus = 'pending' | 'current' | 'completed'

// Educational content structure stored in JSONB
export interface EducationalContent {
  title: string
  description: string
  tips: string[]
}

// Order with related data for display
export interface OrderWithDetails extends Order {
  stages: OrderStage[]
  contractor: Contractor | null
  service_type: ServiceType | null
}

// Order stage with parsed educational content
export interface OrderStageWithContent extends Omit<OrderStage, 'educational_content'> {
  educational_content: EducationalContent | null
}

// Contractor job view (for magic link page)
export interface ContractorJobView {
  order: Order
  stages: OrderStage[]
  currentStage: OrderStage | null
  contractor: Contractor
}

// Order creation input
export interface CreateOrderInput {
  homeowner_id: string
  home_id?: string
  contractor_id?: string
  service_type_slug: string

  // Product details
  product_tier?: string
  product_brand?: string
  product_model?: string

  // Pricing
  base_price?: number
  addons_total?: number
  deposit_amount?: number
  total_amount?: number

  // Scheduling
  scheduled_date?: string
  scheduled_time_slot?: string

  // Contact info
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  customer_address?: string
}

// Order creation result
export interface CreateOrderResult {
  order: Order
  stages: OrderStage[]
  magic_link?: {
    token: string
    expires_at: string
  }
}

// Stage advancement result
export interface AdvanceStageResult {
  success: boolean
  new_position?: number
  is_complete?: boolean
  error?: string
}

// Magic link validation result
export interface MagicLinkValidation {
  valid: boolean
  expired?: boolean
  order_id?: string
  contractor_id?: string
  error?: string
}

// Tracker card props
export interface TrackerCardProps {
  orderId: string
  initialOrder?: OrderWithDetails
  onStageClick?: (stage: OrderStage) => void
  showEducationalContent?: boolean
  compact?: boolean
}

// Stage detail props
export interface StageDetailProps {
  stage: OrderStageWithContent
  isOpen: boolean
  onClose: () => void
}

// Realtime subscription event
export interface StageUpdateEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: OrderStage
  old: OrderStage | null
}

// API response types
export interface ApiResponse<T> {
  data?: T
  error?: string
}

export type OrderResponse = ApiResponse<OrderWithDetails>
export type CreateOrderResponse = ApiResponse<CreateOrderResult>
export type AdvanceStageResponse = ApiResponse<AdvanceStageResult>
export type ContractorJobResponse = ApiResponse<ContractorJobView>
