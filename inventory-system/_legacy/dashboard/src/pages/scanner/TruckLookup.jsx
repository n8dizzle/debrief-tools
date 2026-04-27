/**
 * TruckLookup — scan or search a material, show its qty on the current truck.
 */

import { useState } from 'react';
import { Search, ScanLine, AlertTriangle, Package, Truck } from 'lucide-react';
import BarcodeScanner from '../../components/scanner/BarcodeScanner.jsx';
import client from '../../api/client.js';

export default function TruckLookup() {
  const truckId = sessionStorage.getItem('scanner_truck') ?? '';

  const [scanning,  setScanning]  = useState(false);
  const [query,     setQuery]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [result,    setResult]    = useState(null); // { material, truckQty }

  async function lookup(value) {
    setError('');
    setLoading(true);
    setScanning(false);
    setResult(null);
    try {
      const { data } = await client.get('/materials', { params: { search: value, limit: 1 } });
      const mat = (data.materials ?? [])[0];
      if (!mat) { setError(`No material found for "${value}"`); return; }

      // Get truck stock from detail endpoint
      const detail = await client.get(`/materials/${mat.id}`);
      const ts = (detail.data.truck_stock ?? []).find(t => t.truck_id === truckId);

      setResult({ material: mat, truckQty: ts?.qty_on_truck ?? 0 });
    } catch {
      setError('Lookup failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (query.trim()) lookup(query.trim());
  }

  const isLow = result && result.material.qty_on_hand > 0 && result.material.qty_on_hand <= result.material.reorder_point;
  const isOOS = result && result.material.qty_on_hand === 0;

  return (
    <div className="flex flex-col px-4 py-6 gap-6">
      <div>
        <h2 className="text-white text-xl font-bold">Truck Stock Lookup</h2>
        <p className="text-slate-400 text-sm mt-1">Check how much of an item is on your truck</p>
      </div>

      {/* Scan button */}
      <button
        onClick={() => setScanning(true)}
        className="flex items-center justify-center gap-3 bg-blue-600 active:bg-blue-700
                   text-white rounded-2xl py-5 text-lg font-semibold"
      >
        <ScanLine size={24} />
        Scan Barcode
      </button>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="SKU or material name…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-3
                       text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-base"
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="bg-slate-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold"
        >
          {loading ? '…' : 'Find'}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Result card */}
      {result && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Package size={18} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white font-semibold">{result.material.name}</p>
                <p className="text-slate-400 text-sm">{result.material.sku}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-slate-700">
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Truck size={14} className="text-slate-400" />
                <span className="text-slate-400 text-xs">On Your Truck</span>
              </div>
              <p className={`text-3xl font-bold mt-1 ${result.truckQty === 0 ? 'text-red-400' : result.truckQty <= 2 ? 'text-amber-400' : 'text-white'}`}>
                {result.truckQty}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">{result.material.unit ?? 'units'}</p>
            </div>
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Package size={14} className="text-slate-400" />
                <span className="text-slate-400 text-xs">Warehouse</span>
              </div>
              <p className={`text-3xl font-bold mt-1 ${isOOS ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-white'}`}>
                {result.material.qty_on_hand}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                {isOOS ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : result.material.unit ?? 'units'}
              </p>
            </div>
          </div>
        </div>
      )}

      {scanning && (
        <BarcodeScanner
          onScan={lookup}
          onClose={() => setScanning(false)}
          hint="SKU or barcode"
        />
      )}
    </div>
  );
}
