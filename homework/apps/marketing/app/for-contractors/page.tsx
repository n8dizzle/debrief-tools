import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'For Contractors',
  description:
    'Grow your business with Homework. Get quality leads, instant bookings, and easy payments without the marketing headaches.',
};

const benefits = [
  {
    title: 'No marketing costs',
    description:
      'Stop spending thousands on ads and lead generation. Homework brings qualified homeowners directly to you. You only pay when you get booked.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
  {
    title: 'Instant bookings',
    description:
      'Homeowners book directly through your calendar. No phone tag, no back-and-forth. Just confirmed appointments ready to go.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: 'Easy payments',
    description:
      'Get paid fast with secure payment processing. Funds are released as soon as the job is completed and the homeowner is satisfied.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
  {
    title: 'Professional profile',
    description:
      'Showcase your work, certifications, and reviews with a professional profile page. Build your reputation and stand out from the competition.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  {
    title: 'Business insights',
    description:
      'Track your performance with detailed analytics. See your bookings, revenue, ratings, and customer feedback all in one dashboard.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    title: 'Price Book tool',
    description:
      'Build and manage your pricing with our free Price Book tool. Create professional quotes in seconds and maintain consistent pricing.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
];

const howItWorks = [
  {
    step: '1',
    title: 'Create your profile',
    description:
      'Sign up, add your licenses and insurance, and tell us about your services and service area.',
  },
  {
    step: '2',
    title: 'Set up your Price Book',
    description:
      'Use our Price Book tool to create your service catalog with transparent pricing for homeowners.',
  },
  {
    step: '3',
    title: 'Start getting booked',
    description:
      'Homeowners in your area will find you, compare your prices, and book directly on your calendar.',
  },
  {
    step: '4',
    title: 'Complete jobs & get paid',
    description:
      'Do great work, collect payment through the platform, and grow your reputation with verified reviews.',
  },
];

const platformStats = [
  { value: '50+', label: 'Active Contractors' },
  { value: '95%', label: 'Satisfaction Rate' },
  { value: '48hrs', label: 'Avg. Payout Time' },
  { value: '$0', label: 'Upfront Cost' },
];

export default function ForContractorsPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="gradient-hero-emerald">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -right-20 -top-20 h-[400px] w-[400px] rounded-full bg-white/5 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-[300px] w-[300px] rounded-full bg-white/5 blur-3xl" />
          </div>

          <div className="container-wide relative pb-20 pt-20 sm:pb-28 sm:pt-28 lg:pb-32 lg:pt-32">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-emerald-100">
                For Contractors
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Grow your business with{' '}
                <span className="text-emerald-200">Homework</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-emerald-100 sm:text-xl">
                Get quality leads, instant bookings, and easy payments. No
                marketing spend required. Focus on what you do best -- great work.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="https://contractor.homework.com/signup"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-emerald-700 shadow-lg transition-all hover:bg-emerald-50 sm:w-auto"
                >
                  Apply to Join
                  <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  href="https://contractor.homework.com/login"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-white/10 sm:w-auto"
                >
                  Contractor Login
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative -mt-8 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-100 shadow-xl ring-1 ring-slate-100 sm:grid-cols-4">
              {platformStats.map((stat) => (
                <div key={stat.label} className="bg-white p-6 text-center sm:p-8">
                  <div className="text-2xl font-bold text-secondary sm:text-3xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-secondary">
              Benefits
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything you need to grow
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              Homework gives contractors the tools and leads they need to build a
              thriving business.
            </p>
          </div>

          <div className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="hover-lift rounded-2xl border border-slate-100 p-6">
                <div className="inline-flex rounded-xl bg-emerald-50 p-3 text-secondary">
                  {benefit.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-padding bg-slate-50">
        <div className="container-wide">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-secondary">
              How It Works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Get started in four steps
            </h2>
          </div>

          <div className="mx-auto mt-16 max-w-3xl">
            <div className="space-y-8">
              {howItWorks.map((item, index) => (
                <div key={item.step} className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white">
                      {item.step}
                    </div>
                    {index < howItWorks.length - 1 && (
                      <div className="mt-2 h-full w-px bg-emerald-200" />
                    )}
                  </div>
                  <div className="pb-8">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-base text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Price Book Teaser */}
      <section id="price-book" className="section-padding">
        <div className="container-wide">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-secondary">
                Free Tool
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Build your Price Book
              </h2>
              <p className="mt-4 text-lg text-slate-500">
                Our free Price Book tool helps you create and manage your service
                catalog with professional, transparent pricing. Stop guessing on
                quotes and start closing more jobs.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  'Create itemized service packages',
                  'Set flat-rate or hourly pricing',
                  'Include materials and labor breakdowns',
                  'Generate professional PDF quotes',
                  'Sync pricing to your Homework profile',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 shrink-0 text-secondary"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                    <span className="text-base text-slate-600">{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="https://contractor.homework.com/price-book"
                className="mt-8 inline-flex items-center rounded-xl bg-secondary px-6 py-3 text-base font-semibold text-white transition-all hover:bg-secondary-dark"
              >
                Try the Price Book
                <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 lg:p-12">
              {/* Price Book mockup */}
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">AC Tune-Up</div>
                    <div className="text-xs text-slate-500">Standard maintenance package</div>
                  </div>
                  <div className="text-lg font-bold text-secondary">$89</div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Drain Clearing</div>
                    <div className="text-xs text-slate-500">Single drain, standard access</div>
                  </div>
                  <div className="text-lg font-bold text-secondary">$149</div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Fence Repair</div>
                    <div className="text-xs text-slate-500">Up to 2 panels, cedar</div>
                  </div>
                  <div className="text-lg font-bold text-secondary">$275</div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Interior Paint - Room</div>
                    <div className="text-xs text-slate-500">Standard room, 2 coats</div>
                  </div>
                  <div className="text-lg font-bold text-secondary">$350</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-slate-50">
        <div className="container-narrow">
          <div className="gradient-hero-emerald overflow-hidden rounded-3xl p-10 text-center sm:p-16">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to grow your business?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-emerald-100">
              Join the Homework network and start getting quality leads from
              homeowners in your area. No upfront costs, no long-term contracts.
            </p>
            <div className="mt-8">
              <Link
                href="https://contractor.homework.com/signup"
                className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-emerald-700 shadow-lg transition-all hover:bg-emerald-50"
              >
                Apply to Join Homework
                <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
