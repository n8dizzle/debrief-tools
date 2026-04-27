/**
 * Status badge component.
 *
 * Usage:
 *   <Badge variant="warning">locked</Badge>
 *   <Badge variant="success">completed</Badge>
 */

const VARIANTS = {
  default:   'bg-slate-100 text-slate-600',
  success:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning:   'bg-amber-50  text-amber-700  border border-amber-200',
  danger:    'bg-red-50    text-red-700    border border-red-200',
  info:      'bg-blue-50   text-blue-700   border border-blue-200',
  indigo:    'bg-indigo-50 text-indigo-700 border border-indigo-200',
  purple:    'bg-purple-50 text-purple-700 border border-purple-200',
  plumbing:  'bg-blue-50   text-blue-700   border border-blue-200',
  hvac:      'bg-orange-50 text-orange-700 border border-orange-200',
};

// Map common status strings to variants automatically
const STATUS_MAP = {
  // Restock batches
  collecting:           'info',
  locked:               'warning',
  approved:             'indigo',
  picked:               'purple',
  completed:            'success',
  partially_completed:  'warning',
  // PO statuses
  draft:                'default',
  pending_review:       'warning',
  sent:                 'info',
  partially_received:   'warning',
  received:             'success',
  cancelled:            'danger',
  // Tools
  available:            'success',
  checked_out:          'warning',
  out_for_service:      'danger',
  retired:              'default',
  // IT assets
  unassigned:           'default',
  assigned:             'success',
  out_for_repair:       'danger',
  // Materials
  good:                 'success',
  needs_service:        'warning',
  damaged:              'danger',
  // Department
  plumbing:             'plumbing',
  hvac:                 'hvac',
};

export default function Badge({ children, variant, status, dot = false, className = '' }) {
  const v = variant ?? STATUS_MAP[status] ?? STATUS_MAP[children] ?? 'default';
  const cls = VARIANTS[v] ?? VARIANTS.default;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cls} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot === true ? 'bg-current' : dot}`} />}
      {children}
    </span>
  );
}
