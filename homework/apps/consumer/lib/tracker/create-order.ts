import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { CreateOrderInput, CreateOrderResult, Order, OrderStage } from '@/types/tracker'
import { createMagicLink } from './magic-link'

// Default HVAC install template ID (seeded in migration)
const DEFAULT_HVAC_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001'

// Default internal contractor ID (seeded in migration)
const DEFAULT_INTERNAL_CONTRACTOR_ID = '00000000-0000-0000-0000-000000000002'

// Create admin client for server-side operations
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey)
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const supabase = getAdminClient()

  // Get service type by slug
  const { data: serviceType, error: serviceTypeError } = await supabase
    .from('service_types')
    .select('id')
    .eq('slug', input.service_type_slug)
    .single()

  if (serviceTypeError || !serviceType) {
    throw new Error(`Service type not found: ${input.service_type_slug}`)
  }

  // Get default template for service type
  const { data: template, error: templateError } = await supabase
    .from('stage_templates')
    .select('id')
    .eq('service_type_id', serviceType.id)
    .eq('is_default', true)
    .single()

  if (templateError || !template) {
    // Fall back to HVAC template if no default found
    console.warn('No default template found, using HVAC template')
  }

  const templateId = template?.id || DEFAULT_HVAC_TEMPLATE_ID

  // Generate order number using database function
  const { data: orderNumberData, error: orderNumberError } = await supabase
    .rpc('generate_order_number')

  if (orderNumberError) {
    throw new Error('Failed to generate order number')
  }

  const orderNumber = orderNumberData as string

  // Use internal contractor if none specified
  const contractorId = input.contractor_id || DEFAULT_INTERNAL_CONTRACTOR_ID

  // Create the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      homeowner_id: input.homeowner_id,
      home_id: input.home_id || null,
      contractor_id: contractorId,
      service_type_id: serviceType.id,
      order_number: orderNumber,
      status: 'confirmed',
      stage_template_id: templateId,
      current_stage_position: 1,

      // Product details
      product_tier: input.product_tier || null,
      product_brand: input.product_brand || null,
      product_model: input.product_model || null,

      // Pricing
      base_price: input.base_price || null,
      addons_total: input.addons_total || 0,
      deposit_amount: input.deposit_amount || null,
      total_amount: input.total_amount || null,

      // Scheduling
      scheduled_date: input.scheduled_date || null,
      scheduled_time_slot: input.scheduled_time_slot || null,

      // Contact info
      customer_name: input.customer_name || null,
      customer_phone: input.customer_phone || null,
      customer_email: input.customer_email || null,
      customer_address: input.customer_address || null,
    })
    .select()
    .single()

  if (orderError || !order) {
    throw new Error(`Failed to create order: ${orderError?.message}`)
  }

  // Copy stages from template to order using database function
  const { error: copyError } = await supabase.rpc('copy_stages_to_order', {
    p_order_id: order.id,
    p_template_id: templateId,
  })

  if (copyError) {
    // Rollback order if stages fail
    await supabase.from('orders').delete().eq('id', order.id)
    throw new Error(`Failed to create order stages: ${copyError.message}`)
  }

  // Fetch the created stages
  const { data: stages, error: stagesError } = await supabase
    .from('order_stages')
    .select('*')
    .eq('order_id', order.id)
    .order('position')

  if (stagesError) {
    throw new Error(`Failed to fetch order stages: ${stagesError.message}`)
  }

  // Create magic link for contractor
  const magicLink = await createMagicLink(contractorId, order.id)

  return {
    order: order as Order,
    stages: stages as OrderStage[],
    magic_link: magicLink || undefined,
  }
}

// Get order with all related data
export async function getOrderWithDetails(orderId: string, userId?: string) {
  const supabase = getAdminClient()

  let query = supabase
    .from('orders')
    .select(`
      *,
      stages:order_stages(*),
      contractor:contractors(*),
      service_type:service_types(*)
    `)
    .eq('id', orderId)

  // If userId provided, verify ownership
  if (userId) {
    query = query.eq('homeowner_id', userId)
  }

  const { data, error } = await query.single()

  if (error) {
    throw new Error(`Order not found: ${error.message}`)
  }

  // Sort stages by position
  if (data.stages) {
    data.stages.sort((a: OrderStage, b: OrderStage) => a.position - b.position)
  }

  return data
}

// Get all orders for a homeowner
export async function getOrdersForHomeowner(userId: string) {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      stages:order_stages(*),
      contractor:contractors(id, name, company_name),
      service_type:service_types(id, name, slug)
    `)
    .eq('homeowner_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`)
  }

  // Sort stages for each order
  return data.map((order) => ({
    ...order,
    stages: order.stages?.sort(
      (a: OrderStage, b: OrderStage) => a.position - b.position
    ) || [],
  }))
}
