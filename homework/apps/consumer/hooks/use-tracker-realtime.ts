'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Order, OrderStage, OrderWithDetails, Contractor, ServiceType } from '@/types/tracker'

interface UseTrackerRealtimeResult {
  order: OrderWithDetails | null
  stages: OrderStage[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useTrackerRealtime(
  orderId: string,
  initialOrder?: OrderWithDetails
): UseTrackerRealtimeResult {
  const [order, setOrder] = useState<OrderWithDetails | null>(initialOrder || null)
  const [stages, setStages] = useState<OrderStage[]>(initialOrder?.stages || [])
  const [isLoading, setIsLoading] = useState(!initialOrder)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Fetch order data
  const fetchOrder = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch order with related data
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          contractor:contractors(*),
          service_type:service_types(*)
        `)
        .eq('id', orderId)
        .single()

      if (orderError) throw orderError

      // Fetch stages separately to ensure proper typing
      const { data: stagesData, error: stagesError } = await supabase
        .from('order_stages')
        .select('*')
        .eq('order_id', orderId)
        .order('position')

      if (stagesError) throw stagesError

      // Combine into OrderWithDetails
      const fullOrder: OrderWithDetails = {
        ...orderData,
        stages: stagesData || [],
        contractor: orderData.contractor as Contractor | null,
        service_type: orderData.service_type as ServiceType | null,
      }

      setOrder(fullOrder)
      setStages(stagesData || [])
    } catch (err) {
      console.error('[Tracker Realtime] Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load order')
    } finally {
      setIsLoading(false)
    }
  }, [orderId, supabase])

  // Initial fetch
  useEffect(() => {
    if (!initialOrder) {
      fetchOrder()
    }
  }, [fetchOrder, initialOrder])

  // Set up realtime subscription
  useEffect(() => {
    let channel: RealtimeChannel | null = null

    const setupRealtime = () => {
      // Subscribe to order_stages changes for this order
      channel = supabase
        .channel(`order-stages-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_stages',
            filter: `order_id=eq.${orderId}`,
          },
          (payload) => {
            console.log('[Tracker Realtime] Stage change:', payload.eventType)

            if (payload.eventType === 'UPDATE') {
              const updatedStage = payload.new as OrderStage
              setStages((prev) =>
                prev.map((s) =>
                  s.id === updatedStage.id ? updatedStage : s
                )
              )

              // Also update order's stages array
              setOrder((prev) =>
                prev
                  ? {
                      ...prev,
                      stages: prev.stages.map((s) =>
                        s.id === updatedStage.id ? updatedStage : s
                      ),
                    }
                  : null
              )
            } else if (payload.eventType === 'INSERT') {
              const newStage = payload.new as OrderStage
              setStages((prev) => {
                // Avoid duplicates
                if (prev.some((s) => s.id === newStage.id)) return prev
                return [...prev, newStage].sort((a, b) => a.position - b.position)
              })
            } else if (payload.eventType === 'DELETE') {
              const deletedId = (payload.old as OrderStage).id
              setStages((prev) => prev.filter((s) => s.id !== deletedId))
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            console.log('[Tracker Realtime] Order update:', payload)
            const updatedOrder = payload.new as Order

            setOrder((prev) =>
              prev
                ? {
                    ...prev,
                    ...updatedOrder,
                  }
                : null
            )
          }
        )
        .subscribe((status) => {
          console.log('[Tracker Realtime] Subscription status:', status)
        })
    }

    setupRealtime()

    // Cleanup on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [orderId, supabase])

  return {
    order,
    stages,
    isLoading,
    error,
    refetch: fetchOrder,
  }
}
