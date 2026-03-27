import Link from 'next/link';

const homeownerFAQs = [
  {
    question: 'How does Homework work?',
    answer:
      'Homework is a home services marketplace that connects you with vetted local contractors. Browse our catalog of 100+ standardized services, compare transparent pricing from multiple contractors, and book online in minutes.',
  },
  {
    question: 'Is it free to use Homework as a homeowner?',
    answer:
      'Yes! Creating an account, browsing services, and comparing contractor prices is completely free. You only pay when you book a service, and the price you see is the price you pay - no hidden fees.',
  },
  {
    question: 'How are contractors vetted?',
    answer:
      'Every contractor on Homework goes through a rigorous approval process. We verify their business license, insurance coverage, and conduct background checks. We also monitor ongoing customer reviews and satisfaction ratings.',
  },
  {
    question: 'What if I am not satisfied with the work?',
    answer:
      'We stand behind every job on our platform with a satisfaction guarantee. If the work does not meet the agreed-upon scope, we will work with the contractor to make it right or provide a refund.',
  },
  {
    question: 'How does pricing work?',
    answer:
      'Every service on Homework has a standardized scope definition - a clear description of exactly what is included and excluded. Contractors set their own prices against these scopes, so you can compare identical work across multiple providers.',
  },
  {
    question: 'What areas do you serve?',
    answer:
      'Homework currently serves the Dallas-Fort Worth metropolitan area, including Dallas, Fort Worth, Arlington, Plano, Frisco, McKinney, Denton, and over 150 surrounding zip codes. We are expanding to new markets soon.',
  },
  {
    question: 'How do payments work?',
    answer:
      'Payments are processed securely through Stripe. When you book a service, your payment is authorized but not charged until the work is completed and you confirm satisfaction. Contractors are paid through our platform after job completion.',
  },
  {
    question: 'What is HomeFit?',
    answer:
      'HomeFit is our smart matching engine. When you create a home profile (property details, systems, features), HomeFit automatically shows you only the services relevant to your specific home. For example, pool services only appear if you have a pool.',
  },
];

const contractorFAQs = [
  {
    question: 'How do I join Homework as a contractor?',
    answer:
      'Sign up at pro.homework.com, complete your business profile, select your trades and service areas, and submit for review. Our team will verify your credentials and you can start setting prices within a few business days.',
  },
  {
    question: 'What does it cost to join?',
    answer:
      'There is no upfront cost to join Homework. We operate on a marketplace model where a small platform fee is included in each transaction. You set your own prices and keep the majority of every job.',
  },
  {
    question: 'How do I set my prices?',
    answer:
      'You browse our standardized catalog of services and set your price for each one you offer. Each service has a clear scope definition, so you know exactly what work is expected. You can update your prices anytime.',
  },
  {
    question: 'What is the Price Book tool?',
    answer:
      'The Price Book is a free tool for contractors. Upload your supplier price lists (PDFs), and our AI parses them into structured data. Set your markups, map items to our catalog, and export to your CRM. It saves hours of manual data entry every week.',
  },
  {
    question: 'How do I get paid?',
    answer:
      'Payments are processed through Stripe Connect. After a job is completed and confirmed, your payout is automatically transferred to your bank account. Most contractors see funds within 2-3 business days.',
  },
  {
    question: 'Can I choose which jobs to accept?',
    answer:
      'Yes. When a homeowner books your service, you have a window to confirm or decline the job. You control your own schedule, service areas, and daily capacity.',
  },
];

function FAQSection({
  title,
  faqs,
}: {
  title: string;
  faqs: { question: string; answer: string }[];
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <dl className="mt-8 space-y-6">
        {faqs.map((faq) => (
          <div
            key={faq.question}
            className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
          >
            <dt className="text-base font-semibold text-slate-900">
              {faq.question}
            </dt>
            <dd className="mt-3 text-sm leading-relaxed text-slate-500">
              {faq.answer}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function FAQPage() {
  return (
    <>
      {/* Hero */}
      <section className="gradient-hero">
        <div className="container-wide pb-16 pt-20 text-center sm:pb-20 sm:pt-28">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            Everything you need to know about Homework. Can&apos;t find what
            you&apos;re looking for? Reach out to our team.
          </p>
        </div>
      </section>

      {/* FAQs */}
      <section className="section-padding">
        <div className="container-narrow space-y-16">
          <FAQSection title="For Homeowners" faqs={homeownerFAQs} />
          <FAQSection title="For Contractors" faqs={contractorFAQs} />
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-slate-50">
        <div className="container-narrow text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Still have questions?
          </h2>
          <p className="mt-3 text-base text-slate-500">
            Our team is here to help. Get in touch and we will get back to you
            within 24 hours.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark"
            >
              Contact Us
            </Link>
            <Link
              href="https://app.homework.com/signup"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-8 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
