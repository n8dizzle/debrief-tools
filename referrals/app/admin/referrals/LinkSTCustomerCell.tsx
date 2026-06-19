"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { stCustomerUrl } from "@/lib/servicetitan-links";

interface STCustomerResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Props {
  referralId: string;
  friendName: string;
  friendPhone: string | null | undefined;
  friendEmail: string | null | undefined;
  stCustomerId: string | null | undefined;
}

/**
 * Friend-column cell that doubles as an ST customer link widget.
 *
 * - If an ST customer is already linked: shows name + phone as plain text,
 *   with a small "relink" affordance on hover.
 * - If not linked: the name appears as a clickable underlined link. Clicking
 *   opens an inline search panel to find and link the matching ST customer.
 *
 * Once a customer is linked here, the "pull from ST & mark complete" button
 * in the ServiceTitan column becomes active.
 */
export default function LinkSTCustomerCell({
  referralId,
  friendName,
  friendPhone,
  friendEmail,
  stCustomerId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<STCustomerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkedId, setLinkedId] = useState<string | null>(stCustomerId ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus the search input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      // Pre-fill with friend's name for a head start
      setQuery(friendName);
    }
  }, [open, friendName]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (query.length < 2) { setResults([]); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/admin/servicetitan/customers?q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  async function linkCustomer(customer: STCustomerResult) {
    setLinking(true);
    setLinkError(null);
    try {
      const res = await fetch(
        `/api/admin/referrals/${referralId}/link-st-customer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stCustomerId: customer.id }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setLinkError(data.error || "Failed to link customer");
        return;
      }
      setLinkedId(customer.id);
      setOpen(false);
      router.refresh();
    } catch {
      setLinkError("Network error — please try again");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* Friend name — clickable if no ST customer linked */}
      {linkedId ? (
        <span className="font-medium">{friendName}</span>
      ) : (
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setLinkError(null); }}
          className="text-left font-medium underline decoration-dotted underline-offset-2 hover:no-underline"
          style={{ color: "inherit" }}
          title="Click to search and link a ServiceTitan customer account"
        >
          {friendName}
        </button>
      )}

      {/* Phone */}
      {friendPhone && (
        <div className="text-xs opacity-60">{friendPhone}</div>
      )}

      {/* Linked badge: open the ST customer page + relink option */}
      {linkedId && (
        <span className="flex items-center gap-2 self-start text-[10px]">
          <a
            href={stCustomerUrl(linkedId) ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-60 hover:opacity-100 underline inline-flex items-center gap-0.5"
            style={{ color: "inherit" }}
            title={`Open ST customer #${linkedId} in ServiceTitan`}
          >
            ST #{linkedId}
            <span aria-hidden="true" style={{ opacity: 0.7 }}>↗</span>
          </a>
          <button
            type="button"
            onClick={() => { setOpen((o) => !o); setLinkError(null); }}
            className="opacity-40 hover:opacity-70 underline"
            style={{ color: "inherit" }}
            title="Relink to a different ST customer"
          >
            relink
          </button>
        </span>
      )}

      {/* Inline search panel */}
      {open && (
        <div
          className="flex flex-col gap-1.5 p-2 rounded-lg mt-1"
          style={{
            background: "var(--ca-cream, #f5f3eb)",
            border: "1px solid rgba(0,0,0,0.12)",
            minWidth: 240,
            maxWidth: 300,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 10,
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
            Link ST Customer
          </p>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, phone, or email…"
            className="input text-xs"
            style={{ padding: "4px 8px", fontSize: "0.72rem" }}
          />

          {/* Results */}
          <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {searching && (
              <p className="text-[10px] opacity-50 px-1">Searching…</p>
            )}
            {!searching && query.length >= 2 && results.length === 0 && (
              <p className="text-[10px] opacity-50 px-1">No results</p>
            )}
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => linkCustomer(c)}
                disabled={linking}
                className="flex flex-col gap-0 text-left px-2 py-1.5 rounded hover:bg-black/5 disabled:opacity-50"
              >
                <span className="text-xs font-semibold">{c.name}</span>
                <span className="text-[10px] opacity-60">
                  {[c.phone, c.email].filter(Boolean).join(" · ")}
                  {" · "}
                  <span className="opacity-50">#{c.id}</span>
                </span>
              </button>
            ))}
          </div>

          {linkError && (
            <p className="text-[10px]" style={{ color: "var(--ca-red)" }}>
              {linkError}
            </p>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[10px] opacity-50 hover:opacity-80 underline self-start"
          >
            cancel
          </button>
        </div>
      )}
    </div>
  );
}
