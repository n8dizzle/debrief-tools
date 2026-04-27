/**
 * ScannerHome — action selection screen.
 *
 * On load, reads the logged-in user's assigned truck from /auth/me.
 * If the user has a truck assigned, it auto-selects and hides the picker.
 * If not, the tech manually selects from the list.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ShoppingBag, Wrench, Search, RefreshCcw, ChevronDown, Truck, CheckCircle, PackageCheck, ArrowRightLeft } from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner.jsx';
import client from '../../api/client.js';

const ACTIONS = [
  {
    id: 'consume',
    label: 'Consume Material',
    sub: 'Log parts used on a job',
    Icon: ShoppingBag,
    color: 'bg-red-500',
    path: '/scanner/consume',
  },
  {
    id: 'tool',
    label: 'Tool Checkout / Return',
    sub: 'Check out or return a tool',
    Icon: Wrench,
    color: 'bg-amber-500',
    path: '/scanner/tool',
  },
  {
    id: 'lookup',
    label: 'Truck Stock Lookup',
    sub: 'Check how much is on your truck',
    Icon: Search,
    color: 'bg-blue-500',
    path: '/scanner/lookup',
  },
  {
    id: 'replenish',
    label: 'Replenish from Bin',
    sub: 'Scan bin barcode to load truck',
    Icon: RefreshCcw,
    color: 'bg-emerald-500',
    path: '/scanner/replenish',
  },
  {
    id: 'receive',
    label: 'Receive Delivery',
    sub: 'Scan PO and confirm quantities',
    Icon: PackageCheck,
    color: 'bg-violet-500',
    path: '/scanner/receive',
    noTruck: true, // doesn't require a truck selection
  },
  {
    id: 'transfer',
    label: 'Transfer Stock',
    sub: 'Move stock warehouse ↔ truck',
    Icon: ArrowRightLeft,
    color: 'bg-indigo-500',
    path: '/scanner/transfer',
  },
];

export default function ScannerHome() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [trucks,        setTrucks]        = useState([]);
  const [selectedTruck, setSelectedTruck] = useState(null); // full truck object
  const [autoAssigned,  setAutoAssigned]  = useState(false); // true = came from user profile
  const [loading,       setLoading]       = useState(true);
  const [truckOpen,     setTruckOpen]     = useState(false);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        // Refresh user to get latest truck assignment
        const meRes = await client.get('/auth/me');
        const me    = meRes.data.user;

        if (me?.truck) {
          // Auto-assigned — no selector needed
          setSelectedTruck(me.truck);
          setAutoAssigned(true);
          sessionStorage.setItem('scanner_truck', me.truck.id);
        } else {
          // Fall back: manual selection
          const storedId = sessionStorage.getItem('scanner_truck');
          const trRes    = await client.get('/trucks', { params: { limit: 50 } });
          const list     = trRes.data.trucks ?? [];
          setTrucks(list);
          if (storedId) {
            const prev = list.find(t => t.id === storedId);
            if (prev) setSelectedTruck(prev);
          }
        }
      } catch { /* silently fail — user can still pick manually */ }
      finally { setLoading(false); }
    }
    init();
  }, []);

  function chooseTruck(t) {
    setSelectedTruck(t);
    sessionStorage.setItem('scanner_truck', t.id);
    setTruckOpen(false);
  }

  function goTo(path, noTruck = false) {
    if (!noTruck && !selectedTruck) { setTruckOpen(true); return; }
    navigate(path);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size="lg" className="text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col px-4 py-6 gap-6">
      {/* Greeting */}
      <div>
        <p className="text-slate-400 text-sm">Welcome back,</p>
        <h1 className="text-white text-2xl font-bold mt-0.5">
          {user?.name?.split(' ')[0] ?? 'Tech'}
        </h1>
      </div>

      {/* Truck display */}
      {autoAssigned && selectedTruck ? (
        /* Auto-assigned truck — just show it, no dropdown */
        <div className="flex items-center gap-3 bg-slate-800 rounded-2xl border border-indigo-500/50 px-4 py-3.5">
          <div className="w-9 h-9 bg-indigo-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Truck size={18} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold">
              Truck {selectedTruck.truck_number}
            </p>
            <p className="text-slate-400 text-xs capitalize">
              {selectedTruck.department} · {selectedTruck.warehouse_name ?? ''}
            </p>
          </div>
          <CheckCircle size={16} className="text-indigo-400 flex-shrink-0" />
        </div>
      ) : (
        /* Manual truck selector */
        <div>
          <label className="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-2">
            Your Truck
          </label>
          <button
            onClick={() => setTruckOpen(o => !o)}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-left transition-colors ${
              selectedTruck
                ? 'bg-slate-800 border-indigo-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-3">
              <Truck size={18} className={selectedTruck ? 'text-indigo-400' : 'text-slate-500'} />
              {selectedTruck ? (
                <div>
                  <span className="font-semibold">{selectedTruck.truck_number}</span>
                  {selectedTruck.assigned_tech && (
                    <span className="text-slate-400 text-sm ml-2">— {selectedTruck.assigned_tech}</span>
                  )}
                </div>
              ) : (
                <span className="text-sm">Select your truck</span>
              )}
            </div>
            <ChevronDown
              size={18}
              className={`text-slate-400 transition-transform ${truckOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {truckOpen && (
            <div className="mt-1 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
              {trucks.filter(t => t.status === 'active').map(t => (
                <button
                  key={t.id}
                  onClick={() => chooseTruck(t)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-slate-700/50 last:border-0
                    ${t.id === selectedTruck?.id ? 'bg-indigo-600/20 text-indigo-300' : 'text-white hover:bg-slate-700'}`}
                >
                  <Truck size={16} className="text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">{t.truck_number}</p>
                    {t.assigned_tech && <p className="text-xs text-slate-400">{t.assigned_tech}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!selectedTruck && (
            <p className="text-amber-400 text-xs mt-2 pl-1">
              Select your truck before starting an action.
            </p>
          )}
        </div>
      )}

      {/* Action tiles */}
      <div>
        <label className="text-slate-400 text-xs font-medium uppercase tracking-wide block mb-3">
          Actions
        </label>
        <div className="grid grid-cols-2 gap-3">
          {ACTIONS.map(({ id, label, sub, Icon, color, path, noTruck }) => (
            <button
              key={id}
              onClick={() => goTo(path, noTruck)}
              className={`flex flex-col items-start p-4 rounded-2xl bg-slate-800 border border-slate-700
                active:scale-95 transition-transform text-left
                ${!selectedTruck && !noTruck ? 'opacity-60' : 'hover:border-slate-500'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <Icon size={20} className="text-white" />
              </div>
              <p className="text-white font-semibold text-sm leading-tight">{label}</p>
              <p className="text-slate-400 text-xs mt-1 leading-snug">{sub}</p>
            </button>
          ))}
        </div>
      </div>

      <p className="text-slate-600 text-xs text-center pb-2">
        Tap an action to scan or search.
      </p>
    </div>
  );
}
