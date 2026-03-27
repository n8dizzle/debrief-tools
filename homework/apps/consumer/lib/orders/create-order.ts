import type { FlowState } from '@/types/flow'

interface CreateOrderResponse {
  orderId: string
  orderNumber: string
}

/**
 * Client-side order creation — calls POST /api/orders
 * Flow state uses dollars; the API route converts to cents for DB storage.
 */
export async function createOrder(
  flowState: Pick<FlowState, 'homeData' | 'selectedTier' | 'selectedPro' | 'selectedAddons' | 'discoveryData' | 'scheduledDate' | 'scheduledTime' | 'customerName' | 'customerPhone' | 'totals'>
): Promise<CreateOrderResponse> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      home_id: null, // Home ID from DB not available in flow state yet
      service_slug: 'ac-system-replacement',
      tier: flowState.selectedTier?.tier,
      pro_id: flowState.selectedPro?.id,
      selected_variables: {
        tonnage: flowState.discoveryData?.sizing?.tonnage,
        scope: flowState.discoveryData?.hvacFlow?.scope,
        heatSource: flowState.discoveryData?.hvacFlow?.heatSource,
      },
      selected_addons: flowState.selectedAddons.map((a) => ({
        id: a.id,
        name: a.name,
        price_dollars: a.price,
      })),
      base_price_dollars: flowState.selectedPro?.price ?? 0,
      addons_total_dollars: flowState.totals.addons,
      total_dollars: flowState.totals.total,
      deposit_dollars: flowState.totals.deposit,
      scheduled_date: flowState.scheduledDate,
      scheduled_time_slot: flowState.scheduledTime,
      customer_name: flowState.customerName,
      customer_phone: flowState.customerPhone,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `Order creation failed (${res.status})`)
  }

  return res.json()
}
