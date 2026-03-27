"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";

interface Suggestion {
  id: string;
  title: string | null;
  description: string | null;
  ai_summary: string | null;
  status: string;
  vote_count: number;
  has_voted: boolean;
  author: { id: string; name: string | null; email: string } | null;
  created_at: string;
  updated_at: string;
  author_id: string;
}

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "rgba(107, 124, 110, 0.2)", color: "var(--text-muted)" },
  published: { label: "New", bg: "rgba(93, 138, 102, 0.2)", color: "var(--christmas-green-light)" },
  under_review: { label: "Under Review", bg: "rgba(184, 149, 107, 0.2)", color: "var(--christmas-gold)" },
  planned: { label: "Planned", bg: "rgba(59, 130, 246, 0.2)", color: "#60a5fa" },
  in_progress: { label: "In Progress", bg: "rgba(168, 85, 247, 0.2)", color: "#c084fc" },
  done: { label: "Done", bg: "rgba(34, 197, 94, 0.2)", color: "#22c55e" },
  declined: { label: "Declined", bg: "rgba(239, 68, 68, 0.2)", color: "#ef4444" },
};

export default function SuggestionsPage() {
  const router = useRouter();
  const { user, isOwner } = usePermissions();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("votes");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  async function fetchSuggestions() {
    try {
      const res = await fetch("/api/suggestions");
      if (res.ok) setSuggestions(await res.json());
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    }
    setLoading(false);
  }

  async function handleNewIdea() {
    setCreating(true);
    try {
      const res = await fetch("/api/suggestions", { method: "POST" });
      if (res.ok) {
        const suggestion = await res.json();
        router.push(`/suggestions/${suggestion.id}`);
      }
    } catch (error) {
      console.error("Failed to create suggestion:", error);
    }
    setCreating(false);
  }

  async function handleVote(id: string) {
    try {
      const res = await fetch(`/api/suggestions/${id}/vote`, { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === id
              ? { ...s, vote_count: result.vote_count, has_voted: result.voted }
              : s
          )
        );
      }
    } catch (error) {
      console.error("Failed to vote:", error);
    }
  }

  const filtered = suggestions
    .filter((s) => {
      if (filterStatus === "all") return s.status !== "draft";
      if (filterStatus === "mine") return s.author_id === user?.id;
      return s.status === filterStatus;
    })
    .sort((a, b) => {
      if (sortBy === "votes") return b.vote_count - a.vote_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--christmas-cream)" }}>
            Idea Board
          </h1>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
            Share ideas, refine them with AI, and vote on what matters
          </p>
        </div>
        <button
          onClick={handleNewIdea}
          disabled={creating}
          className="inline-flex items-center px-4 py-2 rounded-lg transition-colors"
          style={{ background: "var(--christmas-green)", color: "var(--christmas-cream)" }}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {creating ? "Starting..." : "New Idea"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm mb-1" style={{ color: "var(--text-muted)" }}>
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-card)",
              color: "var(--christmas-cream)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <option value="all">All Ideas</option>
            <option value="mine">My Ideas</option>
            <option value="published">New</option>
            <option value="under_review">Under Review</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="declined">Declined</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: "var(--text-muted)" }}>
            Sort By
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-card)",
              color: "var(--christmas-cream)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <option value="votes">Most Votes</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Suggestions List */}
      {loading ? (
        <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
          Loading ideas...
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="text-center py-12 rounded-xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <p style={{ color: "var(--text-muted)" }}>
            {filterStatus === "mine" ? "You haven't shared any ideas yet." : "No ideas yet. Be the first to share one."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const statusInfo = STATUS_LABELS[s.status] || STATUS_LABELS.published;
            return (
              <div
                key={s.id}
                className="rounded-xl p-5 flex gap-4"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {/* Vote button */}
                {s.status !== "draft" && (
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleVote(s.id);
                      }}
                      className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors"
                      style={{
                        background: s.has_voted
                          ? "rgba(93, 138, 102, 0.2)"
                          : "transparent",
                        border: `1px solid ${s.has_voted ? "var(--christmas-green)" : "var(--border-subtle)"}`,
                        color: s.has_voted
                          ? "var(--christmas-green-light)"
                          : "var(--text-muted)",
                      }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill={s.has_voted ? "currentColor" : "none"}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                      <span className="text-sm font-medium">{s.vote_count}</span>
                    </button>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/suggestions/${s.id}`}
                        className="text-lg font-medium hover:underline"
                        style={{ color: "var(--christmas-cream)" }}
                      >
                        {s.title || "Untitled idea"}
                      </Link>
                      {s.description && (
                        <p
                          className="mt-1 text-sm line-clamp-2"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {s.description}
                        </p>
                      )}
                    </div>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                      style={{ background: statusInfo.bg, color: statusInfo.color }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{s.author?.name || s.author?.email || "Unknown"}</span>
                    <span>{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Count */}
      <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
        {filtered.length} idea{filtered.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
