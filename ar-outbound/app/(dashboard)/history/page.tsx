"use client";

import { useState, useEffect } from "react";

interface CallLog {
  id: string;
  call_id: string;
  call_type: "web_call" | "phone_call";
  direction: string;
  from_number: string | null;
  to_number: string | null;
  status: string;
  duration_ms: number | null;
  transcript: string | null;
  call_analysis: any | null;
  recording_url: string | null;
  created_at: string;
  ended_at: string | null;
}

export default function HistoryPage() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);

  useEffect(() => {
    fetchCalls();
  }, []);

  async function fetchCalls() {
    try {
      const res = await fetch("/api/calls?limit=50");
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls || []);
      }
    } catch (err) {
      console.error("Failed to fetch calls:", err);
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(ms: number | null) {
    if (!ms) return "--";
    const seconds = Math.round(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
          Call History
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          View past calls, transcripts, and analysis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call List */}
        <div className="lg:col-span-2 card" style={{ padding: 0 }}>
          {loading ? (
            <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>Loading...</p>
          ) : calls.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>No calls yet.</p>
          ) : (
            <div>
              {calls.map((call) => (
                <button
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  className="w-full flex items-center justify-between p-4 text-left transition-colors"
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                    background: selectedCall?.id === call.id ? "var(--bg-card-hover)" : "transparent",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`badge ${call.status === "ended" ? "badge-ended" : call.status === "error" ? "badge-error" : "badge-active"}`}>
                      {call.call_type === "web_call" ? "Web" : "Phone"}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {call.to_number || "Web Call"}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatTime(call.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {formatDuration(call.duration_ms)}
                    </p>
                    <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                      {call.status}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Call Detail */}
        <div className="card">
          {selectedCall ? (
            <div>
              <h3 className="font-semibold mb-4" style={{ color: "var(--christmas-cream)" }}>
                Call Details
              </h3>

              <div className="space-y-3 text-sm">
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Call ID</p>
                  <p className="font-mono text-xs break-all" style={{ color: "var(--text-primary)" }}>
                    {selectedCall.call_id}
                  </p>
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Type</p>
                  <p style={{ color: "var(--text-primary)" }}>
                    {selectedCall.call_type === "web_call" ? "Web Call" : "Phone Call"}
                  </p>
                </div>
                {selectedCall.to_number && (
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>To</p>
                    <p style={{ color: "var(--text-primary)" }}>{selectedCall.to_number}</p>
                  </div>
                )}
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Status</p>
                  <p className="capitalize" style={{ color: "var(--text-primary)" }}>{selectedCall.status}</p>
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Duration</p>
                  <p style={{ color: "var(--text-primary)" }}>{formatDuration(selectedCall.duration_ms)}</p>
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>Started</p>
                  <p style={{ color: "var(--text-primary)" }}>{formatTime(selectedCall.created_at)}</p>
                </div>
              </div>

              {selectedCall.recording_url && (
                <div className="mt-4">
                  <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>Recording</p>
                  <audio controls className="w-full" src={selectedCall.recording_url} />
                </div>
              )}

              {selectedCall.transcript && (
                <div className="mt-4">
                  <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>Transcript</p>
                  <div
                    className="p-3 rounded-lg text-xs max-h-64 overflow-y-auto"
                    style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}
                  >
                    {selectedCall.transcript}
                  </div>
                </div>
              )}

              {selectedCall.call_analysis && (
                <div className="mt-4">
                  <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>Analysis</p>
                  <pre
                    className="p-3 rounded-lg text-xs max-h-48 overflow-y-auto"
                    style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}
                  >
                    {JSON.stringify(selectedCall.call_analysis, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Select a call to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
