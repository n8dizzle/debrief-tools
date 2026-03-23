'use client';

import { useState, useRef, useCallback } from 'react';

interface VideoUploaderProps {
  onUpload: (url: string, fileName: string) => void;
}

export default function VideoUploader({ onUpload }: VideoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setProgress('Uploading...');
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/videos/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setProgress(null);
      onUpload(data.url, file.name);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setProgress(null);
    } finally {
      setIsUploading(false);
    }
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div>
      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="rounded-xl p-8 text-center cursor-pointer transition-all duration-200"
        style={{
          border: `2px dashed ${isDragging ? 'var(--christmas-green)' : 'var(--border-default)'}`,
          backgroundColor: isDragging ? 'rgba(93, 138, 102, 0.08)' : 'var(--bg-card)',
          opacity: isUploading ? 0.6 : 1,
          pointerEvents: isUploading ? 'none' : 'auto',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
          onChange={handleChange}
          className="hidden"
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-10 h-10 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--christmas-green)' }}
            />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {progress}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Drop a video here or click to browse
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                MP4, WebM, or MOV up to 100MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm mt-2" style={{ color: 'var(--status-error)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
