/**
 * useMaterials — data hooks for the Materials section.
 *
 * useMaterialList(filters)   — paginated/filtered catalog, auto-refreshes every 60 s
 * useMaterialDetail(id)      — single material + warehouse stock rows
 * useMaterialMovements(id)   — recent movement history for a material
 */

import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';

const LIST_POLL = 60_000;

export function useMaterialList(filters = {}) {
  const [materials, setMaterials] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetch = useCallback(async () => {
    try {
      const params = { limit: 200, ...filters };
      // Remove empty/false filters so we don't send noise
      Object.keys(params).forEach(k => {
        if (params[k] === '' || params[k] === false || params[k] == null) delete params[k];
      });
      const { data } = await client.get('/materials', { params });
      setMaterials(data.materials ?? []);
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

  return { materials, loading, error, refresh: fetch };
}

export function useMaterialDetail(id) {
  const [material, setMaterial] = useState(null);
  const [stock,    setStock]    = useState([]); // warehouse_stock rows
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await client.get(`/materials/${id}`);
      setMaterial(data.material);
      setStock(data.stock ?? data.warehouse_stock ?? []);
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

  return { material, stock, loading, error, refresh: fetch };
}

export function useMaterialMovements(materialId) {
  const [movements, setMovements] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!materialId) return;
    try {
      const { data } = await client.get('/stock/movements', {
        params: { material_id: materialId, limit: 50 },
      });
      setMovements(data.movements ?? []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    setLoading(true);
    fetch();
  }, [fetch]);

  return { movements, loading, error, refresh: fetch };
}
