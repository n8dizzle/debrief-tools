/**
 * JobPicker — bottom-sheet job selector for the scanner.
 *
 * Fetches jobs from /api/jobs filtered by the tech's truck_id.
 * Supports search by job_number or customer_name.
 *
 * Props:
 *   truckId   — string, required for filtering
 *   value     — currently selected job object or null
 *   onChange  — (job | null) => void
 */

import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X, Briefcase, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import client from '../../api/client.js';

const STATUS_COLORS = {
  in_progress: 'bg-emerald-500/20 text-emerald-300 border-emerald-700/40',
  scheduled:   'bg-blue-500/20 text-blue-300 border-blue-700/40',
  completed:   'bg-slate-700/50 text-slate-400 border-slate-600/40',
  default:     'bg-slate-700/50 text-slate-400 border-slate-600/40',
};

function statusBadge(status) {
  const cls = STATUS_COLORS[status] ?? STATUS_COLORS.default;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${cls}`}>
      {status?.replace('_', ' ') ?? 'unknown'}
    </span>
  );
}

export default function JobPicker({ truckId, value, onChange }) {
  const [open,    setOpen]    = useState(false);
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [query,   setQuery]   = useState('');
  const inputRef = useRef(null);

  // Load jobs when sheet opens
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setError('');
    setLoading(true);

    client.get('/jobs', {
      params: {
        truck_id: truckId || undefined,
        status:   'in_progress,scheduled',
        limit:    50,
      },
    })
      .then(({ data }) => setJobs(data.jobs ?? []))
      .catch(() => setError('Could not load jobs. Check connection.'))
      .finally(() => {
        setLoading(false);
        // Focus search on open
        setTimeout(() => inputRef.current?.focus(), 100);
      });
  }, [open, truckId]);

  const filtered = jobs.filter(j => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      j.job_number?.toLowerCase().includes(q) ||
      j.customer_name?.toLowerCase().includes(q) ||
      j.customer_address?.toLowerCase().includes(q)
    );
  });

  function select(job) {
    onChange(job);
    setOpen(false);
  }

  function clear(e) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors
          ${value
            ? 'bg-slate-800 border-indigo-500 text-white'
            : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Briefcase size={16} className={value ? 'text-indigo-400 flex-shrink-0' : 'text-slate-500 flex-shrink-0'} />
          {value ? (
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">{value.job_number}</p>
              <p className="text-slate-400 text-xs truncate">{value.customer_name}</p>
            </div>
          ) : (
            <span className="text-sm">Select job…</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {value && (
            <button
              type="button"
              onClick={clear}
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-400"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </button>

      {/* Bottom sheet overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Sheet */}
          <div className="relative bg-slate-900 rounded-t-3xl border-t border-slate-700 max-h-[80vh] flex flex-col shadow-2xl">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-slate-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
              <h3 className="text-white font-bold text-base">Select Job</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 active:bg-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search bar */}
            <div className="px-4 pb-3 flex-shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search job # or customer name…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5
                             text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>
            </div>

            {/* Job list */}
            <div className="overflow-y-auto flex-1 px-4 pb-6">
              {loading && (
                <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                  Loading jobs…
                </div>
              )}

              {error && !loading && (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 text-sm rounded-xl px-4 py-3 mt-2">
                  <AlertTriangle size={15} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              {!loading && !error && filtered.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-sm">
                  {query ? 'No jobs match your search.' : 'No active jobs found for this truck.'}
                </div>
              )}

              {!loading && !error && filtered.length > 0 && (
                <div className="flex flex-col gap-2">
                  {filtered.map(job => {
                    const isSelected = value?.id === job.id;
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => select(job)}
                        className={`w-full text-left rounded-2xl border p-4 transition-colors active:scale-[0.98]
                          ${isSelected
                            ? 'bg-indigo-600/20 border-indigo-500'
                            : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-bold text-sm">{job.job_number}</span>
                              {statusBadge(job.status)}
                            </div>
                            <p className="text-slate-200 text-sm font-medium mt-1 truncate">
                              {job.customer_name}
                            </p>
                            {job.customer_address && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <MapPin size={11} className="text-slate-500 flex-shrink-0" />
                                <p className="text-slate-500 text-xs truncate">{job.customer_address}</p>
                              </div>
                            )}
                            {job.job_type && (
                              <p className="text-slate-500 text-xs mt-1 capitalize">{job.job_type?.replace('_', ' ')}</p>
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle size={18} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
