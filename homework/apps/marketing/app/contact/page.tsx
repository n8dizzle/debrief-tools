import Link from 'next/link';

const contactMethods = [
  {
    title: 'Email Us',
    description: 'Send us a message and we will respond within 24 hours.',
    value: 'hello@homework.com',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    title: 'Call Us',
    description: 'Mon-Fri from 8am to 6pm CT.',
    value: '(214) 555-HOME',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
      </svg>
    ),
  },
  {
    title: 'Visit Us',
    description: 'Come say hello at our DFW headquarters.',
    value: 'Dallas, TX 75201',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
  },
];

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="gradient-hero">
        <div className="container-wide pb-16 pt-20 text-center sm:pb-20 sm:pt-28">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Get in Touch
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            Whether you&apos;re a homeowner with questions or a contractor
            interested in joining, we&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="relative -mt-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-4 sm:grid-cols-3">
            {contactMethods.map((method) => (
              <div
                key={method.title}
                className="rounded-2xl bg-white p-6 text-center shadow-xl ring-1 ring-slate-100"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  {method.icon}
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {method.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {method.description}
                </p>
                <p className="mt-2 text-sm font-semibold text-primary">
                  {method.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="section-padding">
        <div className="container-narrow">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-2xl font-bold text-slate-900">
              Send us a message
            </h2>
            <p className="mt-3 text-center text-base text-slate-500">
              Fill out the form below and we will get back to you within 24
              hours.
            </p>

            <form className="mt-10 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-slate-700"
                  >
                    First name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Last name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="type"
                  className="block text-sm font-medium text-slate-700"
                >
                  I am a...
                </label>
                <select
                  id="type"
                  name="type"
                  className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="homeowner">Homeowner</option>
                  <option value="contractor">Contractor</option>
                  <option value="partner">Business Partner</option>
                  <option value="media">Media / Press</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="subject"
                  className="block text-sm font-medium text-slate-700"
                >
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  className="mt-2 block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="How can we help?"
                />
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-slate-700"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  className="mt-2 block w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Tell us more about your question or request..."
                />
              </div>

              <div className="text-center">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md"
                >
                  Send Message
                  <svg
                    className="ml-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* FAQ CTA */}
      <section className="section-padding bg-slate-50">
        <div className="container-narrow text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Looking for quick answers?
          </h2>
          <p className="mt-3 text-base text-slate-500">
            Check our FAQ page for answers to common questions about Homework.
          </p>
          <Link
            href="/faq"
            className="mt-6 inline-flex items-center justify-center rounded-xl border border-slate-300 px-8 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-white"
          >
            View FAQ
            <svg
              className="ml-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}
