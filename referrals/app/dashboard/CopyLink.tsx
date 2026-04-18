"use client";

import { useState } from "react";

export default function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <code
        className="flex-1 p-3 rounded-lg text-sm break-all"
        style={{ background: "var(--ca-cream)" }}
      >
        {link}
      </code>
      <button className="btn btn-primary whitespace-nowrap" onClick={copy}>
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
