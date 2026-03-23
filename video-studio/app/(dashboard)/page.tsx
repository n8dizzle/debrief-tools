'use client';

import Link from 'next/link';

const templates = [
  {
    id: 'team-update',
    name: 'Team Update',
    description: 'Share weekly updates, announcements, or progress reports with your team',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'shoutout',
    name: 'Shoutout',
    description: 'Recognize and celebrate a team member for great work',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    id: 'announcement',
    name: 'Announcement',
    description: 'Make an important company or department announcement',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
];

export default function DashboardPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--christmas-cream)' }}>
          Video Studio
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Create short branded videos for your team
        </p>
      </div>

      {/* Create New Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Create a Video
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Link
              key={template.id}
              href={`/create?template=${template.id}`}
              className="card group cursor-pointer transition-all duration-200"
              style={{ textDecoration: 'none' }}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(93, 138, 102, 0.15)', color: 'var(--christmas-green-light)' }}
              >
                {template.icon}
              </div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--christmas-cream)' }}>
                {template.name}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {template.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Videos (placeholder) */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Recent Videos
        </h2>
        <div
          className="card flex flex-col items-center justify-center py-12"
          style={{ borderStyle: 'dashed' }}
        >
          <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No videos yet. Create your first one above!
          </p>
        </div>
      </div>
    </div>
  );
}
