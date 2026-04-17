/**
 * BarcodeScanner
 *
 * Uses the browser's BarcodeDetector API (Chrome on Android) where available,
 * falls back to a manual-entry input otherwise.
 *
 * Props:
 *   onScan(value)  — called with the scanned/entered barcode string
 *   onClose()      — called when the scanner is dismissed
 *   hint           — placeholder text for manual entry
 */

import { useEffect, useRef, useState } from 'react';
import { Camera, X, Keyboard, ZapOff } from 'lucide-react';

const SUPPORTS_BARCODE = typeof window !== 'undefined' && 'BarcodeDetector' in window;

export default function BarcodeScanner({ onScan, onClose, hint = 'Scan or type SKU / barcode' }) {
  const [mode,    setMode]    = useState(SUPPORTS_BARCODE ? 'camera' : 'manual');
  const [manual,  setManual]  = useState('');
  const [error,   setError]   = useState('');
  const [active,  setActive]  = useState(false);

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const rafRef      = useRef(null);
  const detectorRef = useRef(null);

  /* ── Start camera ── */
  useEffect(() => {
    if (mode !== 'camera') return;

    let cancelled = false;

    async function start() {
      setError('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        detectorRef.current = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'data_matrix', 'upc_a', 'upc_e'],
        });

        setActive(true);
        scan();
      } catch (e) {
        if (cancelled) return;
        if (e.name === 'NotAllowedError') {
          setError('Camera access denied. Use manual entry below.');
        } else if (e.name === 'NotFoundError') {
          setError('No camera found. Use manual entry below.');
        } else {
          setError('Camera unavailable — use manual entry.');
        }
        setMode('manual');
      }
    }

    async function scan() {
      if (!videoRef.current || !detectorRef.current || cancelled) return;
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0) {
          stop();
          onScan(barcodes[0].rawValue);
          return;
        }
      } catch { /* frame not ready, keep scanning */ }
      rafRef.current = requestAnimationFrame(scan);
    }

    function stop() {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleManualSubmit(e) {
    e.preventDefault();
    const val = manual.trim();
    if (val) { onScan(val); setManual(''); }
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 safe-top">
        <span className="text-white font-semibold text-lg">Scan Barcode</span>
        <div className="flex items-center gap-3">
          {SUPPORTS_BARCODE && (
            <button
              onClick={() => setMode(m => m === 'camera' ? 'manual' : 'camera')}
              className="text-slate-300 hover:text-white p-1"
            >
              {mode === 'camera' ? <Keyboard size={20} /> : <Camera size={20} />}
            </button>
          )}
          <button onClick={onClose} className="text-slate-300 hover:text-white p-1">
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Camera view */}
      {mode === 'camera' && (
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Scan frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-64 h-64">
              {/* Corner brackets */}
              {[
                'top-0 left-0 border-t-4 border-l-4',
                'top-0 right-0 border-t-4 border-r-4',
                'bottom-0 left-0 border-b-4 border-l-4',
                'bottom-0 right-0 border-b-4 border-r-4',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-10 h-10 border-indigo-400 rounded-sm ${cls}`} />
              ))}
              {/* Scan line */}
              <div className="absolute inset-x-2 top-1/2 h-0.5 bg-indigo-400/80 animate-pulse" />
            </div>
          </div>

          {/* Scanning label */}
          {active && (
            <div className="absolute bottom-8 inset-x-0 flex justify-center">
              <span className="bg-black/60 text-white text-sm px-4 py-2 rounded-full">
                Point at a barcode to scan
              </span>
            </div>
          )}

          {/* Error over camera */}
          {error && (
            <div className="absolute inset-x-4 top-4 bg-red-900/90 text-red-200 text-sm rounded-xl px-4 py-3 text-center">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Manual entry (shown below camera or as full mode) */}
      <div className={`bg-slate-900 px-4 py-5 ${mode === 'manual' ? 'flex-1 flex flex-col justify-center' : ''}`}>
        {mode === 'manual' && !SUPPORTS_BARCODE && (
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-4 justify-center">
            <ZapOff size={16} />
            <span>Camera scanning not supported on this device</span>
          </div>
        )}
        <p className="text-slate-400 text-sm mb-2">
          {mode === 'camera' ? 'Or enter manually:' : 'Enter barcode or SKU:'}
        </p>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manual}
            onChange={e => setManual(e.target.value)}
            placeholder={hint}
            autoFocus={mode === 'manual'}
            className="flex-1 bg-slate-800 text-white rounded-xl px-4 py-3 text-base
                       border border-slate-700 focus:outline-none focus:border-indigo-500
                       placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={!manual.trim()}
            className="bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500
                       text-white px-5 py-3 rounded-xl font-semibold text-base
                       active:bg-indigo-700 transition-colors"
          >
            Go
          </button>
        </form>
      </div>

      {/* Safe area spacer for iOS home indicator */}
      <div className="bg-slate-900 h-safe-bottom" style={{ height: 'env(safe-area-inset-bottom)' }} />
    </div>
  );
}
