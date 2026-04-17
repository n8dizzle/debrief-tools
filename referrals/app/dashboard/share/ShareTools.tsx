"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { trackEvent } from "@/lib/analytics";

interface Props {
  referralLink: string;
  referrerFirstName: string;
}

export default function ShareTools({ referralLink, referrerFirstName }: Props) {
  const [copied, setCopied] = useState(false);

  const smsBody = `Hey! I've been using Christmas Air for our HVAC and plumbing — they're great. Use my link and you'll get $50 off your first service: ${referralLink}`;
  const emailSubject = "A heads-up about Christmas Air";
  const emailBody = `Hey,

I wanted to share a heads-up about Christmas Air — the HVAC and plumbing folks we've been using. They're veteran-owned, locally-owned, and have always been straight with us.

If you ever need service, this link gets you $50 off your first call:
${referralLink}

— ${referrerFirstName}`;

  const smsHref = `sms:?&body=${encodeURIComponent(smsBody)}`;
  const mailtoHref = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  function copyLink() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    trackEvent("referral_link_copied", { source: "share-tab" });
  }

  function nativeShare() {
    trackEvent("referral_link_shared", { method: "native-share" });
    if (typeof navigator !== "undefined" && "share" in navigator) {
      navigator
        .share({
          title: "Christmas Air",
          text: `Use my link for $50 off your first service:`,
          url: referralLink,
        })
        .catch(() => {});
    } else {
      copyLink();
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl mb-3">Your link</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <code
            className="flex-1 p-3 rounded-lg text-sm break-all"
            style={{ background: "var(--ca-cream)" }}
          >
            {referralLink}
          </code>
          <button
            className="btn btn-primary whitespace-nowrap"
            onClick={copyLink}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <button
          onClick={nativeShare}
          className="mt-3 text-sm font-semibold"
          style={{ color: "var(--ca-green)" }}
        >
          Share via your phone&apos;s share menu →
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <ShareCard
          title="Text a neighbor"
          desc="Opens your messaging app with a pre-written note. Edit before sending."
          actionLabel="Open Messages"
          actionHref={smsHref}
        >
          <pre
            className="text-xs opacity-80 p-3 rounded mt-3 whitespace-pre-wrap font-sans"
            style={{ background: "var(--bg-muted)" }}
          >
            {smsBody}
          </pre>
        </ShareCard>

        <ShareCard
          title="Send an email"
          desc="A longer version for friends, family, group chats, or coworkers."
          actionLabel="Open Email"
          actionHref={mailtoHref}
        >
          <pre
            className="text-xs opacity-80 p-3 rounded mt-3 whitespace-pre-wrap font-sans max-h-32 overflow-y-auto"
            style={{ background: "var(--bg-muted)" }}
          >
            {emailBody}
          </pre>
        </ShareCard>
      </div>

      <div className="card">
        <h2 className="text-2xl mb-2">QR code</h2>
        <p className="opacity-70 text-sm mb-4">
          Print this on a card, stick it on the fridge, or hold it up at a
          neighborhood meetup. Anyone who scans it lands on your link.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div
            className="p-4 rounded-lg"
            style={{ background: "var(--ca-cream)" }}
          >
            <QRCodeSVG
              value={referralLink}
              size={200}
              fgColor="#415440"
              bgColor="#F5F2DC"
              level="M"
            />
          </div>
          <div className="text-sm opacity-80">
            <p>
              Want a printable version? Right-click (or long-press on mobile)
              the QR code and save it as an image.
            </p>
            <p className="mt-3 opacity-60 text-xs">
              The code points directly to your unique link, so nothing&apos;s
              hardcoded — even if you change your name later.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareCard({
  title,
  desc,
  actionLabel,
  actionHref,
  children,
}: {
  title: string;
  desc: string;
  actionLabel: string;
  actionHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col">
      <h3 className="text-xl mb-1">{title}</h3>
      <p className="opacity-70 text-sm mb-3">{desc}</p>
      {children}
      <a href={actionHref} className="btn btn-primary mt-4 self-start">
        {actionLabel}
      </a>
    </div>
  );
}
