/**
 * useEquipment — data hooks for the Equipment section (ServiceTitan mirror).
 *
 * useEquipmentList(filters)  — paginated/filtered catalog, auto-refreshes every 60 s
 * useEquipmentDetail(id)     — single equipment record + service history from ST
 * useSTSyncStatus()          — last sync timestamps per entity type
 */

import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';

const LIST_POLL = 60_000;

export function useEquipmentList(filters = {}) {
  const [equipment, setEquipment] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetch = useCallback(async () => {
    try {
      const params = { limit: 200, ...filters };
      Object.keys(params).forEach(k => {
        if (params[k] === '' || params[k] == null || params[k] === false) delete params[k];
      });
      const { data } = await client.get('/equipment', { params });
      setEquipment(data.equipment ?? []);
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

  return { equipment, loading, error, refresh: fetch };
}

export function useEquipmentDetail(id) {
  const [item,       setItem]       = useState(null);
  const [serviceLog, setServiceLog] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await client.get(`/equipment/${id}`);
      setItem(data.equipment ?? data.item);
      setServiceLog(data.service_history ?? data.service_log ?? []);
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

  return { item, serviceLog, loading, error, refresh: fetch };
}

export function useSTSyncStatus() {
  const [syncs,   setSyncs]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const { data } = await client.get('/admin/stats/dashboard');
      setSyncs(data.last_st_syncs ?? []);
    } catch {
      // non-critical — silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { syncs, loading, refresh: fetch };
}
