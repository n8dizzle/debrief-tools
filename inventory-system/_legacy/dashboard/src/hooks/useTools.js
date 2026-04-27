/**
 * useTools — data hooks for the Tools section.
 *
 * useToolList(filters)     — filtered list, auto-refreshes every 30 s
 * useToolDetail(id)        — single tool + checkout history + service log
 */

import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';

const LIST_POLL = 30_000;

export function useToolList(filters = {}) {
  const [tools,   setTools]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    try {
      const params = { limit: 200, ...filters };
      Object.keys(params).forEach(k => {
        if (params[k] === '' || params[k] === false || params[k] == null) delete params[k];
      });
      const { data } = await client.get('/tools', { params });
      setTools(data.tools ?? []);
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

  return { tools, loading, error, refresh: fetch };
}

export function useToolDetail(id) {
  const [tool,        setTool]        = useState(null);
  const [checkouts,   setCheckouts]   = useState([]);
  const [serviceLog,  setServiceLog]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await client.get(`/tools/${id}`);
      setTool(data.tool);
      setCheckouts(data.checkouts  ?? data.checkout_history  ?? []);
      setServiceLog(data.service_log ?? data.service_history ?? []);
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

  return { tool, checkouts, serviceLog, loading, error, refresh: fetch };
}
