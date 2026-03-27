import Header from '@/components/Header';
import Link from 'next/link';

const departments = [
  {
    name: 'The Lot',
    description:
      'Landscaping, lawn care, fencing, driveways, and outdoor living spaces.',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
        />
      </svg>
    ),
    services: ['Lawn Care', 'Landscaping', 'Fencing', 'Driveways', 'Patios'],
    color: 'emerald',
  },
  {
    name: 'The Exterior',
    description:
      'Roofing, siding, gutters, windows, painting, and exterior maintenance.',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819"
        />
      </svg>
    ),
    services: ['Roofing', 'Siding', 'Gutters', 'Windows', 'Painting'],
    color: 'blue',
  },
  {
    name: 'The Interior',
    description:
      'HVAC, plumbing, electrical, remodeling, flooring, and smart home.',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        />
      </svg>
    ),
    services: ['HVAC', 'Plumbing', 'Electrical', 'Remodeling', 'Flooring'],
    color: 'amber',
  },
];

const steps = [
  {
    step: 1,
    title: 'Describe your project',
    description:
      'Tell us what you need done. Browse by department or search for a specific service.',
    icon: (
      <svg
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
    ),
  },
  {
    step: 2,
    title: 'Get matched with pros',
    description:
      'Review vetted professionals with transparent pricing, ratings, and availability.',
    icon: (
      <svg
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    ),
  },
  {
    step: 3,
    title: 'Book and pay securely',
    description:
      'Schedule at your convenience and pay through our secure platform. Satisfaction guaranteed.',
    icon: (
      <svg
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
  },
];

const stats = [
  { label: 'Verified Pros', value: '2,500+' },
  { label: 'Jobs Completed', value: '50,000+' },
  { label: 'Average Rating', value: '4.8/5' },
  { label: 'Service Areas', value: '150+' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[var(--hw-primary-50)] via-white to-[var(--hw-bg-secondary)] dark:from-[#1E293B] dark:via-[#0F172A] dark:to-[#0F172A]">
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-[var(--hw-text)] sm:text-5xl lg:text-6xl">
              Home services,{' '}
              <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
                simplified.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--hw-text-secondary)]">
              Find trusted professionals for every part of your home. From
              the lot to the interior, we connect you with vetted pros at
              transparent prices.
            </p>

            {/* Search Bar */}
            <div className="mx-auto mt-10 max-w-xl">
              <div className="flex overflow-hidden rounded-xl border border-[var(--hw-border)] bg-white shadow-lg dark:bg-[var(--hw-bg-secondary)]">
                <div className="flex flex-1 items-center gap-3 px-4 py-3">
                  <svg
                    className="h-5 w-5 flex-shrink-0 text-[var(--hw-text-tertiary)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="What do you need help with?"
                    className="w-full bg-transparent text-sm text-[var(--hw-text)] placeholder-[var(--hw-text-tertiary)] outline-none"
                  />
                </div>
                <button
                  type="button"
                  className="m-1.5 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  Search
                </button>
              </div>
              <p className="mt-3 text-sm text-[var(--hw-text-tertiary)]">
                Popular:{' '}
                <span className="cursor-pointer text-primary hover:underline">
                  AC Repair
                </span>
                {' , '}
                <span className="cursor-pointer text-primary hover:underline">
                  Lawn Care
                </span>
                {' , '}
                <span className="cursor-pointer text-primary hover:underline">
                  Roof Inspection
                </span>
                {' , '}
                <span className="cursor-pointer text-primary hover:underline">
                  Plumbing
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="pointer-events-none absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-secondary/5 blur-3xl" />
      </section>

      {/* Stats Bar */}
      <section className="border-y border-[var(--hw-border)] bg-white dark:bg-[var(--hw-bg-secondary)]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-8 sm:px-6 md:grid-cols-4 lg:px-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-primary sm:text-3xl">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-[var(--hw-text-secondary)]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Department Cards */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--hw-text)] sm:text-4xl">
            Every part of your home, covered
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--hw-text-secondary)]">
            Browse services organized by where the work happens. Find exactly
            what you need in seconds.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {departments.map((dept) => (
            <div
              key={dept.name}
              className="group relative overflow-hidden rounded-2xl border border-[var(--hw-border)] bg-white p-8 shadow-sm transition-all hover:shadow-lg dark:bg-[var(--hw-bg-secondary)]"
            >
              <div
                className={`inline-flex rounded-xl p-3 ${
                  dept.color === 'emerald'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                    : dept.color === 'blue'
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                      : 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                }`}
              >
                {dept.icon}
              </div>
              <h3 className="mt-5 text-xl font-bold text-[var(--hw-text)]">
                {dept.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--hw-text-secondary)]">
                {dept.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {dept.services.map((service) => (
                  <span
                    key={service}
                    className="rounded-full bg-[var(--hw-bg-tertiary)] px-3 py-1 text-xs font-medium text-[var(--hw-text-secondary)]"
                  >
                    {service}
                  </span>
                ))}
              </div>
              <div className="mt-6">
                <Link
                  href="/browse"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-dark"
                >
                  Browse services
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section
        id="how-it-works"
        className="bg-[var(--hw-bg-secondary)] dark:bg-[var(--hw-bg-secondary)]"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--hw-text)] sm:text-4xl">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--hw-text-secondary)]">
              Getting your project done has never been easier. Three simple steps
              to a completed job.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.step} className="relative text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-md shadow-primary/25">
                  {step.icon}
                </div>
                <div className="mt-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--hw-bg-tertiary)] text-xs font-bold text-[var(--hw-text-secondary)]">
                  {step.step}
                </div>
                <h3 className="mt-3 text-lg font-bold text-[var(--hw-text)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--hw-text-secondary)]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary to-primary-dark">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
            Join thousands of homeowners who trust Homework for their home
            service needs.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-xl bg-white px-8 py-3 text-sm font-semibold text-primary shadow-md transition-colors hover:bg-blue-50"
            >
              Create free account
            </Link>
            <Link
              href="/browse"
              className="rounded-xl border-2 border-white/30 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Browse services
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--hw-border)] bg-white dark:bg-[var(--hw-bg)]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                    />
                  </svg>
                </div>
                <span className="text-lg font-bold">Homework</span>
              </div>
              <p className="mt-3 text-sm text-[var(--hw-text-secondary)]">
                Home services, simplified. Find trusted professionals for every
                part of your home.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--hw-text)]">
                Services
              </h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href="/browse"
                    className="text-sm text-[var(--hw-text-secondary)] hover:text-primary"
                  >
                    The Lot
                  </Link>
                </li>
                <li>
                  <Link
                    href="/browse"
                    className="text-sm text-[var(--hw-text-secondary)] hover:text-primary"
                  >
                    The Exterior
                  </Link>
                </li>
                <li>
                  <Link
                    href="/browse"
                    className="text-sm text-[var(--hw-text-secondary)] hover:text-primary"
                  >
                    The Interior
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--hw-text)]">
                Company
              </h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href="/about"
                    className="text-sm text-[var(--hw-text-secondary)] hover:text-primary"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    href="/careers"
                    className="text-sm text-[var(--hw-text-secondary)] hover:text-primary"
                  >
                    Careers
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="text-sm text-[var(--hw-text-secondary)] hover:text-primary"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--hw-text)]">
                For Pros
              </h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href="/pros"
                    className="text-sm text-[var(--hw-text-secondary)] hover:text-primary"
                  >
                    Join as a Pro
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pros/resources"
                    className="text-sm text-[var(--hw-text-secondary)] hover:text-primary"
                  >
                    Resources
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pros/success"
                    className="text-sm text-[var(--hw-text-secondary)] hover:text-primary"
                  >
                    Success Stories
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-[var(--hw-border)] pt-6 text-center text-sm text-[var(--hw-text-tertiary)]">
            &copy; {new Date().getFullYear()} Homework. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
