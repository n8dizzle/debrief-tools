import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Program Terms — Christmas Air Referrals",
  description:
    "Terms and conditions for the Christmas Air Neighbors Helping Neighbors referral program.",
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />

      <section className="px-6 pt-12 pb-6 md:pt-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl mb-4">Program Terms</h1>
          <p className="opacity-80">
            Effective April 17, 2026. Christmas Air Conditioning &amp; Plumbing
            (&ldquo;Christmas Air&rdquo;) reserves the right to update these terms;
            material changes will be emailed to active program participants.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div
          className="max-w-3xl mx-auto card"
          style={{ lineHeight: 1.7 }}
        >
          <Section title="1. Eligibility">
            <p>
              The Neighbors Helping Neighbors program is open to current
              Christmas Air customers in the State of Texas. By enrolling, you
              confirm you are a customer in good standing and authorized to
              share your contact information with us.
            </p>
          </Section>

          <Section title="2. How referrals work">
            <p>
              You receive a unique referral code and link. When someone uses
              your link or mentions your name during booking, we record them as
              your referral. A referral is considered &ldquo;successful&rdquo; when
              the referred person becomes a Christmas Air customer and a job is
              completed and paid for in full.
            </p>
          </Section>

          <Section title="3. Reward amounts">
            <p>
              Referrer rewards range from $50 to $500+ depending on the service
              category, as published on the program landing page. Christmas Air
              may adjust reward amounts at any time; changes take effect for
              referrals submitted after the change date. Referrals already
              submitted are paid at the rate that was in effect when they were
              submitted.
            </p>
          </Section>

          <Section title="4. Reward delivery">
            <p>
              Rewards are issued via email through Tremendous as Visa or Amazon
              gift cards, applied as account credit on your Christmas Air
              account, or donated to a charity at your direction. Rewards are
              typically delivered within 24 hours of the referred job being
              invoiced. Delivery delays caused by third-party processors do not
              constitute failure to pay.
            </p>
          </Section>

          <Section title="5. Triple Win charity match">
            <p>
              Triple Win is a company-wide policy, not a per-referrer opt-in.
              When Christmas Air has Triple Win enabled and you have a charity
              selected in your account, every successful referral you make
              also triggers a matched donation to your selected charity, in
              addition to your full reward — not in place of it. The match
              amount and cap are determined by the service category and are
              funded entirely by Christmas Air. Christmas Air selects
              fulfillment partners (currently Tremendous, with some donations
              pooled for quarterly direct payment to local charities). Your
              selected charity is snapshotted at the time each referral is
              submitted; later changes to your preference do not affect
              in-flight referrals. Christmas Air may pause or resume the
              Triple Win program at any time; during a pause, new referrals
              will not trigger charity matches, but already-submitted
              referrals keep their snapshot and are honored.
            </p>
          </Section>

          <Section title="6. Limits and exclusions">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You may not refer yourself or members of your household.</li>
              <li>
                Existing Christmas Air customers do not qualify as new
                referrals.
              </li>
              <li>
                Duplicate referrals (the same person submitted by multiple
                referrers) credit only the first referrer to submit.
              </li>
              <li>
                Referrals expire 180 days after submission if no booking
                occurs.
              </li>
              <li>
                Christmas Air may withhold or claw back rewards if a referred
                job is voided, refunded in full, or determined to be
                fraudulent.
              </li>
            </ul>
          </Section>

          <Section title="7. Tax reporting">
            <p>
              If you earn $600 or more in rewards in a calendar year,
              Christmas Air will issue a Form 1099-MISC and report the income
              to the IRS as required by federal law. You are responsible for
              the tax treatment of these rewards on your personal return.
              Charity donations made under Triple Win do not count toward your
              personal taxable income.
            </p>
          </Section>

          <Section title="8. Information we collect">
            <p>
              When you enroll, we collect your name, phone number, email
              address, and reward preference. We match your contact information
              against our customer records in ServiceTitan. When you refer
              someone, we collect their name, phone, optional email and
              address, and the service they need. This information is used
              solely to schedule and complete service, issue rewards, and
              communicate about the program. We do not sell your information
              or your referrals&apos; information.
            </p>
          </Section>

          <Section title="9. Termination">
            <p>
              You may leave the program at any time by contacting Christmas
              Air at <a href="tel:4692142013">(469) 214-2013</a>. Active
              referrals will continue to be honored. Christmas Air reserves
              the right to terminate any participant&apos;s account for
              violations of these terms or fraudulent activity, with notice
              where reasonably possible.
            </p>
          </Section>

          <Section title="10. Disputes">
            <p>
              If you believe a reward was incorrectly calculated or denied,
              contact us within 60 days. We aim to resolve disputes within 14
              business days. Texas law governs these terms.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Christmas Air Conditioning &amp; Plumbing
              <br />
              1011 Surrey Ln., Bldg 200
              <br />
              Flower Mound, TX 75022
              <br />
              <a href="tel:4692142013">(469) 214-2013</a>
              <br />
              TACLA00120029E &middot; M18185
            </p>
          </Section>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2
        className="text-2xl mb-3"
        style={{ color: "var(--ca-dark-green)" }}
      >
        {title}
      </h2>
      <div className="opacity-90">{children}</div>
    </div>
  );
}
