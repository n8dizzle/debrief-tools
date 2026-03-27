import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { MagicLinkValidation } from '@/types/tracker'

// Create admin client for server-side operations
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey)
}

// Generate a secure random token
export function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Create a magic link for a contractor to access an order
export async function createMagicLink(
  contractorId: string,
  orderId: string,
  expiresInHours: number = 72
): Promise<{ token: string; expires_at: string } | null> {
  const supabase = getAdminClient()

  const token = generateToken()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + expiresInHours)

  const { data, error } = await supabase
    .from('contractor_magic_links')
    .insert({
      contractor_id: contractorId,
      order_id: orderId,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating magic link:', error)
    return null
  }

  return {
    token: data.token,
    expires_at: data.expires_at,
  }
}

// Validate a magic link token
export async function validateMagicLink(token: string): Promise<MagicLinkValidation> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('contractor_magic_links')
    .select('*, orders(*), contractors(*)')
    .eq('token', token)
    .single()

  if (error || !data) {
    return {
      valid: false,
      error: 'Invalid or expired link',
    }
  }

  // Check if expired
  const expiresAt = new Date(data.expires_at)
  if (expiresAt < new Date()) {
    return {
      valid: false,
      expired: true,
      error: 'This link has expired',
    }
  }

  // Mark as used if not already
  if (!data.used_at) {
    await supabase
      .from('contractor_magic_links')
      .update({ used_at: new Date().toISOString() })
      .eq('id', data.id)
  }

  return {
    valid: true,
    order_id: data.order_id,
    contractor_id: data.contractor_id,
  }
}

// Get or refresh magic link for an order
export async function getOrCreateMagicLink(
  contractorId: string,
  orderId: string
): Promise<{ token: string; expires_at: string } | null> {
  const supabase = getAdminClient()

  // Check for existing valid link
  const { data: existingLink } = await supabase
    .from('contractor_magic_links')
    .select('token, expires_at')
    .eq('contractor_id', contractorId)
    .eq('order_id', orderId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existingLink) {
    return {
      token: existingLink.token,
      expires_at: existingLink.expires_at,
    }
  }

  // Create new link
  return createMagicLink(contractorId, orderId)
}

// Build the full magic link URL
export function buildMagicLinkUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/job/${token}`
}
