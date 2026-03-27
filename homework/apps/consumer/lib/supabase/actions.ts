'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

async function getBaseUrl() {
  // Use explicit env var if set
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  // Try to get from headers (works on Vercel)
  const headersList = await headers()
  const host = headersList.get('host')
  const protocol = headersList.get('x-forwarded-proto') || 'http'

  if (host) {
    return `${protocol}://${host}`
  }

  // Default for local development
  return 'http://localhost:3000'
}

export async function signInWithGoogle(redirectAfterAuth?: string) {
  const supabase = await createClient()
  const baseUrl = await getBaseUrl()

  // Build callback URL with optional next param
  const callbackUrl = redirectAfterAuth
    ? `${baseUrl}/auth/callback?next=${encodeURIComponent(redirectAfterAuth)}`
    : `${baseUrl}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
