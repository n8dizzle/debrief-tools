"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Suggestion {
  id: string;
  title: string | null;
  description: string | null;
  ai_summary: string | null;
  status: string;
  vote_count: number;
  has_voted: boolean;
  author_id: string;
  author: { id: string; name: string | null; email: string } | null;
  messages: Message[];
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "published", label: "New" },
  { value: "under_review", label: "Under Review" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "declined", label: "Declined" },
];

export default function SuggestionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isOwner } = usePermissions();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const id = params.id as string;
  const isAuthor = suggestion?.author_id === user?.id;
  const isDraft = suggestion?.status === "draft";
  const canChat = isAuthor && isDraft;
  const canChangeStatus = isOwner;
  const hasSpec = !!(suggestion?.title && suggestion?.description);

  useEffect(() => {
    fetchSuggestion();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [suggestion?.messages]);

  async function fetchSuggestion() {
    try {
      const res = await fetch(`/api/suggestions/${id}`);
      if (res.ok) {
        setSuggestion(await res.json());
      } else {
        router.push("/suggestions");
      }
    } catch {
      router.push("/suggestions");
    }
    setLoading(false);
  }

  async function handleSend() {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    // Optimistic: add user message to UI
    setSuggestion((prev) =>
      prev
        ? {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: `temp-${Date.now()}`,
                role: "user" as const,
                content: userMessage,
                created_at: new Date().toISOString(),
              },
            ],
          }
        : prev
    );

    try {
      const res = await fetch(`/api/suggestions/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      if (res.ok) {
        const assistantMsg = await res.json();
        setSuggestion((prev) =>
          prev
            ? {
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    id: `assistant-${Date.now()}`,
                    role: "assistant",
                    content: assistantMsg.content,
                    created_at: new Date().toISOString(),
                  },
                ],
              }
            : prev
        );
        // Re-fetch to get any auto-populated title/description/summary
        const freshRes = await fetch(`/api/suggestions/${id}`);
        if (freshRes.ok) {
          const fresh = await freshRes.json();
          setSuggestion((prev) =>
            prev
              ? {
                  ...prev,
                  title: fresh.title,
                  description: fresh.description,
                  ai_summary: fresh.ai_summary,
                }
              : prev
          );
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }

    setSending(false);
    inputRef.current?.focus();
  }

  async function handlePublish() {
    if (!hasSpec) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (res.ok) {
        setSuggestion((prev) => (prev ? { ...prev, status: "published" } : prev));
      }
    } catch (error) {
      console.error("Failed to publish:", error);
    }
    setPublishing(false);
  }

  async function handleStatusChange(newStatus: string) {
    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setSuggestion((prev) => (prev ? { ...prev, status: newStatus } : prev));
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this idea? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/suggestions/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/suggestions");
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  }

  async function handleVote() {
    try {
      const res = await fetch(`/api/suggestions/${id}/vote`, { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        setSuggestion((prev) =>
          prev
            ? { ...prev, vote_count: result.vote_count, has_voted: result.voted }
            : prev
        );
      }
    } catch (error) {
      console.error("Failed to vote:", error);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function renderMessageContent(content: string) {
    // Strip <suggestion> blocks from display and render markdown-ish formatting
    const cleaned = content.replace(/<suggestion>[\s\S]*?<\/suggestion>/g, "").trim();
    const lines = cleaned.split("\n");
    return lines.map((line, i) => {
      let html = line
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/`(.*?)`/g, '<code style="background:var(--bg-card-hover);padding:1px 4px;border-radius:3px;font-size:0.875em">$1</code>');

      if (line.startsWith("- ") || line.startsWith("* ")) {
        html = `<span style="padding-left:1rem;display:block">${html}</span>`;
      }

      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: html }} />
          {i < lines.length - 1 && <br />}
        </span>
      );
    });
  }

  if (loading) {
    return (
      <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>
        Loading...
      </div>
    );
  }

  if (!suggestion) return null;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      {/* Top Bar */}
      <div
        className="px-6 py-4 border-b flex items-center justify-between"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/suggestions"
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--christmas-cream)" }}>
              {suggestion.title || "New Idea"}
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              by {suggestion.author?.name || suggestion.author?.email || "Unknown"}
              {" "}on {new Date(suggestion.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Vote (non-draft only) */}
          {!isDraft && (
            <button
              onClick={handleVote}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm"
              style={{
                background: suggestion.has_voted
                  ? "rgba(93, 138, 102, 0.2)"
                  : "transparent",
                border: `1px solid ${suggestion.has_voted ? "var(--christmas-green)" : "var(--border-subtle)"}`,
                color: suggestion.has_voted
                  ? "var(--christmas-green-light)"
                  : "var(--text-muted)",
              }}
            >
              <svg
                className="w-4 h-4"
                fill={suggestion.has_voted ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              {suggestion.vote_count}
            </button>
          )}

          {/* Status dropdown (owner only) */}
          {canChangeStatus && !isDraft && (
            <select
              value={suggestion.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{
                background: "var(--bg-card)",
                color: "var(--christmas-cream)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Delete */}
          {(isAuthor || isOwner) && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)" }}
              title="Delete idea"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat thread */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {suggestion.messages.length === 0 && canChat && (
              <div
                className="text-center py-12 rounded-xl max-w-lg mx-auto"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="text-4xl mb-4">💡</div>
                <p className="text-lg font-medium" style={{ color: "var(--christmas-cream)" }}>
                  What's on your mind?
                </p>
                <p className="mt-2 text-sm max-w-md mx-auto px-4" style={{ color: "var(--text-secondary)" }}>
                  Share your idea and I'll help you think it through. Just describe the problem you're seeing or the feature you'd like — I'll ask questions to refine it.
                </p>
              </div>
            )}

            {suggestion.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background:
                      msg.role === "user"
                        ? "var(--christmas-green)"
                        : "var(--bg-card)",
                    color:
                      msg.role === "user"
                        ? "var(--christmas-cream)"
                        : "var(--text-primary)",
                    border:
                      msg.role === "assistant"
                        ? "1px solid var(--border-subtle)"
                        : "none",
                  }}
                >
                  {renderMessageContent(msg.content)}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                  }}
                >
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {canChat && (
            <div
              className="px-6 py-4 border-t"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {/* Publish bar */}
              {hasSpec && (
                <div
                  className="mb-3 p-3 rounded-lg flex items-center justify-between"
                  style={{
                    background: "rgba(93, 138, 102, 0.1)",
                    border: "1px solid var(--christmas-green-dark)",
                  }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--christmas-green-light)" }}>
                      Idea ready to share
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      "{suggestion.title}" — publish to the board for others to see and vote on
                    </p>
                  </div>
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: "var(--christmas-green)",
                      color: "var(--christmas-cream)",
                    }}
                  >
                    {publishing ? "Publishing..." : "Publish"}
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your idea..."
                  rows={1}
                  className="flex-1 px-4 py-3 rounded-xl text-sm resize-none"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--christmas-cream)",
                    border: "1px solid var(--border-subtle)",
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = Math.min(target.scrollHeight, 120) + "px";
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="px-4 py-3 rounded-xl transition-colors"
                  style={{
                    background:
                      input.trim() && !sending
                        ? "var(--christmas-green)"
                        : "var(--bg-card-hover)",
                    color:
                      input.trim() && !sending
                        ? "var(--christmas-cream)"
                        : "var(--text-muted)",
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                  </svg>
                </button>
              </div>
              <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          )}
        </div>

        {/* Spec sidebar (when available) */}
        {hasSpec && (
          <div
            className="w-80 border-l overflow-y-auto p-6 hidden lg:block"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
              Idea Summary
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                  Title
                </label>
                <p className="text-sm font-medium" style={{ color: "var(--christmas-cream)" }}>
                  {suggestion.title}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                  Description
                </label>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {suggestion.description}
                </p>
              </div>

              {suggestion.ai_summary && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    Spec
                  </label>
                  <div
                    className="text-sm rounded-lg p-3"
                    style={{
                      background: "var(--bg-card)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {renderMessageContent(suggestion.ai_summary)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
