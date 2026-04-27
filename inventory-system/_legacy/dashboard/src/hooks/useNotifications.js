/**
 * useNotifications — polls /notifications every 60 s.
 * Exposes notifications list, unread count, and mutation helpers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import client from '../api/client.js';

const POLL_MS = 60_000;

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unread,        setUnread]        = useState(0);
  const [loading,       setLoading]       = useState(true);
  const timerRef = useRef(null);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await client.get('/notifications');
      setNotifications(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      // silently fail — bell just shows last state
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetch();
    timerRef.current = setInterval(() => fetch(true), POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [fetch]);

  const markRead = useCallback(async (id) => {
    // Optimistic
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
    try {
      await client.post(`/notifications/${id}/read`);
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
    try {
      await client.post('/notifications/read-all');
    } catch {}
  }, []);

  return { notifications, unread, loading, markRead, markAllRead, refresh: fetch };
}
