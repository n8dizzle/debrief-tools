'use client';

import { useState, useEffect, useRef } from 'react';
import { useBPPPermissions } from '@/hooks/useBPPPermissions';
import Papa from 'papaparse';

interface ValidationResult {
  total_rows: number;
  valid_count: number;
  error_count: number;
  errors: { row: number; field: string; message: string }[];
  valid_assets: any[];
}

export default function ImportPage() {
  const { canManageAssets } = useBPPPermissions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setValidation(null);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setRawRows(results.data as any[]);
      },
    });
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch('/api/import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rawRows }),
      });
      const data = await res.json();
      setValidation(data);
    } catch (err) {
      console.error(err);
      alert('Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!validation?.valid_assets.length) return;
    setImporting(true);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: validation.valid_assets }),
      });
      if (!res.ok) throw new Error('Import failed');
      const data = await res.json();
      setImportResult(data);
      setRawRows([]);
      setValidation(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      console.error(err);
      alert('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setRawRows([]);
    setValidation(null);
    setImportResult(null);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  if (!canManageAssets) {
    return <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>You don&apos;t have permission to import assets.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>Import Assets</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Upload a CSV file to bulk-add assets</p>
      </div>

      {importResult && (
        <div className="card" style={{ borderColor: 'var(--status-success)', borderWidth: 1 }}>
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="var(--status-success)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium" style={{ color: 'var(--status-success)' }}>Import Complete</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{importResult.imported} assets imported successfully.</p>
            </div>
          </div>
          <button onClick={handleReset} className="btn btn-secondary mt-3 text-sm">Import More</button>
        </div>
      )}

      {!importResult && (
        <>
          {/* CSV Format Guide */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--christmas-cream)' }}>Required CSV Columns</h2>
            <div className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <p><strong style={{ color: 'var(--text-primary)' }}>category</strong> — Must match: Vehicles, Tools & Equipment, HVAC Equipment, Plumbing Equipment, Office Furniture & Fixtures, Computers & Electronics, Leased Equipment, Inventory & Supplies</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>description</strong> — Asset description (required)</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>quantity</strong> — Number of items (required)</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>unit_cost</strong> — Cost per item (required)</p>
              <p><strong style={{ color: 'var(--text-primary)' }}>year_acquired</strong> — Year purchased (required)</p>
              <p className="pt-1"><strong style={{ color: 'var(--text-muted)' }}>Optional:</strong> subcategory, condition (new/good/fair/poor), location, serial_number, notes</p>
            </div>
          </div>

          {/* Upload */}
          <div className="card">
            <div className="flex items-center gap-4">
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="btn btn-primary gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Choose CSV File
              </button>
              {fileName && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{fileName} ({rawRows.length} rows)</span>}
            </div>

            {rawRows.length > 0 && !validation && (
              <div className="mt-4">
                <button onClick={handleValidate} className="btn btn-primary" disabled={validating}>
                  {validating ? 'Validating...' : 'Validate Data'}
                </button>
              </div>
            )}
          </div>

          {/* Validation Results */}
          {validation && (
            <div className="card space-y-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--christmas-cream)' }}>Validation Results</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{validation.total_rows}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Rows</div>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--status-success)' }}>{validation.valid_count}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Valid</div>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                  <div className="text-2xl font-bold" style={{ color: validation.error_count > 0 ? 'var(--status-error)' : 'var(--text-muted)' }}>{validation.error_count}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Errors</div>
                </div>
              </div>

              {validation.errors.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--status-error)' }}>Errors</h3>
                  <div className="max-h-48 overflow-y-auto text-xs space-y-1">
                    {validation.errors.map((err, i) => (
                      <div key={i} className="p-2 rounded" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Row {err.row}:</span>{' '}
                        <span style={{ color: '#f87171' }}>{err.field}</span> — {err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validation.valid_count > 0 && (
                <div className="flex gap-3">
                  <button onClick={handleImport} className="btn btn-primary" disabled={importing}>
                    {importing ? 'Importing...' : `Import ${validation.valid_count} Assets`}
                  </button>
                  <button onClick={handleReset} className="btn btn-secondary">Cancel</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
