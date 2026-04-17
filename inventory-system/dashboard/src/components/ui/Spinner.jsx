export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <svg
      className={`animate-spin text-indigo-500 ${sizes[size] ?? sizes.md} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default Spinner;

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center flex-1 py-24">
      <Spinner size="lg" />
    </div>
  );
}

export function SkeletonRow({ cols = 4 }) {
  return (
    <tr className="border-b border-slate-50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + (i * 15) % 35}%` }} />
        </td>
      ))}
    </tr>
  );
}
