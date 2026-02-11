'use client';

interface QuickBooksStatusProps {
  connected: boolean;
  companyName: string | null;
  lastSync?: {
    completedAt: string;
    recordsFetched: number;
    matchesFound: number;
  } | null;
  onConnect: () => void;
  onSync: () => void;
  syncing: boolean;
}

export default function QuickBooksStatus({
  connected,
  companyName,
  lastSync,
  onConnect,
  onSync,
  syncing,
}: QuickBooksStatusProps) {
  return (
    <div className="flex items-center gap-4">
      {connected ? (
        <>
          {/* Connection Status Badge */}
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: 'var(--christmas-green)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              Connected
            </span>
            {companyName && (
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {companyName}
              </span>
            )}
          </div>

          {/* Last Sync Info */}
          {lastSync && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Last sync: {new Date(lastSync.completedAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          )}

          {/* Sync Button */}
          <button
            onClick={onSync}
            disabled={syncing}
            className="btn btn-secondary btn-sm flex items-center gap-2"
          >
            <svg
              className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </>
      ) : (
        <button
          onClick={onConnect}
          className="btn btn-primary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          Connect QuickBooks
        </button>
      )}
    </div>
  );
}
