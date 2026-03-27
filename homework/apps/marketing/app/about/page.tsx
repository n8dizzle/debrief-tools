import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Homework is a Texas-born home services marketplace on a mission to make home improvement transparent, accessible, and stress-free.',
};

const values = [
  {
    title: 'Transparency first',
    description:
      'We believe homeowners deserve to know what they are paying for. Every price, every review, and every contractor credential is visible and verifiable.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
  {
    title: 'Quality over quantity',
    description:
      'We would rather have 50 great contractors than 500 mediocre ones. Every pro on our platform is vetted, verified, and held to the highest standards.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
      </svg>
    ),
  },
  {
    title: 'Everyone wins',
    description:
      'The best marketplace is one where both sides benefit. Homeowners get fair prices and great work. Contractors get quality leads and sustainable income.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    title: 'Built for Texas',
    description:
      'We started in Dallas-Fort Worth because it is home. We understand the unique challenges of Texas homeowners -- the heat, the storms, the clay soil.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
  },
];

const milestones = [
  {
    year: '2025',
    title: 'The idea',
    description:
      'Born from the frustration of hiring contractors the old way -- endless calls, unclear pricing, and crossed fingers.',
  },
  {
    year: '2026',
    title: 'Launch in DFW',
    description:
      'Homework launches in the Dallas-Fort Worth metroplex with 50+ vetted contractors across all three departments.',
  },
  {
    year: 'Next',
    title: 'Texas-wide expansion',
    description:
      'Expanding to Houston, San Antonio, and Austin to bring simplified home services to homeowners across the state.',
  },
];

const team = [
  {
    name: 'Founder & CEO',
    role: 'Vision & Strategy',
    description:
      'An operator who has lived the pain of both sides -- running a home services company and hiring contractors as a homeowner.',
  },
  {
    name: 'Head of Product',
    role: 'Product & Engineering',
    description:
      'Building the platform that makes transparent pricing and instant booking possible for every home service.',
  },
  {
    name: 'Head of Contractor Success',
    role: 'Contractor Relations',
    description:
      'Ensuring every contractor on Homework has the tools and support they need to grow their business.',
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="gradient-hero pb-16 pt-16 sm:pb-20 sm:pt-20">
        <div className="container-wide text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            About Homework
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            We are building the home services marketplace that homeowners and
            contractors actually deserve.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="section-padding">
        <div className="container-narrow">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Our Mission
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Make home improvement transparent, accessible, and stress-free
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-slate-500">
              Hiring a contractor should not feel like a leap of faith. We started
              Homework to fix the broken home services experience -- for both
              homeowners and the professionals who serve them. Our platform brings
              transparent pricing, vetted contractors, and instant booking to every
              part of your home.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-slate-50">
        <div className="container-wide">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Our Values
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              What we stand for
            </h2>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2">
            {values.map((value) => (
              <div
                key={value.title}
                className="flex gap-5 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  {value.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {value.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-slate-500">
                    {value.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story / Timeline */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Our Story
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Built in Texas, for Texas
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              Homework was born from a simple question: why is hiring a contractor
              still so hard?
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-2xl">
            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <div key={milestone.year} className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                      {milestone.year}
                    </div>
                    {index < milestones.length - 1 && (
                      <div className="mt-2 h-full w-px bg-primary/20" />
                    )}
                  </div>
                  <div className="pb-8">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {milestone.title}
                    </h3>
                    <p className="mt-2 text-base text-slate-500">
                      {milestone.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="section-padding bg-slate-50">
        <div className="container-wide">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              The Team
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              People who get it done
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              A small team of operators, builders, and home services veterans.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {team.map((member) => (
              <div
                key={member.name}
                className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-50">
                  <svg
                    className="h-10 w-10 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                    />
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">
                  {member.name}
                </h3>
                <p className="text-sm font-medium text-primary">{member.role}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  {member.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Texas Pride */}
      <section className="section-padding">
        <div className="container-narrow text-center">
          <div className="mx-auto max-w-2xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Proudly based in Dallas-Fort Worth
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              We live here. We work here. We hire contractors here. Homework is
              built by Texans who understand the unique needs of Texas homes --
              from 100-degree summers to surprise hailstorms. This is our
              community, and we are here to make it better.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-slate-50">
        <div className="container-narrow">
          <div className="gradient-hero-blue overflow-hidden rounded-3xl p-10 text-center sm:p-16">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Join the Homework community
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
              Whether you are a homeowner looking for reliable service or a
              contractor ready to grow, Homework is here for you.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="https://app.homework.com/signup"
                className="inline-flex w-full items-center justify-center rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-primary shadow-lg transition-all hover:bg-slate-50 sm:w-auto"
              >
                Get Started
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
