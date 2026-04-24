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
            receives a gift card as a thank-you, their pick of brand at
            redemption (Amazon, Target, Visa, and more via Tremendous).
          </li>
          <li>
            <strong>The referrer</strong> gets a gift card of their choice too,
            or can route it all to their charity instead.
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
            what="Every enrolled customer with their code, ServiceTitan customer link, charity pick, lifetime referral count, total earned, total donated. The ST customer column is editable &mdash; click &ldquo;link&rdquo; next to a referrer, paste the numeric ID from the ST URL, preview the customer name that resolves, save. Click &ldquo;edit&rdquo; on an existing linkage to change or clear it."
            who="CSRs looking up whether a caller is enrolled, and linking referrers to their ServiceTitan customer record."
          />
          <AdminPageEntry
            title="Referrals"
            what="Every friend a referrer has sent us. Shows current stage, the attributed referrer, and a link to the corresponding ServiceTitan record (booking pill or lead pill). Row-level actions: (a) &ldquo;tag in ST&rdquo; writes the referrer's code to the ST customer's Referral_Code custom field for reliable future webhook matches; (b) &ldquo;simulate paid&rdquo; (sandbox only) fakes an invoice-paid event against the referral so you can test the reward pipeline end-to-end without waiting on a real ST job/invoice cycle."
            who="Anyone troubleshooting a specific referral, confirming the ST record landed, tagging the ST customer, or rehearsing the reward flow in sandbox."
          />
          <AdminPageEntry
            title="Rewards"
            what="Every gift card that's been issued, is pending, or failed. Status values: PENDING, APPROVED, ISSUED, DELIVERED, FAILED. Includes a Tremendous column — green pill with the order ID when an order exists (click to open it in Tremendous), &ldquo;waiting on Tremendous&rdquo; subtext if we're blocked on their order-approval gate."
            who="Staff verifying a reward went out; requires can_approve_rewards to approve or deny."
          />
          <AdminPageEntry
            title="Donations"
            what="Every charity donation triggered by a completed referral, plus a Payout Queue at the top showing how much Christmas Air owes each charity across all approved-but-unpaid donations. Pick a charity, click &ldquo;Mark N paid&rdquo;, enter the check number and date, and the whole batch flips to CONFIRMED. Charity donations fulfill manually today (no Tremendous routing) because we're supporting local neighborhood charities that aren't on Tremendous's catalog."
            who="Managers tracking community impact; finance using the Payout Queue to batch quarterly check-writing. Requires can_approve_donations."
          />
          <AdminPageEntry
            title="Charities"
            what="The list customers pick from during enrollment. Add, edit, deactivate, reorder. Deactivated charities stay in the DB so in-flight referrals still honor them."
            who="Whoever owns the charity partnerships. Requires can_manage_charities."
          />
          <AdminPageEntry
            title="Rewards program"
            what="Single-page editor for the flat Triple Win amounts (referrer / friend / charity) and an optional campaign banner label that drives promo banners on the conversion pages. Every save is recorded in the change log. $0 hard-blocked on all three amounts."
            who="Leadership making pricing decisions. Requires can_manage_config."
          />
          <AdminPageEntry
            title="Settings"
            what="Runtime configuration that used to require redeploys. Current keys: st_referral_campaign_id (campaign referred leads attribute to), st_referral_booking_provider_id (the provider ID we submit bookings through — takes precedence over campaign when set), st_customer_referral_code_field_id (numeric type ID of the Referral_Code custom field on ST customers; enables the Tag in ST button on the Referrals page). Per-key validators catch bad input before it hits downstream systems."
            who="Admins reconfiguring the program without code changes. Requires can_manage_settings."
          />
          <AdminPageEntry
            title="Tremendous"
            what="Test harness for the Tremendous gift-card integration. Shows which env vars are set, pings Tremendous to verify credentials, and lets you send a sandbox/prod test reward end-to-end to confirm the full pipeline works before a real customer reward hits it. Cap of $100 per test order for safety."
            who="Admins verifying the integration after env-var changes, or troubleshooting why a reward failed. Requires can_manage_settings."
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
            <strong>Customer linkage (manual)</strong> &mdash; there is no
            auto-match at enrollment. ST&apos;s customer-search API silently
            false-matches (ignores the email filter, returns partial phone
            matches), so we leave the linkage blank and let admins set it
            explicitly. On the Referrers page, click &ldquo;link&rdquo; next
            to a referrer, paste the numeric customer ID from the ST URL,
            verify the name preview, save. One click to fix; no false positives.
          </li>
          <li>
            <strong>Booking or lead creation</strong> &mdash; when a referred
            friend submits the quote form, we push them into ServiceTitan
            using whichever path Settings has configured:
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                If <code>st_referral_booking_provider_id</code> is set, we
                create a <strong>booking</strong>. Lands in Follow Up &rarr;
                Bookings. Dispatch confirms details and converts to a
                scheduled appointment. Preferred path &mdash; warm referrals
                convert better from a Bookings queue than from a Leads queue.
              </li>
              <li>
                If only <code>st_referral_campaign_id</code> is set, we create
                a <strong>lead</strong> attributed to that campaign. Lands in
                Follow Up &rarr; Leads. Dispatch calls back to qualify.
              </li>
              <li>
                If neither is set, the referral stays in our DB but does not
                flow to ServiceTitan.
              </li>
            </ul>
            The Referrals admin page shows a green pill (booking or lead)
            with a link straight to that record in ST.
          </li>
          <li>
            <strong>Invoice webhook</strong> &mdash; ServiceTitan calls our
            endpoint at <code>/api/webhooks/servicetitan</code> on invoice
            events. See <a href="#invoice-flow"><strong>Section 7: How
            referrals become rewards</strong></a> below for the full match
            + reward math.
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
        id="invoice-flow"
        title="7. How referrals become rewards (invoice flow)"
      >
        <p>
          This is the end-of-the-loop. A referred friend&apos;s invoice gets
          paid in ServiceTitan &rarr; we receive a webhook &rarr; we figure
          out which of our referrals it belongs to &rarr; we calculate the
          reward + charity donation and issue them.
        </p>
        <Callout>
          <strong>Key fact:</strong> ServiceTitan&apos;s invoice webhook gives
          us a customer ID &mdash; not a phone number, not an email. We have
          to trace back from the customer ID to &ldquo;which referral was
          this person?&rdquo;. That trace is where most of the subtlety lives.
        </Callout>

        <h3 className="text-lg font-semibold mt-4 pt-2" style={{ color: "var(--ca-dark-green)" }}>
          How we match the invoice to a referral (three paths, in order)
        </h3>
        <ol className="list-decimal pl-6 space-y-3">
          <li>
            <strong>Direct match on the stored ST customer ID.</strong> If
            the referral row already has <code>service_titan_customer_id</code>{" "}
            set (from a previous webhook or admin linking), we hit it on
            the first query and stop. Fastest and most reliable.
          </li>
          <li>
            <strong>ST customer&apos;s <code>Referral_Code</code> custom
            field.</strong> We fetch the ST customer record, look for a
            custom field named <code>Referral_Code</code> (or{" "}
            <code>Referral Code</code>). If set, we find that referrer and
            their most recent in-flight referral. Then we backfill
            <code>service_titan_customer_id</code> so future webhooks win
            on path 1.
            <br />
            <span className="text-sm opacity-80">
              Requires one-time setup in ServiceTitan: ST admin creates a
              text custom field called <code>Referral_Code</code> on the
              Customer entity. After that, any CSR who writes the referral
              code into that field (e.g. during booking) gives us a durable,
              typo-resistant match.
            </span>
          </li>
          <li>
            <strong>Phone fallback.</strong> If the first two paths miss,
            we pull the ST customer&apos;s phone, normalize to 10 digits,
            and scan the 50 most recent in-flight referrals for a
            normalized match on <code>referred_phone</code>. This is the
            rescue path &mdash; it works but has edge cases (spouse uses a
            different number to book, typo at form submission, shared
            household phone).
          </li>
        </ol>

        <h3 className="text-lg font-semibold mt-4 pt-2" style={{ color: "var(--ca-dark-green)" }}>
          Where the invoice amount comes from
        </h3>
        <p>
          <strong>Not from the webhook payload.</strong> We call{" "}
          <code>GET /invoices/{"{id}"}</code> against ServiceTitan to get the
          authoritative total. The webhook&apos;s{" "}
          <code>data.total</code> is only used as a fallback if the API call
          fails. This protects against partial / stale webhook payloads.
        </p>

        <h3 className="text-lg font-semibold mt-4 pt-2" style={{ color: "var(--ca-dark-green)" }}>
          How the reward is calculated
        </h3>
        <ol className="list-decimal pl-6 space-y-1">
          <li>
            Re-classify the service category from the actual job + invoice
            (not from what the friend chose on the form). So a &ldquo;Not
            sure yet&rdquo; click-through that turns into a $12K install
            correctly grades as Replacement, not Service Call.
          </li>
          <li>
            Look up the tier for that category in the referrer&apos;s
            assigned reward config.
          </li>
          <li>
            Run <code>calculateReward(invoiceTotal, tier)</code> — flat,
            tiered, or percentage formula per the tier&apos;s config.
          </li>
          <li>
            If Triple Win was activated at submission AND the referrer has
            a charity picked, also run{" "}
            <code>calculateCharityMatch(rewardAmount, tier)</code>.
          </li>
          <li>
            Insert <code>ref_rewards</code> (auto-approved for most tiers,
            PENDING if the tier requires admin approval &mdash;
            <code>requires_admin_approval</code> flag) and optionally{" "}
            <code>ref_charity_donations</code>.
          </li>
          <li>
            If auto-approved, kick off Tremendous fulfillment (or charity
            payout, which is manual today).
          </li>
        </ol>

        <h3 className="text-lg font-semibold mt-4 pt-2" style={{ color: "var(--ca-dark-green)" }}>
          Most common failure mode
        </h3>
        <Callout>
          The friend books under a different phone than they typed on the
          referral form (spouse&apos;s cell, work number, etc.). Path 3
          (phone fallback) misses. Path 2 only works if someone wrote the
          referral code into the ST customer&apos;s{" "}
          <code>Referral_Code</code> custom field. No one did &rarr; the
          webhook can&apos;t find a match &rarr; reward never fires. The
          referral stays stuck at SUBMITTED / BOOKED.
          <br />
          <br />
          <strong>The durable fix:</strong> ST admin creates the{" "}
          <code>Referral_Code</code> custom field on customers and CSRs
          learn to set it on booked referrals. One extra click per booking
          removes this entire category of failure.
        </Callout>
      </Section>

      <Section
        id="customer-requirement"
        title="8. Do referrers have to be existing customers?"
      >
        <p>
          <strong>No.</strong> Anyone can enroll. The app does not try to
          auto-link each new referrer to an existing ServiceTitan customer
          record &mdash; ST&apos;s customer search API is unreliable
          (silently false-matches) so we leave referrers unlinked at
          enrollment. Admins set the ST customer link manually via the inline
          edit on the Referrers page.
        </p>
        <p>
          <strong>How the customer sees it:</strong> when a referrer whose
          row has <code>service_titan_id</code> set visits their dashboard,
          a small &ldquo;Your Christmas Air account is connected&rdquo; pill
          appears under the welcome line. Customers without a linkage
          don&apos;t see an awkward negative signal &mdash; the pill just
          isn&apos;t rendered.
        </p>
      </Section>

      <Section id="faq" title="9. Common questions customers will ask">
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
              <strong>Rewards program</strong> page. Set the referrer / friend /
              charity dollar amounts and save &mdash; every save is recorded in
              the change log. Optionally add a campaign label to show a promo
              banner on the conversion pages. Requires{" "}
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
          <Faq q="How do I link a referrer to their ServiceTitan customer record?">
            <p>
              Open the <strong>Referrers</strong> page. Next to each
              referrer, click <strong>link</strong> (or <strong>edit</strong>{" "}
              if there&apos;s already a linkage). Paste the numeric customer
              ID from the ServiceTitan URL &mdash; the part after{" "}
              <code>/#/customer/</code> &mdash; and the admin page will
              look up the customer name so you can verify it&apos;s the right
              person before saving. Leave the field blank and save to unlink.
              Click the green pill any time to open that customer in
              ServiceTitan.
            </p>
          </Faq>
          <Faq q="How does a referral actually become a reward?">
            <p>
              Short version: when the friend&apos;s invoice is paid in
              ServiceTitan, ST sends us a webhook with the customer ID. We
              trace that customer back to one of our referrals (three ways
              &mdash; by stored ST customer ID, by the{" "}
              <code>Referral_Code</code> custom field on the ST customer, or
              by phone number as a fallback), re-derive the actual service
              category from the invoice, calculate the reward from the
              tier table, and issue it via Tremendous (gift cards) or queue
              it for manual payout (charity donations). See{" "}
              <a href="#invoice-flow">
                <strong>Section 7</strong>
              </a>{" "}
              for the full flow and the most common failure modes.
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
              You can&apos;t pause the whole program &mdash; Triple Win is the brand.
              What you <em>can</em> do is adjust the charity amount on the{" "}
              <strong>Rewards program</strong> page to flex campaigns up or down.
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

      <Section id="troubleshooting" title="10. Troubleshooting reference">
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
            symptom="Nothing is showing up in ServiceTitan after referrals"
            cause="On the Referrals page, check the ServiceTitan column. Dashes everywhere means neither Settings key is set. To send referrals as bookings, populate st_referral_booking_provider_id (register a booking provider in ST first). To send them as leads, populate st_referral_campaign_id. If both are blank, ST is skipped silently by design."
          />
          <TroubleshootRow
            symptom="Referrals are still creating leads after setting the booking provider"
            cause="The setting is read per-request, no caching. If leads are still being created, re-check st_referral_booking_provider_id on /admin/settings &mdash; confirm it saved to a numeric value (not blank). Old referrals submitted before the setting was populated will still show as leads; that's expected."
          />
          <TroubleshootRow
            symptom="A customer says they're an existing Christmas Air customer but the admin shows them as unlinked"
            cause="All referrers enroll unlinked by default — ST's search API is unreliable for matching, so we don't auto-link. Find them in ServiceTitan, copy the numeric ID from the URL, paste into the inline edit on the Referrers page, and save. The name preview confirms you grabbed the right person."
          />
          <TroubleshootRow
            symptom="Paid invoice but no reward issued"
            cause="Either the webhook didn't fire (confirm ST webhook endpoint is pointing at /api/webhooks/servicetitan) OR the webhook couldn't match the invoice back to a referral. See Section 7 for the match order. Most common cause: the friend booked under a different phone than they typed on the referral form, and no one set the Referral_Code custom field on the ST customer. Fix: on the Referrals page, manually set service_titan_customer_id on that referral to the ST customer's ID, then re-trigger the webhook (or wait for the next invoice event — ST retries)."
          />
          <TroubleshootRow
            symptom="Referral paid but wrong reward amount"
            cause="Actual service category differed from what the friend chose on the form. Check the referral's service_category field — it's re-derived from ST's job + invoice at reward time. If the re-classification looks wrong, the fix is in classify-actual.ts (or admin can override the reward amount directly on /admin/rewards before approving)."
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
