/**
 * useRestock — data hooks for the Restock Queue section.
 *
 * useBatchList(status)  — paginated list, auto-refreshes every 30 s
 * useBatchDetail(id)    — single batch + lines, returned with a manual refresh fn
 */

import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';

const LIST_POLL = 30_000;

export function useBatchList(status = 'all') {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    try {
      const params = { limit: 100 };
      if (status !== 'all') params.status = status;
      const { data } = await client.get('/restock-batches', { params });
      setBatches(data.batches ?? []);
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

  return { batches, loading, error, refresh: fetch };
}

export function useBatchDetail(id) {
  const [batch,   setBatch]   = useState(null);
  const [lines,   setLines]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await client.get(`/restock-batches/${id}`);
      setBatch(data.batch);
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

  return { batch, lines, loading, error, refresh: fetch };
}
