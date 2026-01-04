"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import ToolCard from "@/components/ToolCard";

// Configure your tools here
const tools = [
  {
    name: "That's a Wrap",
    description: "Job ticket review and grading",
    url: "https://debrief.christmasair.com",
    icon: "clipboard-check",
    category: "Operations",
  },
  {
    name: "Way to Sleigh!",
    description: "2026 Actuals - Marketing reports and KPIs",
    url: "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID",
    icon: "chart-bar",
    category: "Reporting",
  },
  {
    name: "Craft",
    description: "AI CSR and coaching for Call Center and Field",
    url: "https://app.craftflow.co/login",
    icon: "phone",
    category: "Training",
  },
  {
    name: "Attendance Tracker",
    description: "Employee time and attendance",
    url: "#",
    icon: "clock",
    category: "HR",
  },
];

const resources = [
  {
    name: "Employee Handbook",
    description: "Policies, procedures, and company guidelines",
    url: "#",
    icon: "book",
    category: "HR",
  },
  {
    name: "Knowledge Base",
    description: "Technical docs, troubleshooting, and FAQs",
    url: "#",
    icon: "lightbulb",
    category: "Documentation",
  },
  {
    name: "SOPs & Procedures",
    description: "Standard operating procedures and guides",
    url: "#",
    icon: "document-text",
    category: "Documentation",
  },
  {
    name: "Training Materials",
    description: "Onboarding and ongoing training resources",
    url: "#",
    icon: "academic-cap",
    category: "Documentation",
  },
];

const marketing = [
  {
    name: "Brand Logos",
    description: "Official logos in various formats",
    url: "#",
    icon: "photo",
    category: "Marketing",
  },
  {
    name: "Brand Guidelines",
    description: "Colors, fonts, and usage standards",
    url: "#",
    icon: "color-swatch",
    category: "Marketing",
  },
  {
    name: "Current Ads",
    description: "Active marketing campaigns and creatives",
    url: "#",
    icon: "speakerphone",
    category: "Marketing",
  },
];

const quickLinks = [
  {
    name: "ServiceTitan",
    url: "https://go.servicetitan.com",
    icon: "home",
  },
  {
    name: "Slack",
    url: "https://christmasairc-k119428.slack.com",
    icon: "chat",
  },
  {
    name: "Gmail",
    url: "https://mail.google.com",
    icon: "mail",
  },
  {
    name: "Bill.com",
    url: "https://app.bill.com",
    icon: "currency",
  },
  {
    name: "Gusto",
    url: "https://app.gusto.com",
    icon: "users",
  },
  {
    name: "Google Drive",
    url: "https://drive.google.com",
    icon: "folder",
  },
];

// Icon component for quick links
function QuickLinkIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    home: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    chat: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    mail: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    currency: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    users: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    folder: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  };
  return icons[name] || null;
}

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-subtle)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Image
                src="/logo.png"
                alt="Christmas Air Conditioning & Plumbing"
                width={48}
                height={48}
                className="h-12 w-auto"
              />
              <div>
                <h1
                  className="text-lg font-semibold"
                  style={{ color: 'var(--christmas-cream)' }}
                >
                  Internal Tools
                </h1>
                <p
                  className="text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Christmas Air Conditioning & Plumbing
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {session?.user && (
                <>
                  <span
                    className="text-sm hidden sm:block"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {session.user.email}
                  </span>
                  <button
                    onClick={() => signOut()}
                    className="text-sm px-3 py-1.5 rounded-md transition-colors"
                    style={{
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-card)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--bg-card-hover)';
                      e.currentTarget.style.color = 'var(--christmas-cream)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'var(--bg-card)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-10">
          <h2
            className="text-3xl font-bold"
            style={{ color: 'var(--christmas-cream)' }}
          >
            Welcome{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
          </h2>
          <p
            className="mt-2 text-lg"
            style={{ color: 'var(--text-secondary)' }}
          >
            Access all your internal tools and resources in one place.
          </p>
        </div>

        {/* Tools Section */}
        <section className="mb-12">
          <div className="flex items-center mb-6">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg mr-3"
              style={{ background: 'var(--christmas-green)' }}
            >
              <svg className="w-4 h-4" style={{ color: 'var(--christmas-cream)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3
              className="text-xl font-semibold"
              style={{ color: 'var(--christmas-cream)' }}
            >
              Tools
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tools.map((tool) => (
              <ToolCard key={tool.name} {...tool} />
            ))}
          </div>
        </section>

        {/* Resources Section */}
        <section className="mb-12">
          <div className="flex items-center mb-6">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg mr-3"
              style={{ background: 'var(--christmas-green)' }}
            >
              <svg className="w-4 h-4" style={{ color: 'var(--christmas-cream)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3
              className="text-xl font-semibold"
              style={{ color: 'var(--christmas-cream)' }}
            >
              Resources
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {resources.map((resource) => (
              <ToolCard key={resource.name} {...resource} />
            ))}
          </div>
        </section>

        {/* Marketing Section */}
        <section className="mb-12">
          <div className="flex items-center mb-6">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg mr-3"
              style={{ background: 'var(--christmas-gold)' }}
            >
              <svg className="w-4 h-4" style={{ color: 'var(--dark-bg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <h3
              className="text-xl font-semibold"
              style={{ color: 'var(--christmas-cream)' }}
            >
              Marketing
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketing.map((item) => (
              <ToolCard key={item.name} {...item} />
            ))}
          </div>
        </section>

        {/* Quick Links */}
        <section>
          <div className="flex items-center mb-6">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg mr-3"
              style={{ background: 'var(--christmas-green)' }}
            >
              <svg className="w-4 h-4" style={{ color: 'var(--christmas-cream)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3
              className="text-xl font-semibold"
              style={{ color: 'var(--christmas-cream)' }}
            >
              Quick Links
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {quickLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2.5 rounded-lg transition-all duration-200"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--bg-card-hover)';
                  e.currentTarget.style.color = 'var(--christmas-green-light)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'var(--bg-card)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span className="mr-2">
                  <QuickLinkIcon name={link.icon} />
                </span>
                <span className="font-medium">{link.name}</span>
              </a>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="border-t mt-auto"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-subtle)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p
            className="text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Christmas Air Conditioning & Plumbing | christmasair.com
          </p>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Need help? Contact{" "}
            <a
              href="mailto:support@christmasair.com"
              className="hover:underline"
              style={{ color: 'var(--christmas-green-light)' }}
            >
              support@christmasair.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
