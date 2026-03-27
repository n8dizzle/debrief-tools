import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Browse 100+ home services across landscaping, exterior, and interior categories. Find vetted contractors in the DFW area.',
};

type Service = {
  name: string;
  description: string;
  startingAt: string;
};

type Department = {
  id: string;
  name: string;
  tagline: string;
  color: string;
  iconBg: string;
  icon: React.ReactNode;
  services: Service[];
};

const departments: Department[] = [
  {
    id: 'lot',
    name: 'The Lot',
    tagline: 'Curb to front door',
    color: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
    services: [
      { name: 'Lawn Care & Mowing', description: 'Regular mowing, edging, and lawn maintenance for a pristine yard.', startingAt: '$35' },
      { name: 'Landscaping Design', description: 'Custom landscape design and installation for your property.', startingAt: '$500' },
      { name: 'Irrigation & Sprinklers', description: 'Sprinkler installation, repair, and seasonal maintenance.', startingAt: '$150' },
      { name: 'Fencing', description: 'Wood, vinyl, and metal fence installation and repair.', startingAt: '$200' },
      { name: 'Driveway & Walkways', description: 'Concrete, pavers, and asphalt for driveways and paths.', startingAt: '$1,000' },
      { name: 'Outdoor Living', description: 'Patios, pergolas, decks, and outdoor kitchen construction.', startingAt: '$2,500' },
      { name: 'Tree Services', description: 'Tree trimming, removal, stump grinding, and planting.', startingAt: '$150' },
      { name: 'Pool Services', description: 'Pool cleaning, repair, and equipment maintenance.', startingAt: '$100' },
    ],
  },
  {
    id: 'exterior',
    name: 'The Exterior',
    tagline: 'Protecting your home',
    color: 'text-blue-600',
    iconBg: 'bg-blue-50',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819" />
      </svg>
    ),
    services: [
      { name: 'Roofing', description: 'Roof inspection, repair, and full replacement for all materials.', startingAt: '$300' },
      { name: 'Siding', description: 'Siding installation and repair -- vinyl, fiber cement, and wood.', startingAt: '$500' },
      { name: 'Gutters', description: 'Gutter installation, cleaning, and guard systems.', startingAt: '$100' },
      { name: 'Windows & Doors', description: 'Window and door installation, replacement, and weatherproofing.', startingAt: '$200' },
      { name: 'Exterior Painting', description: 'Professional exterior painting and staining services.', startingAt: '$800' },
      { name: 'Concrete & Foundation', description: 'Foundation repair, concrete leveling, and waterproofing.', startingAt: '$500' },
      { name: 'Garage Doors', description: 'Garage door installation, repair, and opener services.', startingAt: '$150' },
      { name: 'Solar Panels', description: 'Solar panel installation and maintenance for energy savings.', startingAt: '$5,000' },
    ],
  },
  {
    id: 'interior',
    name: 'The Interior',
    tagline: 'Inside your home',
    color: 'text-amber-600',
    iconBg: 'bg-amber-50',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    services: [
      { name: 'HVAC', description: 'Heating and cooling installation, repair, and maintenance.', startingAt: '$89' },
      { name: 'Plumbing', description: 'Pipe repair, fixture installation, drain cleaning, and water heaters.', startingAt: '$100' },
      { name: 'Electrical', description: 'Wiring, panel upgrades, outlet installation, and lighting.', startingAt: '$100' },
      { name: 'Flooring', description: 'Hardwood, tile, carpet, and vinyl flooring installation.', startingAt: '$500' },
      { name: 'Interior Painting', description: 'Professional interior painting for rooms, cabinets, and trim.', startingAt: '$250' },
      { name: 'Kitchen Remodeling', description: 'Full kitchen renovations including cabinets, counters, and appliances.', startingAt: '$5,000' },
      { name: 'Bathroom Remodeling', description: 'Bathroom renovation, tiling, fixtures, and vanities.', startingAt: '$3,000' },
      { name: 'Insulation', description: 'Attic, wall, and crawlspace insulation for energy efficiency.', startingAt: '$500' },
    ],
  },
];

export default function ServicesPage() {
  return (
    <>
      {/* Hero */}
      <section className="gradient-hero pb-16 pt-16 sm:pb-20 sm:pt-20">
        <div className="container-wide text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Our Services
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            Browse 100+ home services organized across three departments. Every
            service comes with transparent pricing and vetted contractors.
          </p>
        </div>
      </section>

      {/* Quick Nav */}
      <div className="sticky top-16 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="container-wide">
          <div className="flex gap-1 overflow-x-auto py-3 sm:justify-center">
            {departments.map((dept) => (
              <a
                key={dept.id}
                href={`#${dept.id}`}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-100 ${dept.color}`}
              >
                <span className={`inline-flex rounded-md p-1 ${dept.iconBg}`}>
                  {dept.icon}
                </span>
                {dept.name}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Department Sections */}
      {departments.map((dept) => (
        <section
          key={dept.id}
          id={dept.id}
          className="section-padding scroll-mt-32 even:bg-slate-50"
        >
          <div className="container-wide">
            <div className="mb-12">
              <div className="flex items-center gap-3">
                <span className={`inline-flex rounded-xl p-3 ${dept.iconBg} ${dept.color}`}>
                  {dept.icon}
                </span>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                    {dept.name}
                  </h2>
                  <p className="text-sm text-slate-500">{dept.tagline}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {dept.services.map((service) => (
                <Link
                  key={service.name}
                  href={`https://app.homework.com/services/${dept.id}/${service.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  className="hover-lift group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
                >
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-primary">
                    {service.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {service.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">
                      Starting at
                    </span>
                    <span className="text-lg font-bold text-primary">
                      {service.startingAt}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Browse contractors
                    <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="section-padding">
        <div className="container-narrow">
          <div className="gradient-hero-blue overflow-hidden rounded-3xl p-10 text-center sm:p-16">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Do not see what you need?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
              We are adding new services every week. Tell us what you are looking
              for and we will match you with the right contractor.
            </p>
            <Link
              href="https://app.homework.com/request"
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-primary shadow-lg transition-all hover:bg-slate-50"
            >
              Request a Service
              <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
