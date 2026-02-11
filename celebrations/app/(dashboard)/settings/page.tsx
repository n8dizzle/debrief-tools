'use client';

import { useState, useEffect } from 'react';
import { useCelebrationsPermissions } from '@/hooks/useCelebrationsPermissions';
import { CelBoard, CelSlackConfig } from '@/lib/supabase';

export default function SettingsPage() {
  const { canManageSlack } = useCelebrationsPermissions();
  const [boards, setBoards] = useState<CelBoard[]>([]);
  const [configs, setConfigs] = useState<Record<string, CelSlackConfig[]>>({});
  const [loading, setLoading] = useState(true);

  // Link form
  const [selectedBoard, setSelectedBoard] = useState('');
  const [channelId, setChannelId] = useState('');
  const [channelName, setChannelName] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const boardsRes = await fetch('/api/boards?status=active');
      if (boardsRes.ok) {
        const data = await boardsRes.json();
        setBoards(data.boards);

        // Fetch slack configs for each board
        const allConfigs: Record<string, CelSlackConfig[]> = {};
        for (const board of data.boards) {
          const configRes = await fetch(`/api/boards/${board.id}/slack`);
          if (configRes.ok) {
            const configData = await configRes.json();
            if (configData.configs.length > 0) {
              allConfigs[board.id] = configData.configs;
            }
          }
        }
        setConfigs(allConfigs);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLink() {
    if (!selectedBoard || !channelId.trim()) return;
    setLinking(true);

    try {
      const res = await fetch(`/api/boards/${selectedBoard}/slack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slack_channel_id: channelId.trim(),
          slack_channel_name: channelName.trim() || null,
        }),
      });

      if (res.ok) {
        setChannelId('');
        setChannelName('');
        setSelectedBoard('');
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to link channel');
      }
    } catch (err) {
      console.error('Failed to link:', err);
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(boardId: string, configId: string) {
    if (!confirm('Unlink this channel?')) return;

    await fetch(`/api/boards/${boardId}/slack?id=${configId}`, { method: 'DELETE' });
    await fetchData();
  }

  if (!canManageSlack) {
    return (
      <div className="text-center py-16">
        <p style={{ color: 'var(--text-secondary)' }}>You don&apos;t have permission to access settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--christmas-cream)' }}>
        Settings
      </h1>

      {/* Slack Integration */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--christmas-cream)' }}>
          Slack Integration
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Link Slack channels to boards. Messages posted in linked channels will automatically appear on the board.
          Make sure the Celebrations bot has been invited to the channel first.
        </p>

        {/* Link form */}
        <div className="space-y-3 mb-6 p-4 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Board</label>
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="select"
            >
              <option value="">Select a board...</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
              Slack Channel ID
            </label>
            <input
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="input"
              placeholder="C01234ABCDE"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Right-click a channel in Slack &gt; View channel details &gt; Copy Channel ID
            </p>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
              Channel Name (optional, for display)
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="input"
              placeholder="#celebrations"
            />
          </div>

          <button
            onClick={handleLink}
            disabled={!selectedBoard || !channelId.trim() || linking}
            className="btn btn-primary"
            style={{ opacity: !selectedBoard || !channelId.trim() || linking ? 0.5 : 1 }}
          >
            {linking ? 'Linking...' : 'Link Channel'}
          </button>
        </div>

        {/* Existing links */}
        {loading ? (
          <div className="animate-pulse h-16 rounded" style={{ background: 'var(--bg-card-hover)' }} />
        ) : Object.keys(configs).length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No channels linked yet.</p>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Active Links</h3>
            {Object.entries(configs).map(([boardId, boardConfigs]) => {
              const board = boards.find(b => b.id === boardId);
              return boardConfigs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {config.slack_channel_name || config.slack_channel_id}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      → {board?.title || 'Unknown board'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnlink(boardId, config.id)}
                    className="text-xs px-3 py-1 rounded"
                    style={{ color: 'var(--status-error)' }}
                  >
                    Unlink
                  </button>
                </div>
              ));
            })}
          </div>
        )}
      </div>
    </div>
  );
}
