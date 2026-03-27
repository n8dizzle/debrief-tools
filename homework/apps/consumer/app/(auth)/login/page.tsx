import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Shield, Star, Check, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If already logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard')
  }

  const { error } = await searchParams

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary via-secondary to-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-secondary/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="block">
            <Image
              src="/logo.svg"
              alt="homework"
              width={120}
              height={24}
              className="h-6 w-auto"
              priority
            />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-16 sm:py-24">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl mb-2">
            Welcome to Homework
          </h1>
          <p className="text-muted-foreground">
            Sign in to manage your home and see pricing.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            There was an error signing in. Please try again.
          </div>
        )}

        {/* Login card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg shadow-primary/5 mb-8">
          <LoginForm />

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-3">
          {[
            { icon: Shield, text: "Your data is private and secure" },
            { icon: Star, text: "Access vetted, top-rated pros" },
            { icon: Check, text: "See real pricing, not estimates" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-foreground">{item.text}</span>
            </div>
          ))}
        </div>

        {/* Privacy note */}
        <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>We never share your info without permission</span>
        </div>
      </main>
    </div>
  )
}
