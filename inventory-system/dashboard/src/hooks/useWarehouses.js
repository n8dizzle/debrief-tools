/**
 * useWarehouses — data hooks for the Warehouses section.
 *
 * useWarehouseList()      — both warehouses summary, auto-refreshes every 60 s
 * useWarehouseDetail(id)  — single warehouse + full stock breakdown
 */

import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';

const LIST_POLL = 60_000;

export function useWarehouseList() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const fetch = useCallback(async () => {
    try {
      const { data } = await client.get('/warehouses');
      setWarehouses(data.warehouses ?? []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch();
    const t = setInterval(fetch, LIST_POLL);
    return () => clearInterval(t);
  }, [fetch]);

  return { warehouses, loading, error, refresh: fetch };
}

export function useWarehouseDetail(id) {
  const [warehouse, setWarehouse] = useState(null);
  const [stock,     setStock]     = useState([]); // warehouse_stock rows
  const [bins,      setBins]      = useState([]); // restock_bins
  const [trucks,    setTrucks]    = useState([]); // trucks assigned to this warehouse
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await client.get(`/warehouses/${id}`);
      setWarehouse(data.warehouse);
      setStock(data.stock   ?? data.warehouse_stock ?? []);
      setBins(data.bins     ?? []);
      setTrucks(data.trucks ?? []);
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

  return { warehouse, stock, bins, trucks, loading, error, refresh: fetch };
}
