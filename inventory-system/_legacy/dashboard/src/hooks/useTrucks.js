/**
 * useTrucks — data hooks for the Trucks section.
 *
 * useTruckList(filters)   — full fleet list, auto-refreshes every 60 s
 * useTruckDetail(id)      — single truck + stock manifest
 */

import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';

const LIST_POLL = 60_000;

export function useTruckList(filters = {}) {
  const [trucks,  setTrucks]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    try {
      const params = { limit: 100, ...filters };
      Object.keys(params).forEach(k => {
        if (params[k] === '' || params[k] == null) delete params[k];
      });
      const { data } = await client.get('/trucks', { params });
      setTrucks(data.trucks ?? []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    fetch();
    const t = setInterval(fetch, LIST_POLL);
    return () => clearInterval(t);
  }, [fetch]);

  return { trucks, loading, error, refresh: fetch };
}

export function useTruckDetail(id) {
  const [truck,   setTruck]   = useState(null);
  const [stock,   setStock]   = useState([]); // truck_stock rows with material info
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await client.get(`/trucks/${id}`);
      setTruck(data.truck);
      setStock(data.stock ?? data.manifest ?? []);
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

  return { truck, stock, loading, error, refresh: fetch };
}
