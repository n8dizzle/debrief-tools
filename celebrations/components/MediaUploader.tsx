'use client';

import { useState, useRef, useCallback } from 'react';

interface MediaUploaderProps {
  boardId: string;
  accept: string;
  onUpload: (result: { url: string; storagePath: string; contentType: string }) => void;
  label?: string;
}

export default function MediaUploader({ boardId, accept, onUpload, label }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('boardId', boardId);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const result = await res.json();
      onUpload(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, [boardId, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div>
      <div
        className="relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
        style={{
          borderColor: dragOver ? 'var(--christmas-green)' : 'var(--border-default)',
          background: dragOver ? 'rgba(93, 138, 102, 0.1)' : 'transparent',
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--christmas-green)', borderTopColor: 'transparent' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Uploading...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {label || 'Drop a file here or click to browse'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Images up to 10MB, videos up to 50MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm" style={{ color: 'var(--status-error)' }}>{error}</p>
      )}
    </div>
  );
}
