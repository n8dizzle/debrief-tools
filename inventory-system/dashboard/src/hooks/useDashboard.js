/**
 * useDashboard — fetches all data needed for the dashboard home screen.
 *
 * Parallel requests:
 *   1. /admin/stats/dashboard   — high-level counts
 *   2. /materials?below_reorder=true
 *   3. /restock-batches?status=locked
 *   4. /purchase-orders (open)
 *   5. /tools?status=checked_out
 *   6. /notifications          — alert feed
 *   7. /stock/movements        — recent activity
 */

import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';

const POLL_INTERVAL_MS = 60_000;

export function useDashboard() {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [
        statsRes, materialsRes, batchesRes, allBatchesRes, posRes,
        toolsRes, notifsRes, movementsRes,
      ] = await Promise.allSettled([
        client.get('/admin/stats/dashboard'),
        client.get('/materials',        { params: { below_reorder: true, limit: 12 } }),
        client.get('/restock-batches',  { params: { status: 'locked', limit: 12 } }),
        client.get('/restock-batches',  { params: { limit: 50 } }),
        client.get('/purchase-orders',  { params: { limit: 12 } }),
        client.get('/tools',            { params: { status: 'checked_out', limit: 12 } }),
        client.get('/notifications',    { params: { limit: 20 } }),
        client.get('/stock/movements',  { params: { limit: 15 } }),
      ]);

      setData({
        stats:           statsRes.status === 'fulfilled'        ? statsRes.value.data                    : null,
        belowReorder:    materialsRes.status === 'fulfilled'    ? materialsRes.value.data.materials       : [],
        lockedBatches:   batchesRes.status === 'fulfilled'      ? batchesRes.value.data.batches           : [],
        allBatches:      allBatchesRes.status === 'fulfilled'   ? allBatchesRes.value.data.batches        : [],
        openPOs:         posRes.status === 'fulfilled'          ? posRes.value.data.purchase_orders       : [],
        checkedOutTools: toolsRes.status === 'fulfilled'        ? toolsRes.value.data.tools               : [],
        notifications:   notifsRes.status === 'fulfilled'       ? notifsRes.value.data.notifications      : [],
        movements:       movementsRes.status === 'fulfilled'    ? movementsRes.value.data.movements       : [],
      });
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchAll]);

  return { data, loading, error, refresh: fetchAll, lastRefresh };
}
