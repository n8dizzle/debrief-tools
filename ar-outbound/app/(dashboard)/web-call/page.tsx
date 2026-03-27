"use client";

import { useState, useEffect, useRef } from "react";
import { useAgents } from "@/hooks/useAgents";

export default function WebCallPage() {
  const { agents, loading: agentsLoading } = useAgents();
  const [agentId, setAgentId] = useState(process.env.NEXT_PUBLIC_RETELL_AGENT_ID || "");
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "active" | "ended">("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; content: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [dynamicVars, setDynamicVars] = useState("");
  const retellClientRef = useRef<any>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  async function startWebCall() {
    setError(null);
    setTranscript([]);

    if (!agentId.trim()) {
      setError("Please enter an Agent ID from your Retell dashboard.");
      return;
    }

    setCallStatus("connecting");

    try {
      // Parse dynamic variables if provided
      let parsedVars: Record<string, string> | undefined;
      if (dynamicVars.trim()) {
        try {
          parsedVars = JSON.parse(dynamicVars);
        } catch {
          setError("Dynamic variables must be valid JSON (e.g., {\"customer_name\": \"John\"})");
          setCallStatus("idle");
          return;
        }
      }

      // Create web call via our API
      const res = await fetch("/api/calls/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId.trim(),
          retell_llm_dynamic_variables: parsedVars,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create web call");
      }

      const data = await res.json();
      setCallId(data.call_id);

      // Load Retell Web Client SDK dynamically
      const { RetellWebClient } = await import("retell-client-js-sdk");
      const retellClient = new RetellWebClient();
      retellClientRef.current = retellClient;

      retellClient.on("call_started", () => {
        setCallStatus("active");
      });

      retellClient.on("call_ended", () => {
        setCallStatus("ended");
      });

      retellClient.on("error", (err: any) => {
        console.error("Retell error:", err);
        setError(`Call error: ${err.message || "Unknown error"}`);
        setCallStatus("ended");
      });

      retellClient.on("update", (update: any) => {
        if (update.transcript) {
          setTranscript(update.transcript);
        }
      });

      await retellClient.startCall({
        accessToken: data.access_token,
      });
    } catch (err: any) {
      console.error("Start call error:", err);
      setError(err.message || "Failed to start call");
      setCallStatus("idle");
    }
  }

  function endCall() {
    if (retellClientRef.current) {
      retellClientRef.current.stopCall();
    }
    setCallStatus("ended");
  }

  function resetCall() {
    setCallStatus("idle");
    setCallId(null);
    setTranscript([]);
    setError(null);
    retellClientRef.current = null;
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
          Web Call Test
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          Test your Retell AI agent directly in the browser using your microphone.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Controls */}
        <div className="card">
          <h2 className="font-semibold mb-4" style={{ color: "var(--christmas-cream)" }}>
            Call Setup
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Agent
              </label>
              <select
                className="input"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                disabled={callStatus !== "idle" || agentsLoading}
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

            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Dynamic Variables (optional)
              </label>
              <textarea
                className="input"
                style={{ minHeight: "80px", resize: "vertical" }}
                placeholder='{"customer_name": "John Smith", "amount_owed": "$1,250.00"}'
                value={dynamicVars}
                onChange={(e) => setDynamicVars(e.target.value)}
                disabled={callStatus !== "idle"}
              />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                JSON key-value pairs injected into the agent prompt
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {callStatus === "idle" && (
                <button onClick={startWebCall} className="btn btn-primary flex-1">
                  Start Web Call
                </button>
              )}

              {(callStatus === "connecting" || callStatus === "active") && (
                <button onClick={endCall} className="btn btn-danger flex-1">
                  {callStatus === "connecting" ? "Cancel" : "End Call"}
                </button>
              )}

              {callStatus === "ended" && (
                <button onClick={resetCall} className="btn btn-secondary flex-1">
                  New Call
                </button>
              )}
            </div>
          </div>

          {/* Call Status Indicator */}
          {callStatus !== "idle" && (
            <div className="mt-6 flex items-center gap-3 p-4 rounded-lg" style={{ background: "var(--bg-primary)" }}>
              {callStatus === "connecting" && (
                <>
                  <div className="w-3 h-3 rounded-full" style={{ background: "var(--status-warning)" }}>
                    <div className="w-3 h-3 rounded-full pulse-ring" style={{ background: "var(--status-warning)" }} />
                  </div>
                  <span className="text-sm" style={{ color: "var(--status-warning)" }}>Connecting...</span>
                </>
              )}
              {callStatus === "active" && (
                <>
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full" style={{ background: "var(--status-success)" }} />
                    <div className="absolute inset-0 w-3 h-3 rounded-full pulse-ring" style={{ background: "var(--status-success)" }} />
                  </div>
                  <span className="text-sm" style={{ color: "var(--status-success)" }}>Call Active</span>
                </>
              )}
              {callStatus === "ended" && (
                <>
                  <div className="w-3 h-3 rounded-full" style={{ background: "var(--text-muted)" }} />
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Call Ended</span>
                </>
              )}
              {callId && (
                <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
                  {callId}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Live Transcript */}
        <div className="card flex flex-col" style={{ minHeight: "400px" }}>
          <h2 className="font-semibold mb-4" style={{ color: "var(--christmas-cream)" }}>
            Live Transcript
          </h2>

          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto space-y-3 p-3 rounded-lg"
            style={{ background: "var(--bg-primary)", maxHeight: "500px" }}
          >
            {transcript.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                {callStatus === "idle"
                  ? "Transcript will appear here during the call"
                  : callStatus === "connecting"
                  ? "Waiting for connection..."
                  : "No transcript available"}
              </p>
            ) : (
              transcript.map((turn, i) => (
                <div
                  key={i}
                  className={`flex ${turn.role === "agent" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className="max-w-[85%] px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: turn.role === "agent"
                        ? "rgba(93, 138, 102, 0.15)"
                        : "rgba(184, 149, 107, 0.15)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <p className="text-xs font-medium mb-0.5" style={{
                      color: turn.role === "agent" ? "var(--christmas-green-light)" : "var(--christmas-gold)"
                    }}>
                      {turn.role === "agent" ? "AI Agent" : "You"}
                    </p>
                    {turn.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
