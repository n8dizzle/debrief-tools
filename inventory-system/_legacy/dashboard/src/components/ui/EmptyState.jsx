import { CheckCircle2 } from 'lucide-react';

export default function EmptyState({ icon: Icon = CheckCircle2, title = 'All clear', message }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-emerald-500" />
      </div>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {message && <p className="text-xs text-slate-400 mt-1 max-w-48">{message}</p>}
    </div>
  );
}
