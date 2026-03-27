"use client";

import { useState } from "react";
import { useAgents } from "@/hooks/useAgents";

export default function OutboundPage() {
  const { agents, loading: agentsLoading } = useAgents();
  const [agentId, setAgentId] = useState(process.env.NEXT_PUBLIC_RETELL_AGENT_ID || "");
  const [fromNumber, setFromNumber] = useState(process.env.NEXT_PUBLIC_RETELL_FROM_NUMBER || "");
  const [toNumber, setToNumber] = useState("");
  const [dynamicVars, setDynamicVars] = useState("");
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "success" | "error">("idle");
  const [callResult, setCallResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function makeCall() {
    setError(null);
    setCallResult(null);

    if (!agentId.trim()) {
      setError("Agent ID is required.");
      return;
    }
    if (!fromNumber.trim()) {
      setError("From number is required (must be a Retell-purchased number).");
      return;
    }
    if (!toNumber.trim()) {
      setError("To number is required.");
      return;
    }

    // Validate E.164 format
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(fromNumber.trim())) {
      setError("From number must be E.164 format (e.g., +12135551234).");
      return;
    }
    if (!e164Regex.test(toNumber.trim())) {
      setError("To number must be E.164 format (e.g., +12135551234).");
      return;
    }

    let parsedVars: Record<string, string> | undefined;
    if (dynamicVars.trim()) {
      try {
        parsedVars = JSON.parse(dynamicVars);
      } catch {
        setError("Dynamic variables must be valid JSON.");
        return;
      }
    }

    setCallStatus("calling");

    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId.trim(),
          from_number: fromNumber.trim(),
          to_number: toNumber.trim(),
          retell_llm_dynamic_variables: parsedVars,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create call");
      }

      const data = await res.json();
      setCallResult(data);
      setCallStatus("success");
    } catch (err: any) {
      setError(err.message);
      setCallStatus("error");
    }
  }

  function reset() {
    setCallStatus("idle");
    setCallResult(null);
    setError(null);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
          Outbound Call
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Place an outbound phone call using your Retell AI agent.
        </p>
      </div>

      <div className="card">
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Agent
            </label>
            <select
              className="input"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              disabled={callStatus === "calling" || agentsLoading}
            >
              {agentsLoading ? (
                <option>Loading agents...</option>
              ) : agents.length === 0 ? (
                <option value="">No agents found</option>
              ) : (
                <>
                  <option value="">Select an agent</option>
                  {agents.map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.agent_name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
                From Number
              </label>
              <input
                type="text"
                className="input"
                placeholder="+12135551234"
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                disabled={callStatus === "calling"}
              />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Must be a Retell-purchased number
              </p>
            </div>

            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
                To Number
              </label>
              <input
                type="text"
                className="input"
                placeholder="+12135559876"
                value={toNumber}
                onChange={(e) => setToNumber(e.target.value)}
                disabled={callStatus === "calling"}
              />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Customer phone number
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Dynamic Variables (optional)
            </label>
            <textarea
              className="input"
              style={{ minHeight: "100px", resize: "vertical" }}
              placeholder={`{
  "customer_name": "John Smith",
  "amount_owed": "$1,250.00",
  "invoice_number": "INV-2026-001",
  "days_overdue": "45"
}`}
              value={dynamicVars}
              onChange={(e) => setDynamicVars(e.target.value)}
              disabled={callStatus === "calling"}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
              <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>
            </div>
          )}

          {callResult && (
            <div className="p-4 rounded-lg" style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
              <p className="text-sm font-medium mb-2" style={{ color: "#4ade80" }}>
                Call initiated successfully
              </p>
              <div className="space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                <p>Call ID: <span style={{ color: "var(--text-primary)" }}>{callResult.call_id}</span></p>
                <p>Status: <span style={{ color: "var(--text-primary)" }}>{callResult.call_status}</span></p>
                <p>To: <span style={{ color: "var(--text-primary)" }}>{callResult.to_number}</span></p>
              </div>
              <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                The AI agent is now handling the call. Check Call History for results.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {callStatus === "idle" || callStatus === "error" ? (
              <button onClick={makeCall} className="btn btn-primary flex-1">
                Place Call
              </button>
            ) : callStatus === "calling" ? (
              <button className="btn btn-secondary flex-1" disabled>
                Calling...
              </button>
            ) : (
              <button onClick={reset} className="btn btn-secondary flex-1">
                Make Another Call
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="card mt-6">
        <h3 className="font-semibold mb-3" style={{ color: "var(--christmas-cream)" }}>Tips</h3>
        <ul className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <li>Phone numbers must be in E.164 format: +1 followed by 10 digits</li>
          <li>The &quot;From&quot; number must be purchased through your Retell dashboard</li>
          <li>Dynamic variables get injected into your agent&apos;s prompt template</li>
          <li>Call results and transcripts will appear in Call History after the call ends</li>
        </ul>
      </div>
    </div>
  );
}
