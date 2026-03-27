import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { AdvanceStageResult, ContractorJobView, OrderStage } from '@/types/tracker'
import { validateMagicLink } from './magic-link'

// Create admin client for server-side operations
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey)
}

// Advance order to next stage using database function
export async function advanceOrderStage(
  orderId: string,
  contractorNote?: string
): Promise<AdvanceStageResult> {
  const supabase = getAdminClient()

  const { data, error } = await supabase.rpc('advance_order_stage', {
    p_order_id: orderId,
    p_contractor_note: contractorNote,
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  const result = data as { success: boolean; new_position?: number; is_complete?: boolean; error?: string }

  return {
    success: result.success,
    new_position: result.new_position,
    is_complete: result.is_complete,
    error: result.error,
  }
}

// Advance stage via magic link token
export async function advanceStageWithToken(
  token: string,
  contractorNote?: string
): Promise<AdvanceStageResult> {
  // Validate the magic link
  const validation = await validateMagicLink(token)

  if (!validation.valid || !validation.order_id) {
    return {
      success: false,
      error: validation.error || 'Invalid token',
    }
  }

  return advanceOrderStage(validation.order_id, contractorNote)
}

// Add a note to the current stage without advancing
export async function addStageNote(
  orderId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getAdminClient()

  // Get current stage
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('current_stage_position')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return { success: false, error: 'Order not found' }
  }

  // Update current stage with note
  const currentPosition = order.current_stage_position
  if (currentPosition === null) {
    return { success: false, error: 'Order has no current stage' }
  }

  const { error: updateError } = await supabase
    .from('order_stages')
    .update({ contractor_note: note })
    .eq('order_id', orderId)
    .eq('position', currentPosition)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  return { success: true }
}

// Add note via magic link token
export async function addStageNoteWithToken(
  token: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  const validation = await validateMagicLink(token)

  if (!validation.valid || !validation.order_id) {
    return {
      success: false,
      error: validation.error || 'Invalid token',
    }
  }

  return addStageNote(validation.order_id, note)
}

// Get job details for contractor via magic link
export async function getJobForContractor(token: string): Promise<ContractorJobView | null> {
  const validation = await validateMagicLink(token)

  if (!validation.valid || !validation.order_id || !validation.contractor_id) {
    return null
  }

  const supabase = getAdminClient()

  // Fetch order with stages
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', validation.order_id)
    .single()

  if (orderError || !order) {
    return null
  }

  // Fetch stages
  const { data: stages, error: stagesError } = await supabase
    .from('order_stages')
    .select('*')
    .eq('order_id', order.id)
    .order('position')

  if (stagesError) {
    return null
  }

  // Fetch contractor
  const { data: contractor, error: contractorError } = await supabase
    .from('contractors')
    .select('*')
    .eq('id', validation.contractor_id)
    .single()

  if (contractorError || !contractor) {
    return null
  }

  // Find current stage
  const currentStage = stages.find(
    (s: OrderStage) => s.position === order.current_stage_position
  ) || null

  return {
    order,
    stages: stages as OrderStage[],
    currentStage,
    contractor,
  }
}

// Update order status
export async function updateOrderStatus(
  orderId: string,
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
): Promise<{ success: boolean; error?: string }> {
  const supabase = getAdminClient()

  const updateData: Record<string, unknown> = { status }

  // If completing, set completed_at
  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
