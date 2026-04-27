/**
 * usePurchaseOrders — data hooks for the Purchase Orders section.
 *
 * usePOList(status)  — filtered list, auto-refreshes every 60 s
 * usePODetail(id)    — single PO + lines, manual refresh
 */

import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';

const LIST_POLL = 60_000;

export function usePOList(status = 'all') {
  const [pos,     setPos]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    try {
      const params = { limit: 100 };
      if (status !== 'all') params.status = status;
      const { data } = await client.get('/purchase-orders', { params });
      setPos(data.purchase_orders ?? data.pos ?? []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    fetch();
    const t = setInterval(fetch, LIST_POLL);
    return () => clearInterval(t);
  }, [fetch]);

  return { pos, loading, error, refresh: fetch };
}

export function usePODetail(id) {
  const [po,      setPo]      = useState(null);
  const [lines,   setLines]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await client.get(`/purchase-orders/${id}`);
      setPo(data.purchase_order ?? data.po);
      setLines(data.lines ?? []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetch();
  }, [fetch]);

  return { po, lines, loading, error, refresh: fetch };
}
