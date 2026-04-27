/**
 * useITAssets — data hooks for the IT Assets section.
 *
 * useITAssetList(filters)    — filtered list, auto-refreshes every 60 s
 * useITAssetDetail(id)       — single asset + assignment history
 */

import { useState, useEffect, useCallback } from 'react';
import client from '../api/client.js';

const LIST_POLL = 60_000;

export function useITAssetList(filters = {}) {
  const [assets,  setAssets]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    try {
      const params = { limit: 200, ...filters };
      Object.keys(params).forEach(k => {
        if (params[k] === '' || params[k] == null || params[k] === false) delete params[k];
      });
      const { data } = await client.get('/it-assets', { params });
      setAssets(data.it_assets ?? data.assets ?? []);
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

  return { assets, loading, error, refresh: fetch };
}

export function useITAssetDetail(id) {
  const [asset,      setAsset]      = useState(null);
  const [history,    setHistory]    = useState([]); // assignment history
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await client.get(`/it-assets/${id}`);
      setAsset(data.it_asset ?? data.asset);
      setHistory(data.assignment_history ?? data.history ?? []);
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

  return { asset, history, loading, error, refresh: fetch };
}
