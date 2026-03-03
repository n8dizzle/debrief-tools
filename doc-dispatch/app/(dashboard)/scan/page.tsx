'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

function HowItWorksModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>
            How to Add Documents
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Option 1: Scan Here */}
          <div className="flex gap-3">
            <div
              className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
              style={{ background: 'rgba(93, 138, 102, 0.15)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="var(--christmas-green)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                Option 1: Scan Here
              </h3>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Use this page to take photos or upload images directly. You can add multiple pages for multi-page documents.
              </p>
              <div
                className="text-xs mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md"
                style={{ background: 'rgba(93, 138, 102, 0.1)', color: 'var(--christmas-green-light)' }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Instant upload + AI analysis
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>OR</span>
            <div className="flex-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
          </div>

          {/* Option 2: Email */}
          <div className="flex gap-3">
            <div
              className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
              style={{ background: 'rgba(59, 130, 246, 0.15)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="#60a5fa" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                Option 2: Email a Photo
              </h3>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Snap a photo and email it to the address below. It will automatically appear in the inbox, fully analyzed.
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('scan@mail.christmasair.com');
                }}
                className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono transition-colors"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
                title="Click to copy"
              >
                scan@mail.christmasair.com
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <div
                className="text-xs mt-2 leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                Must be sent from your @christmasair.com email
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>THEN</span>
            <div className="flex-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
          </div>

          {/* What happens next */}
          <div>
            <h3 className="font-medium text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
              What Happens Next
            </h3>
            <div className="space-y-3">
              {[
                { step: '1', text: 'AI reads the document and identifies the type (invoice, permit, contract, etc.)' },
                { step: '2', text: 'Key data is extracted — vendor, amounts, dates, reference numbers' },
                { step: '3', text: 'Action items are auto-generated with priorities and due dates' },
                { step: '4', text: 'Document appears in the Inbox ready for review and assignment' },
              ].map((item) => (
                <div key={item.step} className="flex gap-3 items-start">
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ background: 'rgba(93, 138, 102, 0.2)', color: 'var(--christmas-green-light)' }}
                  >
                    {item.step}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 p-4 border-t"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
        >
          <button onClick={onClose} className="btn btn-primary w-full">
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}

const MAX_IMAGE_DIMENSION = 2048;

function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only resize if larger than max dimension
      if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
        resolve(file);
        return;
      }

      const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to resize image'));
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

interface PageFile {
  file: File;
  preview: string;
}

export default function ScanPage() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<PageFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newPages: PageFile[] = fileArray.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPages(prev => [...prev, ...newPages]);
    setError(null);
  }, []);

  const handleCameraCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addFiles([file]);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [addFiles]);

  const handleGallerySelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    e.target.value = '';
  }, [addFiles]);

  const removePage = (index: number) => {
    setPages(prev => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const movePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pages.length) return;
    setPages(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  const handleUploadAndAnalyze = async () => {
    if (pages.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      // Resize all images client-side
      const resizedBlobs = await Promise.all(pages.map(p => resizeImage(p.file)));

      // Upload all files in one FormData
      const formData = new FormData();
      if (resizedBlobs.length === 1) {
        formData.append('file', resizedBlobs[0], pages[0].file.name);
      } else {
        resizedBlobs.forEach((blob, i) => {
          formData.append('files', blob, pages[i].file.name);
        });
      }

      const uploadRes = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      const doc = await uploadRes.json();
      setUploading(false);
      setAnalyzing(true);

      // Auto-trigger analysis
      const analyzeRes = await fetch(`/api/documents/${doc.id}/analyze`, {
        method: 'POST',
      });

      if (!analyzeRes.ok) {
        console.error('Analysis failed');
      }

      // Redirect to document detail
      router.push(`/documents/${doc.id}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    pages.forEach(p => URL.revokeObjectURL(p.preview));
    setPages([]);
    setError(null);
  };

  const isProcessing = uploading || analyzing;
  const hasPages = pages.length > 0;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Scan Document
        </h1>
        <button
          onClick={() => setShowHowItWorks(true)}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors"
          style={{
            color: 'var(--christmas-green-light)',
            background: 'rgba(93, 138, 102, 0.1)',
            border: '1px solid rgba(93, 138, 102, 0.2)',
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How It Works
        </button>
      </div>

      {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleGallerySelect}
        className="hidden"
      />

      {!hasPages ? (
        // No pages yet — show capture UI
        <div>
          <label
            onClick={() => cameraInputRef.current?.click()}
            className="card flex flex-col items-center justify-center gap-4 cursor-pointer min-h-[300px] border-2 border-dashed"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(93, 138, 102, 0.15)' }}
            >
              <svg className="w-8 h-8" fill="none" stroke="var(--christmas-green)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                Take Photo or Choose Files
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Tap to open your camera, or choose from gallery below
              </p>
            </div>
          </label>

          <div className="mt-4">
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="btn btn-secondary w-full cursor-pointer gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Choose from Gallery (multi-select)
            </button>
          </div>
        </div>
      ) : (
        // Has pages — show thumbnail strip + actions
        <div>
          {/* Page thumbnails */}
          <div className="space-y-3 mb-4">
            {pages.map((page, index) => (
              <div
                key={index}
                className="card p-0 overflow-hidden"
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Page {index + 1} of {pages.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => movePage(index, index - 1)}
                      disabled={index === 0 || isProcessing}
                      className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
                      style={{ color: 'var(--text-muted)' }}
                      title="Move up"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => movePage(index, index + 1)}
                      disabled={index === pages.length - 1 || isProcessing}
                      className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
                      style={{ color: 'var(--text-muted)' }}
                      title="Move down"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removePage(index)}
                      disabled={isProcessing}
                      className="p-1 rounded hover:bg-red-500/20"
                      style={{ color: 'var(--status-error, #ef4444)' }}
                      title="Remove page"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <img
                  src={page.preview}
                  alt={`Page ${index + 1}`}
                  className="w-full max-h-[300px] object-contain"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                />
              </div>
            ))}
          </div>

          {/* Add more pages */}
          {!isProcessing && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="btn btn-secondary flex-1 gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                Add Page
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="btn btn-secondary flex-1 gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Add from Gallery
              </button>
            </div>
          )}

          {error && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={isProcessing}
              className="btn btn-secondary flex-1"
            >
              Start Over
            </button>
            <button
              onClick={handleUploadAndAnalyze}
              disabled={isProcessing}
              className="btn btn-primary flex-1 gap-2"
            >
              {uploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Uploading...
                </>
              ) : analyzing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Analyze {pages.length > 1 ? `${pages.length} Pages` : 'Document'}
                </>
              )}
            </button>
          </div>

          {isProcessing && (
            <p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
              {uploading
                ? `Uploading ${pages.length} page${pages.length !== 1 ? 's' : ''}...`
                : 'AI is reading your document...'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
