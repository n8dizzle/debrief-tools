interface ToolCardProps {
  name: string;
  description: string;
  url: string;
  icon: string;
  category: string;
}

// Icon component for tool cards
function ToolIcon({ name }: { name: string }) {
  const iconClass = "w-6 h-6";
  const icons: Record<string, JSX.Element> = {
    "clipboard-check": (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    "chart-bar": (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    phone: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    wrench: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    "document-text": (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    "academic-cap": (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 14l9-5-9-5-9 5 9 5z" />
        <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
      </svg>
    ),
  };
  return icons[name] || (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

export default function ToolCard({ name, description, url, icon, category }: ToolCardProps) {
  const isDisabled = url === "#";

  return (
    <a
      href={isDisabled ? undefined : url}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        block p-5 rounded-xl transition-all duration-200 group
        ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}
      `}
      style={{
        background: 'var(--bg-card)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--border-subtle)',
        opacity: isDisabled ? 0.5 : 1
      }}
      onMouseOver={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.background = 'var(--bg-card-hover)';
          e.currentTarget.style.borderColor = 'var(--christmas-green-dark)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'var(--bg-card)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg"
          style={{
            background: isDisabled ? 'var(--bg-card-hover)' : 'var(--christmas-green)',
            color: 'var(--christmas-cream)'
          }}
        >
          <ToolIcon name={icon} />
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{
            background: 'var(--border-subtle)',
            color: 'var(--text-secondary)'
          }}
        >
          {category}
        </span>
      </div>
      <h4
        className="mt-4 font-semibold"
        style={{ color: 'var(--christmas-cream)' }}
      >
        {name}
      </h4>
      <p
        className="mt-1.5 text-sm line-clamp-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        {description}
      </p>
      {isDisabled && (
        <p
          className="mt-3 text-xs font-medium"
          style={{ color: 'var(--christmas-gold)' }}
        >
          Coming soon
        </p>
      )}
    </a>
  );
}
