'use client';

import { useState, useEffect } from 'react';
import { useCelebrationsPermissions } from '@/hooks/useCelebrationsPermissions';
import { CelBoard, CelSlackConfig, SlackImportFilters } from '@/lib/supabase';

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
  const [backfilling, setBackfilling] = useState<string | null>(null); // tracks config id
  const [backfillResult, setBackfillResult] = useState<Record<string, string>>({});
  const [backfillDate, setBackfillDate] = useState<Record<string, string>>({});
  const [reImport, setReImport] = useState<Record<string, boolean>>({});
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);
  const [filterEdits, setFilterEdits] = useState<Record<string, SlackImportFilters>>({});
  const [savingFilters, setSavingFilters] = useState<string | null>(null);

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

  function getFilters(configId: string, config: CelSlackConfig): SlackImportFilters {
    return filterEdits[configId] || config.import_filters || {};
  }

  function updateFilter(configId: string, config: CelSlackConfig, update: Partial<SlackImportFilters>) {
    setFilterEdits((prev) => ({
      ...prev,
      [configId]: { ...getFilters(configId, config), ...update },
    }));
  }

  async function handleSaveFilters(boardId: string, configId: string) {
    setSavingFilters(configId);
    try {
      const res = await fetch(`/api/boards/${boardId}/slack`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: configId, import_filters: filterEdits[configId] || {} }),
      });
      if (res.ok) {
        await fetchData();
        // Clear local edits for this config
        setFilterEdits((prev) => {
          const next = { ...prev };
          delete next[configId];
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to save filters:', err);
    } finally {
      setSavingFilters(null);
    }
  }

  async function handleBackfill(boardId: string, configId: string, channelId: string) {
    setBackfilling(configId);
    setBackfillResult((prev) => ({ ...prev, [configId]: '' }));
    try {
      const date = backfillDate[configId] || '2026-01-01';
      const since = new Date(date + 'T00:00:00').toISOString();
      const res = await fetch(`/api/boards/${boardId}/slack/backfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ since, channel_id: channelId, re_import: reImport[configId] || false }),
      });
      const data = await res.json();
      if (res.ok) {
        const parts: string[] = [];
        if (data.imported) parts.push(`${data.imported} new`);
        if (data.updated) parts.push(`${data.updated} re-imported`);
        if (data.skipped) parts.push(`${data.skipped} already imported`);
        if (data.filtered) parts.push(`${data.filtered} filtered out`);
        setBackfillResult((prev) => ({ ...prev, [configId]: parts.join(', ') || 'No messages found' }));
      } else {
        setBackfillResult((prev) => ({ ...prev, [configId]: `Error: ${data.error}` }));
      }
    } catch (err: any) {
      setBackfillResult((prev) => ({ ...prev, [configId]: `Failed to backfill: ${err.message || 'unknown error'}` }));
    } finally {
      setBackfilling(null);
    }
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
              return boardConfigs.map((config) => {
                const isExpanded = expandedConfig === config.id;
                const currentFilters = getFilters(config.id, config);
                const hasEdits = !!filterEdits[config.id];

                return (
                  <div
                    key={config.id}
                    className="rounded-lg overflow-hidden"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
                  >
                    {/* Channel header */}
                    <div className="flex items-center justify-between p-3">
                      <div
                        className="cursor-pointer flex-1"
                        onClick={() => setExpandedConfig(isExpanded ? null : config.id)}
                      >
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {config.slack_channel_name || config.slack_channel_id}
                          <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {isExpanded ? '\u25B2' : '\u25BC'} Filters
                          </span>
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          &rarr; {board?.title || 'Unknown board'}
                          <span className="mx-1">|</span>
                          <code
                            className="cursor-pointer hover:underline"
                            title="Click to copy"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(config.slack_channel_id);
                            }}
                          >
                            {config.slack_channel_id}
                          </code>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={backfillDate[config.id] || '2026-01-01'}
                            onChange={(e) => setBackfillDate(prev => ({ ...prev, [config.id]: e.target.value }))}
                            className="input text-xs py-1 px-2"
                            style={{ width: '140px' }}
                          />
                          <button
                            onClick={() => handleBackfill(boardId, config.id, config.slack_channel_id)}
                            disabled={backfilling === config.id}
                            className="text-xs px-3 py-1 rounded whitespace-nowrap"
                            style={{
                              background: 'var(--christmas-green)',
                              color: 'var(--christmas-cream)',
                              opacity: backfilling === config.id ? 0.5 : 1,
                            }}
                          >
                            {backfilling === config.id ? 'Importing...' : 'Backfill'}
                          </button>
                          <button
                            onClick={() => handleUnlink(boardId, config.id)}
                            className="text-xs px-3 py-1 rounded"
                            style={{ color: 'var(--status-error)' }}
                          >
                            Unlink
                          </button>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={reImport[config.id] || false}
                            onChange={(e) => setReImport(prev => ({ ...prev, [config.id]: e.target.checked }))}
                            className="accent-[var(--christmas-green)]"
                          />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Re-import existing (update text &amp; send to review)
                          </span>
                        </label>
                        {backfillResult[config.id] && (
                          <span className="text-xs" style={{
                            color: backfillResult[config.id].startsWith('Error') ? 'var(--status-error)' : 'var(--status-success)',
                          }}>
                            {backfillResult[config.id]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded filter options */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <p className="text-xs font-medium pt-3" style={{ color: 'var(--text-secondary)' }}>
                          Import Filters
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Filters apply to both backfill and real-time imports. Messages that don&apos;t match are skipped entirely.
                        </p>

                        {/* Media only toggle */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentFilters.media_only || false}
                            onChange={(e) => updateFilter(config.id, config, { media_only: e.target.checked })}
                            className="accent-[var(--christmas-green)]"
                          />
                          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            Media only (photos, videos, GIFs)
                          </span>
                        </label>

                        {/* Min reactions */}
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                            Minimum reactions (backfill only)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={currentFilters.min_reactions || ''}
                            onChange={(e) => updateFilter(config.id, config, {
                              min_reactions: e.target.value ? parseInt(e.target.value) : undefined,
                            })}
                            className="input text-sm"
                            placeholder="0"
                            style={{ width: '100px' }}
                          />
                        </div>

                        {/* Reaction emojis */}
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                            Require specific reactions (comma-separated, e.g. tada,heart,fire)
                          </label>
                          <input
                            type="text"
                            value={(currentFilters.reaction_emojis || []).join(', ')}
                            onChange={(e) => updateFilter(config.id, config, {
                              reaction_emojis: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : undefined,
                            })}
                            className="input text-sm"
                            placeholder="tada, heart, fire"
                          />
                        </div>

                        {/* Keywords include */}
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                            Include keywords (comma-separated, message must contain at least one)
                          </label>
                          <input
                            type="text"
                            value={(currentFilters.keywords_include || []).join(', ')}
                            onChange={(e) => updateFilter(config.id, config, {
                              keywords_include: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : undefined,
                            })}
                            className="input text-sm"
                            placeholder="birthday, congrats, celebration"
                          />
                        </div>

                        {/* Keywords exclude */}
                        <div>
                          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                            Exclude keywords (comma-separated, skip messages containing any)
                          </label>
                          <input
                            type="text"
                            value={(currentFilters.keywords_exclude || []).join(', ')}
                            onChange={(e) => updateFilter(config.id, config, {
                              keywords_exclude: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : undefined,
                            })}
                            className="input text-sm"
                            placeholder="reminder, schedule, meeting"
                          />
                        </div>

                        {/* Save button */}
                        <button
                          onClick={() => handleSaveFilters(boardId, config.id)}
                          disabled={!hasEdits || savingFilters === config.id}
                          className="btn btn-primary text-sm"
                          style={{ opacity: !hasEdits || savingFilters === config.id ? 0.5 : 1 }}
                        >
                          {savingFilters === config.id ? 'Saving...' : 'Save Filters'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              });
            })}
          </div>
        )}

      </div>
    </div>
  );
}
