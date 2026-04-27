/**
 * useReports — data hooks for the Reports / Analytics section.
 *
 * useMovementReport({ startDate, endDate })
 *   → raw stock movements for the window (consumed, received, adjusted, …)
 *
 * usePOReport()
 *   → all purchase orders (client filters by date)
 *
 * useRestockReport()
 *   → all restock batches (client filters by date)
 *
 * useDashboardStats()
 *   → summary numbers from /admin/stats/dashboard
 */

import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';

/* ─── Stock movements ───────────────────────────────────────────────────────── */
export function useMovementReport({ startDate, endDate }) {
  const [movements, setMovements] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const { data } = await client.get('/stock/movements', {
        params: { start_date: startDate, end_date: endDate, limit: 2000 },
      });
      setMovements(data.movements ?? []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);

  return { movements, loading, error, refresh: fetch };
}

/* ─── Purchase orders ───────────────────────────────────────────────────────── */
export function usePOReport() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    client.get('/purchase-orders', { params: { limit: 500 } })
      .then(({ data }) => setOrders(data.purchase_orders ?? data.orders ?? []))
      .catch(e => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, []);

  return { orders, loading, error };
}

/* ─── Restock batches ───────────────────────────────────────────────────────── */
export function useRestockReport() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    client.get('/restock-batches', { params: { limit: 500 } })
      .then(({ data }) => setBatches(data.batches ?? []))
      .catch(e => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, []);

  return { batches, loading, error };
}

/* ─── Dashboard summary stats ───────────────────────────────────────────────── */
export function useDashboardStats() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    client.get('/admin/stats/dashboard')
      .then(({ data }) => setStats(data))
      .catch(e => setError(e.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading, error };
}
