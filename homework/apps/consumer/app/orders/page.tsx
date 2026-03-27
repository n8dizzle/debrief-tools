'use client'

import { useEffect, useState } from 'react'
import { InstallTrackerCard } from '@/components/tracker'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { OrderWithDetails } from '@/types/tracker'

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [magicLink, setMagicLink] = useState<string | null>(null)

  // Fetch orders
  const fetchOrders = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/orders')
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch orders')
      }

      setOrders(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  // Create a test order (for development)
  const createTestOrder = async () => {
    try {
      setIsCreating(true)
      setError(null)

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_type_slug: 'hvac_install',
          product_tier: 'Better',
          product_brand: 'Carrier',
          product_model: '24ACC636A003',
          base_price: 7500,
          addons_total: 500,
          deposit_amount: 1000,
          total_amount: 8000,
          scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          scheduled_time_slot: 'Morning (8am-12pm)',
          customer_name: 'Test Customer',
          customer_address: '123 Main St, Dallas, TX 75201',
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to create order')
      }

      // Show the magic link for contractor testing
      if (data.data?.magic_link?.token) {
        setMagicLink(`/job/${data.data.magic_link.token}`)
      }

      // Refresh orders list
      await fetchOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-safe">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">Your Orders</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Dev tools */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800 font-medium mb-3">
            Development Tools
          </p>
          <Button
            onClick={createTestOrder}
            disabled={isCreating}
            variant="outline"
            size="sm"
            className="bg-white"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Create Test Order
          </Button>

          {magicLink && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-amber-200">
              <p className="text-xs text-amber-700 mb-1">Contractor magic link:</p>
              <Link
                href={magicLink}
                className="text-sm text-teal-600 underline break-all"
              >
                {typeof window !== 'undefined' ? window.location.origin : ''}{magicLink}
              </Link>
              <p className="text-xs text-slate-500 mt-2">
                Open this in a new tab to test the contractor view
              </p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && orders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No orders yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Create a test order above to see the tracker in action
            </p>
          </div>
        )}

        {/* Orders list */}
        {orders.map((order) => (
          <InstallTrackerCard
            key={order.id}
            orderId={order.id}
            initialOrder={order}
            showEducationalContent
          />
        ))}
      </main>
    </div>
  )
}
