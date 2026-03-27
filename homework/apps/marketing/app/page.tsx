import Link from 'next/link';

const stats = [
  { label: 'Services', value: '100+' },
  { label: 'Vetted Contractors', value: '50+' },
  { label: 'Serving DFW', value: 'Dallas-Fort Worth' },
];

const steps = [
  {
    number: '01',
    title: 'Tell us about your home',
    description:
      'Answer a few quick questions about your property and what you need done. Our smart matching finds the right services for you.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Browse & compare',
    description:
      'See transparent pricing from multiple vetted contractors. Compare reviews, availability, and pricing side by side.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Book & relax',
    description:
      'Schedule at your convenience, pay securely, and enjoy guaranteed satisfaction. We handle the details so you do not have to.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
      </svg>
    ),
  },
];

const departments = [
  {
    name: 'The Lot',
    description:
      'Everything from the curb to your front door. Landscaping, fencing, irrigation, driveway, mailbox, and outdoor living spaces.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
    color: 'bg-emerald-50 text-emerald-600',
    services: ['Landscaping', 'Fencing', 'Irrigation', 'Driveways', 'Outdoor Living'],
  },
  {
    name: 'The Exterior',
    description:
      'Protect and beautify the outside of your home. Roofing, siding, gutters, windows, painting, and structural work.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819" />
      </svg>
    ),
    color: 'bg-blue-50 text-blue-600',
    services: ['Roofing', 'Siding', 'Gutters', 'Windows', 'Exterior Painting'],
  },
  {
    name: 'The Interior',
    description:
      'Make the inside of your home perfect. HVAC, plumbing, electrical, flooring, painting, kitchen, and bathroom remodeling.',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    color: 'bg-amber-50 text-amber-600',
    services: ['HVAC', 'Plumbing', 'Electrical', 'Flooring', 'Remodeling'],
  },
];

const valueProps = [
  {
    title: 'Transparent pricing',
    description:
      'See real prices upfront from our contractor price books. No hidden fees, no surprise charges. Know exactly what you will pay before you book.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
  {
    title: 'Vetted contractors',
    description:
      'Every contractor on Homework is licensed, insured, and background-checked. We verify credentials so you can book with confidence.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
  {
    title: 'Guaranteed satisfaction',
    description:
      'Not happy with the work? We will make it right. Our satisfaction guarantee means you never pay for work that does not meet our standards.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
      </svg>
    ),
  },
  {
    title: 'Easy scheduling',
    description:
      'Book online in minutes. Pick a date and time that works for you. Get confirmation instantly and reminders before your appointment.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: 'Secure payments',
    description:
      'Pay securely through the platform. Funds are held in escrow until the job is complete and you are satisfied with the work.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
  },
  {
    title: 'Real reviews',
    description:
      'Read verified reviews from real homeowners in your area. Every review comes from a completed, confirmed job on the platform.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
  },
];

const testimonials = [
  {
    quote:
      'Homework made getting a new roof so easy. I compared three quotes in minutes and the contractor they matched me with was incredible.',
    name: 'Sarah M.',
    location: 'Plano, TX',
    rating: 5,
  },
  {
    quote:
      'As a contractor, Homework brings me quality leads without the marketing headaches. The price book tool alone saved me hours every week.',
    name: 'Mike R.',
    location: 'Arlington, TX',
    rating: 5,
  },
  {
    quote:
      'Transparent pricing is a game-changer. No more calling around for quotes. I knew exactly what my kitchen remodel would cost upfront.',
    name: 'Jennifer L.',
    location: 'Fort Worth, TX',
    rating: 5,
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="gradient-hero">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -left-20 -top-20 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 h-[400px] w-[400px] rounded-full bg-secondary/10 blur-3xl" />
          </div>

          <div className="container-wide relative pb-20 pt-20 sm:pb-28 sm:pt-28 lg:pb-36 lg:pt-32">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Home services,{' '}
                <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                  simplified.
                </span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-slate-300 sm:text-xl">
                Compare prices, book instantly, and get quality home services from
                vetted local contractors. From your lot to your living room, we have
                got you covered.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="https://app.homework.com/signup"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary-dark hover:shadow-xl hover:shadow-primary/40 sm:w-auto"
                >
                  Get Started
                  <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  href="/for-contractors"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:border-slate-400 hover:bg-white/5 sm:w-auto"
                >
                  I&apos;m a Contractor
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative -mt-8 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-100 sm:p-8">
              {stats.map((stat) => (
                <div key={stat.label} className="px-4 text-center sm:px-8">
                  <div className="text-xl font-bold text-primary sm:text-2xl">
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

      {/* How It Works */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              How It Works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Three steps to a better home
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              Getting quality home services has never been easier. Here is how
              Homework works for homeowners.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3 lg:gap-12">
            {steps.map((step) => (
              <div key={step.number} className="relative text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary">
                  {step.icon}
                </div>
                <div className="mt-1 text-xs font-bold text-primary/40">
                  {step.number}
                </div>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-slate-500">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Department Showcase */}
      <section className="section-padding bg-slate-50">
        <div className="container-wide">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Our Departments
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Every part of your home, covered
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              We organize services into three departments so you can find exactly
              what you need, fast.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {departments.map((dept) => (
              <div
                key={dept.name}
                className="hover-lift rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100"
              >
                <div
                  className={`inline-flex rounded-xl p-3 ${dept.color}`}
                >
                  {dept.icon}
                </div>
                <h3 className="mt-5 text-xl font-bold text-slate-900">
                  {dept.name}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-slate-500">
                  {dept.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {dept.services.map((service) => (
                    <span
                      key={service}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {service}
                    </span>
                  ))}
                </div>
                <Link
                  href={`/services#${dept.name.toLowerCase().replace('the ', '')}`}
                  className="mt-6 inline-flex items-center text-sm font-semibold text-primary hover:text-primary-dark"
                >
                  Explore services
                  <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Homework */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Why Homework
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              The smarter way to get things done
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              We built Homework to fix everything that is broken about hiring home
              service professionals.
            </p>
          </div>

          <div className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {valueProps.map((prop) => (
              <div key={prop.title} className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  {prop.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {prop.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {prop.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="section-padding bg-slate-50">
        <div className="container-wide">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Testimonials
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Trusted by homeowners and contractors
            </h2>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100"
              >
                {/* Stars */}
                <div className="flex gap-1">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <svg
                      key={i}
                      className="h-5 w-5 text-amber-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ))}
                </div>
                <blockquote className="mt-4 text-base leading-relaxed text-slate-600">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {testimonial.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {testimonial.location}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="section-padding">
        <div className="container-narrow">
          <div className="gradient-hero-blue overflow-hidden rounded-3xl p-10 text-center sm:p-16">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to simplify your home services?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
              Join thousands of DFW homeowners who trust Homework to keep their
              homes in top shape.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="https://app.homework.com/signup"
                className="inline-flex w-full items-center justify-center rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-primary shadow-lg transition-all hover:bg-slate-50 sm:w-auto"
              >
                Get Started Free
                <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <Link
                href="/for-contractors"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-white/10 sm:w-auto"
              >
                Join as a Contractor
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
