'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface Video {
  id: string;
  title: string;
  template: string;
  video_source: string;
  source_video_url: string | null;
  rendered_url: string | null;
  status: string;
  duration_seconds: number | null;
  creator_name: string | null;
  created_at: string;
  updated_at: string;
}

const TEMPLATE_LABELS: Record<string, string> = {
  'team-update': 'Team Update',
  'shoutout': 'Shoutout',
  'announcement': 'Announcement',
  'branded-video': 'Branded Video',
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: 'rgba(234, 179, 8, 0.15)', color: '#fcd34d', label: 'Draft' },
  completed: { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', label: 'Completed' },
  rendering: { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', label: 'Rendering' },
};

const templates = [
  {
    id: 'team-update',
    name: 'Team Update',
    description: 'Share weekly updates, announcements, or progress reports with your team',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'shoutout',
    name: 'Shoutout',
    description: 'Recognize and celebrate a team member for great work',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    id: 'announcement',
    name: 'Announcement',
    description: 'Make an important company or department announcement',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function DashboardPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch('/api/videos');
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleDownload = useCallback(async (url: string, filename?: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || `video-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video project?')) return;
    const res = await fetch(`/api/videos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setVideos(prev => prev.filter(v => v.id !== id));
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Video Studio
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Create short branded videos for your team
        </p>
      </div>

      {/* Create Options */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          From Video
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link href="/create?source=upload" className="card group cursor-pointer transition-all duration-200" style={{ textDecoration: 'none' }}>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>Upload Video</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Upload from phone or computer with branded overlays</p>
          </Link>
          <Link href="/create?source=webcam" className="card group cursor-pointer transition-all duration-200" style={{ textDecoration: 'none' }}>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>Record Webcam</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Record yourself with branded intro, lower third, and outro</p>
          </Link>
        </div>

        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>From Template</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Link key={t.id} href={`/create?template=${t.id}`} className="card group cursor-pointer transition-all duration-200" style={{ textDecoration: 'none' }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(93, 138, 102, 0.15)', color: 'var(--christmas-green-light)' }}>
                {t.icon}
              </div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>{t.name}</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Video Library */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          My Videos
        </h2>

        {loading ? (
          <div className="card flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--christmas-green)' }} />
          </div>
        ) : videos.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-12" style={{ borderStyle: 'dashed' }}>
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No videos yet. Create your first one above!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => {
              const statusStyle = STATUS_STYLES[video.status] || STATUS_STYLES.draft;
              return (
                <div key={video.id} className="card">
                  {/* Thumbnail / preview area */}
                  <div
                    className="rounded-lg mb-3 flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      aspectRatio: '16/9',
                      overflow: 'hidden',
                    }}
                  >
                    {video.rendered_url ? (
                      <video
                        src={video.rendered_url}
                        className="w-full h-full object-cover"
                        preload="metadata"
                      />
                    ) : video.source_video_url ? (
                      <video
                        src={video.source_video_url}
                        className="w-full h-full object-cover"
                        preload="metadata"
                      />
                    ) : (
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--christmas-cream)' }}>
                      {video.title}
                    </h3>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                    >
                      {statusStyle.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    <span>{TEMPLATE_LABELS[video.template] || video.template}</span>
                    <span>&middot;</span>
                    <span>{formatDuration(video.duration_seconds)}</span>
                    <span>&middot;</span>
                    <span>{formatDate(video.created_at)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {video.source_video_url && !video.rendered_url && (
                      <Link
                        href={`/create?source=upload&existingVideo=${encodeURIComponent(video.source_video_url)}&videoId=${video.id}`}
                        className="btn btn-primary text-xs px-3 py-1.5 gap-1"
                        style={{ textDecoration: 'none' }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Add Branding
                      </Link>
                    )}
                    {video.rendered_url && (
                      <button
                        onClick={() => handleDownload(video.rendered_url!, `${video.title}-branded.webm`)}
                        className="btn btn-primary text-xs px-3 py-1.5 gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Branded
                      </button>
                    )}
                    {video.source_video_url && (
                      <button
                        onClick={() => handleDownload(video.source_video_url!, `${video.title}-original.webm`)}
                        className="btn btn-secondary text-xs px-3 py-1.5 gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Original
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="btn btn-secondary text-xs px-3 py-1.5"
                      style={{ color: 'var(--status-error)' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
