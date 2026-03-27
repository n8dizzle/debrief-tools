'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SupplierList {
  id: string;
  supplier_name: string;
  file_name: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  item_count: number;
  mapped_count: number;
  created_at: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: SupplierList['status'] }) {
  const config: Record<
    SupplierList['status'],
    { className: string; label: string; showSpinner: boolean }
  > = {
    pending: { className: 'badge', label: 'Pending', showSpinner: false },
    processing: { className: 'badge badge-warning', label: 'Processing', showSpinner: true },
    completed: { className: 'badge badge-success', label: 'Completed', showSpinner: false },
    failed: { className: 'badge badge-error', label: 'Failed', showSpinner: false },
  };

  const { className, label, showSpinner } = config[status];

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
      {showSpinner && (
        <span
          style={{
            width: '10px',
            height: '10px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  );
}

export default function SupplierListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<SupplierList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload modal state
  const [showModal, setShowModal] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch('/api/pricebook/lists');
      if (!res.ok) throw new Error('Failed to load supplier lists');
      const data = await res.json();
      setLists(data.lists || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Poll for processing lists
  useEffect(() => {
    const hasProcessing = lists.some((l) => l.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(fetchLists, 3000);
    return () => clearInterval(interval);
  }, [lists, fetchLists]);

  async function handleUpload() {
    if (!supplierName.trim()) {
      setUploadError('Supplier name is required');
      return;
    }
    if (!file) {
      setUploadError('Please select a PDF file');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      // Step 1: Create the list record
      const createRes = await fetch('/api/pricebook/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_name: supplierName.trim() }),
      });
      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || 'Failed to create list');
      }
      const { list: newList } = await createRes.json();

      // Step 2: Upload the file
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch(`/api/pricebook/lists/${newList.id}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || 'Failed to upload file');
      }

      // Step 3: Trigger parsing
      fetch(`/api/pricebook/lists/${newList.id}/parse`, { method: 'POST' });

      // Close modal and refresh
      setShowModal(false);
      setSupplierName('');
      setFile(null);
      setUploadError('');
      fetchLists();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, listId: string) {
    e.stopPropagation();
    if (!confirm('Delete this supplier list and all its items?')) return;

    try {
      const res = await fetch(`/api/pricebook/lists/${listId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setLists((prev) => prev.filter((l) => l.id !== listId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setUploadError('');
    } else {
      setUploadError('Only PDF files are accepted');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setUploadError('');
    }
  }

  // Summary stats
  const totalLists = lists.length;
  const totalItems = lists.reduce((sum, l) => sum + l.item_count, 0);
  const totalMapped = lists.reduce((sum, l) => sum + l.mapped_count, 0);
  const listsWithItems = lists.filter((l) => l.item_count > 0);
  const avgMarkup = 0; // Calculated server-side in a real scenario; placeholder

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--border-default)',
              borderTopColor: 'var(--hw-blue)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading supplier lists...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ color: 'var(--status-error)', marginBottom: '0.5rem' }}>{error}</div>
        <button className="btn-secondary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 0.25rem',
            }}
          >
            Supplier Price Lists
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Upload supplier PDFs, parse with AI, and map to your catalog.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Upload New List
          </span>
        </button>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {[
          { label: 'Total Lists', value: totalLists },
          { label: 'Total Items', value: totalItems },
          { label: 'Mapped Items', value: totalMapped },
          { label: 'Avg Markup', value: listsWithItems.length > 0 ? `${avgMarkup}%` : '--' },
        ].map((card) => (
          <div
            key={card.label}
            className="card"
            style={{ padding: '1rem 1.25rem' }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              {card.label}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Lists Table */}
      {lists.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
          }}
        >
          <svg
            width="48"
            height="48"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="1"
            viewBox="0 0 24 24"
            style={{ margin: '0 auto 1rem', opacity: 0.5 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            No supplier lists yet
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
            Upload a supplier price list PDF to get started.
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            Upload Your First List
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-default)',
                  background: 'var(--bg-input)',
                }}
              >
                {['Supplier Name', 'File', 'Status', 'Items', 'Mapped', 'Uploaded', 'Actions'].map(
                  (header) => (
                    <th
                      key={header}
                      style={{
                        padding: '0.75rem 1rem',
                        textAlign: 'left',
                        fontWeight: 500,
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => (
                <tr
                  key={list.id}
                  onClick={() => router.push(`/pricebook/supplier-lists/${list.id}`)}
                  style={{
                    borderBottom: '1px solid var(--border-default)',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover, rgba(255,255,255,0.02))')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {list.supplier_name}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                    {list.file_name ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                        }}
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {list.file_name}
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No file</span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <StatusBadge status={list.status} />
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                    {list.item_count}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                    {list.mapped_count}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {formatDate(list.created_at)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/pricebook/supplier-lists/${list.id}`);
                        }}
                      >
                        View
                      </button>
                      <button
                        className="btn-secondary"
                        style={{
                          padding: '0.375rem 0.5rem',
                          color: 'var(--status-error)',
                          fontSize: '0.8125rem',
                        }}
                        onClick={(e) => handleDelete(e, list.id)}
                        title="Delete list"
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !uploading) {
              setShowModal(false);
              setSupplierName('');
              setFile(null);
              setUploadError('');
            }
          }}
        >
          <div
            className="card"
            style={{
              width: '520px',
              maxWidth: '90vw',
              padding: '2rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: '0 0 0.5rem',
              }}
            >
              Upload Supplier Price List
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
              Upload a PDF price list. AI will parse line items automatically.
            </p>

            {uploadError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: 'var(--status-error)',
                  fontSize: '0.8125rem',
                  marginBottom: '1rem',
                }}
              >
                {uploadError}
              </div>
            )}

            {/* Supplier Name */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '0.375rem',
                }}
              >
                Supplier Name
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Ferguson, Carrier, Lennox..."
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={uploading}
                autoFocus
              />
            </div>

            {/* File Drop Zone */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '0.375rem',
                }}
              >
                Price List PDF
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--hw-blue)' : 'var(--border-default)'}`,
                  borderRadius: '8px',
                  padding: '2rem',
                  textAlign: 'center',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  background: dragOver ? 'rgba(59, 155, 143, 0.05)' : 'var(--bg-input)',
                  transition: 'all 0.15s ease',
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
                {file ? (
                  <div>
                    <svg
                      width="32"
                      height="32"
                      fill="none"
                      stroke="var(--status-success)"
                      strokeWidth="1.5"
                      viewBox="0 0 24 24"
                      style={{ margin: '0 auto 0.5rem' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <svg
                      width="32"
                      height="32"
                      fill="none"
                      stroke="var(--text-muted)"
                      strokeWidth="1.5"
                      viewBox="0 0 24 24"
                      style={{ margin: '0 auto 0.5rem' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Drop a PDF here or click to browse
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      PDF files only, up to 20MB
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowModal(false);
                  setSupplierName('');
                  setFile(null);
                  setUploadError('');
                }}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleUpload}
                disabled={uploading || !supplierName.trim() || !file}
              >
                {uploading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        display: 'inline-block',
                      }}
                    />
                    Uploading...
                  </span>
                ) : (
                  'Upload & Parse'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
