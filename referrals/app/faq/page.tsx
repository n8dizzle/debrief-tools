import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "FAQ — Christmas Air Referrals",
  description:
    "Common questions about the Christmas Air Neighbors Helping Neighbors referral program.",
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "Who can join?",
    a: "Any current Christmas Air customer. If you've had service with us, you're eligible. We'll match your phone or email to your account when you sign up.",
  },
  {
    q: "How do I share my link?",
    a: "Your dashboard has tools for SMS, email, copy-and-paste, and a printable QR code. Share it any way that's natural for you — text a neighbor, post on Nextdoor, hand out a QR card.",
  },
  {
    q: "What counts as a successful referral?",
    a: "When someone you sent us actually books a service that's completed and paid. We don't count clicks or sign-ups — only completed jobs. That's true whether they call, text, or use your link.",
  },
  {
    q: "When do I get my reward?",
    a: "Within 24 hours of the job being invoiced in our system. We send your reward by email — Visa gift card, Amazon credit, account credit, or charity donation, your pick.",
  },
  {
    q: "How much can I earn?",
    a: "Anywhere from $50 (service call) to $500+ (commercial replacement). Bigger jobs mean bigger thanks. See the landing page for the full breakdown by service type.",
  },
  {
    q: "Is there a limit?",
    a: "No cap. Refer one neighbor a year or twenty — every successful referral gets thanked. We'll only ever push back if a referral looks fraudulent.",
  },
  {
    q: "What if my friend is already a Christmas Air customer?",
    a: "We'll let you know. Existing customers don't qualify as new referrals. The program is for bringing in new neighbors, not rewarding existing ones twice.",
  },
  {
    q: "What's Triple Win?",
    a: "An optional add-on. Turn it on, and every successful referral also triggers a donation from Christmas Air to a charity you choose — at no cost to your reward. You still get your full thank-you. The charity match is a bonus we add, not a swap.",
  },
  {
    q: "Can I change my charity?",
    a: "Any time, from your dashboard. Note: the charity attached to a specific referral is locked in when you submit it. Changing your preference doesn't disturb in-flight referrals.",
  },
  {
    q: "Will my friend feel pressured?",
    a: "No. They get a clean, no-hard-sell page that explains who you are and what kind of help you recommended us for. They book or they don't. We don't follow up beyond what's needed to do the job.",
  },
  {
    q: "Are there taxes on rewards?",
    a: "If you earn more than $600 in a calendar year, we're required to send you a 1099. We'll handle the paperwork; you handle the filing with your accountant. Most people stay well under this threshold.",
  },
  {
    q: "Can I leave the program?",
    a: "Absolutely. Just let us know — call (469) 214-2013 — and we'll deactivate your account. Any referrals already in flight will still pay out.",
  },
  {
    q: "Is my friend's information safe?",
    a: "Yes. We only share what's needed to book their service: name, phone, address, and what they need. Their info goes straight to ServiceTitan, our scheduling system. We don't sell or share data, and your friend can ask us to delete their record at any time.",
  },
  {
    q: "Where do I see my history?",
    a: "Your dashboard shows everyone you've referred, what stage they're at, and what you've earned and donated. Sign in any time at refer.christmasair.com/sign-in.",
  },
];

export default function FAQPage() {
  return (
    <>
      <SiteHeader />
      <section className="px-6 pt-12 pb-6 md:pt-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl mb-4">FAQ</h1>
          <p className="text-lg opacity-80">
            Don&apos;t see your question? Call us at{" "}
            <a href="tel:4692142013" className="font-semibold">
              (469) 214-2013
            </a>
            .
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto space-y-3">
          {FAQ.map((item, i) => (
            <details
              key={i}
              className="card group"
              style={{ padding: "0" }}
            >
              <summary
                className="flex items-center justify-between cursor-pointer p-5 list-none"
                style={{ color: "var(--ca-dark-green)" }}
              >
                <span className="text-lg font-semibold pr-4">{item.q}</span>
                <span
                  className="text-2xl transition-transform group-open:rotate-45"
                  style={{
                    fontFamily: "var(--font-lobster)",
                    color: "var(--ca-green)",
                  }}
                >
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 opacity-85 leading-relaxed">{item.a}</div>
            </details>
          ))}
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
