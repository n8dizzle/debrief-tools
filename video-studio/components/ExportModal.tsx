'use client';

import { useState, useRef, useCallback } from 'react';
import { renderVideoToBlob, AllRenderOptions } from '@/lib/canvas-renderer';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  renderOptions: Record<string, any>;
  videoElement?: HTMLVideoElement | null;
}

export default function ExportModal({ isOpen, onClose, renderOptions, videoElement }: ExportModalProps) {
  const [state, setState] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef<string | null>(null);

  const startRender = useCallback(async () => {
    setState('rendering');
    setProgress(0);
    setError(null);

    try {
      const opts = {
        ...renderOptions,
        onProgress: (pct: number) => setProgress(pct),
      } as AllRenderOptions;

      // If branded video, attach the video element
      if (opts.type === 'branded-video' && videoElement) {
        (opts as any).videoElement = videoElement;
      }

      const blob = await renderVideoToBlob(opts);
      blobRef.current = blob;
      urlRef.current = URL.createObjectURL(blob);
      setState('done');
    } catch (err: any) {
      console.error('Render error:', err);
      setError(err.message || 'Rendering failed');
      setState('error');
    }
  }, [renderOptions, videoElement]);

  const handleDownload = useCallback(() => {
    if (!urlRef.current) return;
    const a = document.createElement('a');
    a.href = urlRef.current;
    a.download = `christmas-air-video-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleClose = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    blobRef.current = null;
    setState('idle');
    setProgress(0);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const fileSizeMB = blobRef.current
    ? (blobRef.current.size / (1024 * 1024)).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            Export Video
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Idle state */}
        {state === 'idle' && (
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(93, 138, 102, 0.15)' }}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--christmas-green-light)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
              Ready to export your video
            </p>
            <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
              {renderOptions.durationInSeconds}s video at 1920x1080 &middot; WebM format
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Rendering takes about {renderOptions.durationInSeconds}s (real-time)
            </p>
            <button onClick={startRender} className="btn btn-primary px-8 py-2.5 w-full">
              Start Rendering
            </button>
          </div>
        )}

        {/* Rendering */}
        {state === 'rendering' && (
          <div className="text-center">
            <div className="mb-4">
              <div
                className="w-full h-3 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--bg-card)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: 'var(--christmas-green)',
                  }}
                />
              </div>
              <p className="text-sm mt-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                {progress}%
              </p>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Rendering video... Please keep this tab open.
            </p>
          </div>
        )}

        {/* Done */}
        {state === 'done' && (
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--status-success)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm mb-1 font-medium" style={{ color: 'var(--text-primary)' }}>
              Video rendered!
            </p>
            {fileSizeMB && (
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                File size: {fileSizeMB} MB
              </p>
            )}

            {/* Preview */}
            {urlRef.current && (
              <video
                src={urlRef.current}
                controls
                className="w-full rounded-lg mb-4"
                style={{ maxHeight: 200 }}
              />
            )}

            <div className="flex gap-3">
              <button onClick={handleClose} className="btn btn-secondary flex-1 py-2.5">
                Close
              </button>
              <button onClick={handleDownload} className="btn btn-primary flex-1 py-2.5 gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--status-error)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
              Rendering failed
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--status-error)' }}>
              {error}
            </p>
            <div className="flex gap-3">
              <button onClick={handleClose} className="btn btn-secondary flex-1 py-2.5">
                Close
              </button>
              <button onClick={startRender} className="btn btn-primary flex-1 py-2.5">
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
