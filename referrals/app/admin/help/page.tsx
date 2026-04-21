export const metadata = {
  title: "Help — Referrals Admin",
};

export default function HelpPage() {
  return (
    <div className="max-w-4xl space-y-10">
      <header>
        <h1 className="text-4xl mb-2">Help &amp; staff reference</h1>
        <p className="opacity-80 max-w-2xl">
          How the referral program works end-to-end, what each admin page does,
          and answers to the questions customers ask most. Written for
          dispatchers, CSRs, and managers &mdash; no engineering background needed.
        </p>
        <p className="text-sm opacity-60 mt-3">
          Need more help? Ping Jon in Slack, or call the tech line.
        </p>
      </header>

      <Section id="overview" title="1. What the Referrals Program is">
        <p>
          <a href="https://refer.christmasair.com" target="_blank" rel="noreferrer">
            refer.christmasair.com
          </a>{" "}
          is our customer referral program. Anyone can sign up &mdash; existing
          Christmas Air customers or people who haven&apos;t booked with us yet.
          Each sign-up gets a unique link they can share with friends.
        </p>
        <p>
          When a friend they send uses the link, books service, and pays the
          invoice, three things happen &mdash; the &ldquo;Triple Win&rdquo;:
        </p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>
            <strong>The friend</strong> gets their HVAC or plumbing fixed and
            receives the discount attached to their referral.
          </li>
          <li>
            <strong>The referrer</strong> gets a gift card (Visa, Amazon) or
            account credit, their choice.
          </li>
          <li>
            <strong>A charity</strong> the referrer picked gets a matched
            donation from Christmas Air (on top of the reward, not in place of
            it).
          </li>
        </ol>
        <Callout>
          Triple Win is company-wide, not per-customer. The admin can pause or
          resume it globally from the Settings page.
        </Callout>
      </Section>

      <Section id="referrer-flow" title="2. The referrer experience, step by step">
        <ol className="list-decimal pl-6 space-y-3">
          <li>
            <strong>Sign up</strong> at <code>/enroll</code> &mdash; name, email,
            phone, reward preference, and a charity pick (when Triple Win is on
            globally).
          </li>
          <li>
            <strong>Get a referral code</strong> like <code>SARAH-4K2M</code> and
            a shareable link: <code>refer.christmasair.com/refer/SARAH-4K2M</code>.
          </li>
          <li>
            <strong>Share the link</strong> with friends &mdash; text, email,
            social, even read it over the phone.
          </li>
          <li>
            <strong>Friend clicks the link</strong> and lands on a quote form
            that&apos;s already tagged with the referrer&apos;s code.
          </li>
          <li>
            <strong>Friend submits the quote</strong> &mdash; a ServiceTitan lead
            is created, tagged with our referral campaign ID.
          </li>
          <li>
            <strong>Referrer tracks progress</strong> on their dashboard &mdash;
            each referral shows a stage (submitted, booked, completed, paid).
          </li>
          <li>
            <strong>Reward is issued</strong> once the invoice is paid in
            ServiceTitan. Gift cards go out via Tremendous; the charity donation
            is recorded at the same time.
          </li>
        </ol>
      </Section>

      <Section id="code-format" title="3. Why referral codes look like &ldquo;SARAH-4K2M&rdquo;">
        <p>The format is a three-way compromise:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Personal and memorable</strong> &mdash; starts with the
            referrer&apos;s first name, uppercase, up to 8 letters. No name?
            Defaults to <code>FRIEND</code>.
          </li>
          <li>
            <strong>Unique</strong> &mdash; 4 random characters appended so two
            Sarahs don&apos;t collide.
          </li>
          <li>
            <strong>Readable aloud</strong> &mdash; the alphabet deliberately
            excludes <code>0/O</code> and <code>1/I/L</code> so codes can be
            shared over the phone without confusion (&ldquo;is that an O or a
            zero?&rdquo;).
          </li>
          <li>
            <strong>Safety net</strong> &mdash; retries up to 5 times on
            collision, then falls back to a fully-random code like{" "}
            <code>REF-8N3KJ9WM</code>.
          </li>
        </ul>
        <p className="text-xs opacity-60">
          Source: <code>referrals/lib/referral-codes.ts</code>
        </p>
      </Section>

      <Section id="admin-pages" title="4. The admin console &mdash; what each page does">
        <p className="mb-4 opacity-80">
          Sidebar items, in order:
        </p>
        <div className="space-y-4">
          <AdminPageEntry
            title="Dashboard"
            what="Scoreboard. At-a-glance totals: enrolled referrers, active referrals, rewards issued, dollars donated."
            who="Managers checking program health; nobody needs to edit anything here."
          />
          <AdminPageEntry
            title="Referrers"
            what="Every enrolled customer with their code, ServiceTitan customer link, charity pick, lifetime referral count, total earned, total donated. The ST customer column shows a green pill for referrers we matched to an existing ServiceTitan customer at enrollment &mdash; click the pill to open that customer in ServiceTitan. A dash means no match was found."
            who="CSRs looking up whether a caller is enrolled, which code they have, or whether they're linked to our main customer record."
          />
          <AdminPageEntry
            title="Referrals"
            what="Every friend a referrer has sent us. Shows current stage, the attributed referrer, and a ServiceTitan lead link. The ST lead column is a green pill for referrals where we created a lead in ServiceTitan &mdash; click to jump straight to that lead. A dash means no lead was created (usually because the campaign ID was unset or ServiceTitan was unreachable at submission)."
            who="Anyone troubleshooting a specific referral (&ldquo;my friend Sarah said she booked, where&apos;s my reward?&rdquo;) or confirming the ST lead actually landed."
          />
          <AdminPageEntry
            title="Rewards"
            what="Every gift card that&apos;s been issued, is pending, or failed. Status values: PENDING, APPROVED, ISSUED, DELIVERED, FAILED."
            who="Staff verifying a reward went out; requires can_approve_rewards to approve or deny."
          />
          <AdminPageEntry
            title="Donations"
            what="Every charity donation triggered by a completed referral. Shows the charity, amount, and which referral generated it."
            who="Managers tracking community impact numbers; requires can_approve_donations to approve."
          />
          <AdminPageEntry
            title="Charities"
            what="The list customers pick from during enrollment. Add, edit, deactivate, reorder. Deactivated charities stay in the DB so in-flight referrals still honor them."
            who="Whoever owns the charity partnerships. Requires can_manage_charities."
          />
          <AdminPageEntry
            title="Reward configs"
            what="The tier rulebook &mdash; how much referrers earn per service category (service call, maintenance, replacement, commercial) and how the charity match is calculated. Supports multiple configs for A/B testing. Every save is recorded in the change log."
            who="Leadership making pricing decisions. Requires can_manage_config."
          />
          <AdminPageEntry
            title="Settings"
            what="Runtime configuration that used to require redeploys. Current keys: st_referral_campaign_id (the ServiceTitan campaign referred leads attribute to), triple_win_enabled (global Triple Win on/off toggle). Per-key validators catch bad input before it hits downstream systems."
            who="Admins reconfiguring the program without code changes. Requires can_manage_settings."
          />
          <AdminPageEntry
            title="Help"
            what="This page."
            who="You, right now."
          />
        </div>
      </Section>

      <Section id="permissions" title="5. Permission keys &mdash; who can do what">
        <p>
          Permissions are assigned per-user in the Internal Portal at{" "}
          <a
            href="https://portal.christmasair.com/admin/users"
            target="_blank"
            rel="noreferrer"
          >
            portal.christmasair.com/admin/users
          </a>
          . Owners get every permission automatically.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ background: "var(--bg-card)", borderRadius: "8px" }}>
            <thead style={{ background: "var(--bg-muted)" }}>
              <tr>
                <Th>Permission key</Th>
                <Th>What it unlocks</Th>
              </tr>
            </thead>
            <tbody>
              <PermRow
                name="can_view_admin"
                description="Opens the admin area at all. Gates the whole sidebar."
              />
              <PermRow
                name="can_manage_charities"
                description="Add, edit, deactivate, or reorder the charity list customers pick from."
              />
              <PermRow
                name="can_manage_config"
                description="Edit reward tier amounts, charity match formulas, and A/B test configs."
              />
              <PermRow
                name="can_manage_settings"
                description="Edit runtime settings like the ServiceTitan campaign ID and the global Triple Win toggle. Also gates the Triple Win announcement email button."
              />
              <PermRow
                name="can_approve_rewards"
                description="Approve or deny pending reward payouts on the Rewards page."
              />
              <PermRow
                name="can_approve_donations"
                description="Approve or deny pending charity donations on the Donations page."
              />
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="servicetitan" title="6. ServiceTitan integration &mdash; what talks to what">
        <p>
          Think of ServiceTitan as the company&apos;s main file cabinet. The
          referrals app doesn&apos;t duplicate that data &mdash; it reaches
          across to look things up, create new entries, and listen for updates.
          There are four touchpoints:
        </p>
        <ol className="list-decimal pl-6 space-y-3">
          <li>
            <strong>Customer lookup on enrollment</strong> &mdash; when someone
            signs up, we try to match them to an existing ServiceTitan customer
            by phone first, then by email. Best-effort: if the lookup times out
            or fails, enrollment still succeeds and the link can be added later.
            You can see the result on the Referrers page &mdash; the &ldquo;ST
            customer&rdquo; column shows a green pill with the customer ID when
            the match worked, a dash when it didn&apos;t.
          </li>
          <li>
            <strong>Lead creation</strong> &mdash; when a referred friend
            submits the quote form, we create a ServiceTitan lead tagged with
            the referral campaign ID so reporting attributes it correctly. The
            campaign ID is set in Settings. The Referrals page shows a green
            pill under &ldquo;ST lead&rdquo; when a lead was created
            successfully.
          </li>
          <li>
            <strong>Invoice webhook</strong> &mdash; ServiceTitan calls our
            endpoint at <code>/api/webhooks/servicetitan</code> when invoices
            are updated. We match the invoice to a referral, and if it&apos;s
            paid, we trigger the reward + donation flow.
          </li>
          <li>
            <strong>Customer notes</strong> &mdash; when a lead is created from
            a referral, we can post a note to the ServiceTitan customer file
            tagging the referral source, so techs and CSRs see it in context.
          </li>
        </ol>
        <Callout>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Every ServiceTitan call uses a <strong>10-second timeout</strong>{" "}
              so enrollment or lead creation doesn&apos;t hang if ServiceTitan
              is slow.
            </li>
            <li>
              The campaign ID is editable live from <code>/admin/settings</code>{" "}
              &mdash; no redeploy needed.
            </li>
            <li>
              The webhook endpoint must be registered inside the ServiceTitan
              admin panel, pointing at the production URL. If invoices are being
              paid but rewards aren&apos;t issuing, this is the first thing to
              check.
            </li>
          </ul>
        </Callout>
      </Section>

      <Section
        id="customer-requirement"
        title="7. Do referrers have to be existing customers?"
      >
        <p>
          <strong>No.</strong> Anyone can enroll. The app attempts to link each
          new referrer to an existing ServiceTitan customer record, but if
          there&apos;s no match &mdash; or if ServiceTitan is unreachable &mdash;
          enrollment goes through anyway. The ServiceTitan link can always be
          added or corrected later.
        </p>
        <Callout>
          <strong>Edge case handled:</strong> if two people share a phone
          number (spouses on a joint account, roommates), the second person to
          enroll is saved <em>without</em> a ServiceTitan link rather than being
          rejected. They can be manually re-linked later by updating their
          record in the database.
        </Callout>
        <p>
          <strong>How the customer sees it:</strong> when a referrer whose
          enrollment linked to ServiceTitan visits their dashboard, a small
          &ldquo;Your Christmas Air account is connected&rdquo; pill appears
          under the welcome line. Customers who weren&apos;t linked don&apos;t
          see an awkward negative signal &mdash; the pill just isn&apos;t
          rendered.
        </p>
      </Section>

      <Section id="faq" title="8. Common questions customers will ask">
        <div className="space-y-2">
          <Faq q="A customer says they referred someone but didn't get their reward &mdash; where do I look?">
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                <strong>Referrals page</strong> &mdash; find the friend&apos;s
                referral. Check the current stage. If it&apos;s not COMPLETED
                or PAID, the reward hasn&apos;t triggered yet.
              </li>
              <li>
                <strong>Rewards page</strong> &mdash; if the referral is paid
                but no reward is listed, check for FAILED status with an error
                reason.
              </li>
              <li>
                <strong>ServiceTitan</strong> &mdash; confirm the invoice
                actually posted as paid. The webhook only fires on paid
                invoices.
              </li>
            </ol>
          </Faq>
          <Faq q="How do I change the reward amounts?">
            <p>
              <strong>Reward configs</strong> page. Edit the tier you want and
              save &mdash; every save is recorded in the change log. Requires{" "}
              <code>can_manage_config</code> permission.
            </p>
          </Faq>
          <Faq q="How do I change which ServiceTitan campaign referred leads attribute to?">
            <p>
              <strong>Settings</strong> page &rarr; edit{" "}
              <code>st_referral_campaign_id</code>. The campaign ID comes from
              ServiceTitan &rarr; Marketing &rarr; Campaigns. Takes effect
              immediately on the next referral.
            </p>
          </Faq>
          <Faq q="Can a customer have more than one referral code?">
            <p>
              <strong>No.</strong> One account per email address. If they try
              to enroll a second time with the same email, the system returns
              their existing code.
            </p>
          </Faq>
          <Faq q="What if a customer enrolls twice?">
            <p>
              The system detects the duplicate email and returns their existing
              referral code with an &ldquo;already enrolled&rdquo; message
              &mdash; no duplicate record is created.
            </p>
          </Faq>
          <Faq q="Does the referrer have to be a Christmas Air customer already?">
            <p>
              <strong>No.</strong> Anyone can enroll. See Section 7 for
              details.
            </p>
          </Faq>
          <Faq q="How do I check if a referrer is linked to our ServiceTitan customer records?">
            <p>
              Open the <strong>Referrers</strong> page. The &ldquo;ST
              customer&rdquo; column shows a green pill with the ST customer
              ID when we matched them, or a dash when we didn&apos;t. Click
              the pill to jump straight to the customer record in
              ServiceTitan. If someone should be linked but isn&apos;t, they
              can be manually reconnected by updating their record in the
              database.
            </p>
          </Faq>
          <Faq q="How do I check whether a referral created a lead in ServiceTitan?">
            <p>
              Open the <strong>Referrals</strong> page. The &ldquo;ST
              lead&rdquo; column is a green pill with the lead ID when a lead
              was created, or a dash when it wasn&apos;t. If the column shows
              dashes across the board, check Settings &mdash;{" "}
              <code>st_referral_campaign_id</code> must be set for lead
              creation to run.
            </p>
          </Faq>
          <Faq q="How do I pause Triple Win across the whole program?">
            <p>
              <strong>Settings</strong> page &rarr; flip{" "}
              <code>triple_win_enabled</code> to OFF. In-flight referrals keep
              their submission-time snapshot &mdash; the pause only affects new
              referrals going forward.
            </p>
          </Faq>
          <Faq q="A customer says they can't log into their dashboard &mdash; what do I tell them?">
            <p>
              Send them to{" "}
              <a
                href="https://refer.christmasair.com/sign-in"
                target="_blank"
                rel="noreferrer"
              >
                refer.christmasair.com/sign-in
              </a>
              . They enter their email and we send a fresh magic link. No
              passwords involved.
            </p>
          </Faq>
        </div>
      </Section>

      <Section id="troubleshooting" title="9. Troubleshooting reference">
        <div className="space-y-3">
          <TroubleshootRow
            symptom="Referral stuck in &ldquo;submitted&rdquo; stage"
            cause="Friend submitted the quote form but no job has been booked in ServiceTitan yet. Normal &mdash; not all quotes convert. Check the ServiceTitan lead directly."
          />
          <TroubleshootRow
            symptom="Referral stuck in &ldquo;booked&rdquo; but not progressing"
            cause="Job created in ServiceTitan but invoice not yet paid. Check the job status in ServiceTitan &mdash; the reward can&apos;t issue until payment posts."
          />
          <TroubleshootRow
            symptom="Reward shows &ldquo;FAILED&rdquo;"
            cause="Rewards page will show the failure reason. Most common: Tremendous credentials not configured (admin setup issue) or invalid recipient email. If you can fix the underlying issue, you can re-approve the reward."
          />
          <TroubleshootRow
            symptom="Referrer can't log into dashboard"
            cause="Have them visit /sign-in and request a fresh magic link. Nothing for staff to click &mdash; the system emails them automatically."
          />
          <TroubleshootRow
            symptom="Leads aren't showing up in ServiceTitan after referrals"
            cause="On the Referrals page, check the ST lead column. If it's dashes across the board, Settings: st_referral_campaign_id is probably unset &mdash; by design, leads are skipped silently when no campaign ID is configured."
          />
          <TroubleshootRow
            symptom="A customer says they're an existing Christmas Air customer but the admin shows them as unlinked"
            cause="The ST customer column on the Referrers page didn't find a match by phone or email at enrollment. Common causes: they enrolled with a different phone/email than what's on their ST record, or ServiceTitan was briefly unreachable during enrollment. A dev can manually set service_titan_id on their ref_referrers row to re-link them."
          />
          <TroubleshootRow
            symptom="Paid invoice but no reward issued"
            cause="Webhook likely didn't fire. Confirm the ServiceTitan webhook is still pointing at /api/webhooks/servicetitan on the production URL."
          />
        </div>
      </Section>

      <footer className="pt-8 border-t text-sm opacity-60" style={{ borderColor: "var(--border-subtle)" }}>
        Last updated April 2026. When the program changes materially, update
        this page at <code>app/admin/help/page.tsx</code>.
      </footer>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-3 scroll-mt-8">
      <h2
        className="text-2xl pb-2"
        style={{
          color: "var(--ca-dark-green)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {title}
      </h2>
      <div className="space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="p-4 rounded-lg text-sm"
      style={{
        background: "rgba(97,139,96,0.08)",
        borderLeft: "3px solid var(--ca-green)",
      }}
    >
      {children}
    </div>
  );
}

function AdminPageEntry({
  title,
  what,
  who,
}: {
  title: string;
  what: string;
  who: string;
}) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <p className="font-semibold mb-1" style={{ color: "var(--ca-dark-green)" }}>
        {title}
      </p>
      <p className="text-sm mb-2">{what}</p>
      <p className="text-xs opacity-70">
        <strong>Who uses it:</strong> {who}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left p-3 text-xs font-semibold uppercase tracking-wide"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </th>
  );
}

function PermRow({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <tr style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <td className="p-3 align-top" style={{ width: "30%" }}>
        <code className="text-xs">{name}</code>
      </td>
      <td className="p-3 align-top text-sm">{description}</td>
    </tr>
  );
}

function Faq({
  q,
  children,
}: {
  q: string;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "8px",
      }}
    >
      <summary
        className="p-4 cursor-pointer list-none flex items-center justify-between gap-4"
        style={{ color: "var(--ca-dark-green)" }}
      >
        <span className="font-semibold pr-2">{q}</span>
        <span
          className="text-xl transition-transform group-open:rotate-45"
          style={{
            fontFamily: "var(--font-lobster)",
            color: "var(--ca-green)",
          }}
        >
          +
        </span>
      </summary>
      <div
        className="px-4 pb-4 text-sm leading-relaxed"
        style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem" }}
      >
        {children}
      </div>
    </details>
  );
}

function TroubleshootRow({
  symptom,
  cause,
}: {
  symptom: string;
  cause: string;
}) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <p
        className="font-semibold text-sm mb-1"
        style={{ color: "var(--ca-dark-green)" }}
        dangerouslySetInnerHTML={{ __html: symptom }}
      />
      <p
        className="text-sm opacity-85"
        dangerouslySetInnerHTML={{ __html: cause }}
      />
    </div>
  );
}
