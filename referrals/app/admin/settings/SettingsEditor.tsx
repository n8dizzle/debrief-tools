"use client";

import { useState } from "react";
import type { Setting } from "@/lib/settings";

export default function SettingsEditor({ initial }: { initial: Setting[] }) {
  const [rows, setRows] = useState<Setting[]>(initial);

  function updateLocal(key: string, value: string) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, value } : r)));
  }

  return (
    <div className="grid gap-4 max-w-2xl">
      {rows.map((s) => (
        <SettingRow key={s.key} setting={s} onChange={updateLocal} />
      ))}
      {rows.length === 0 && (
        <p className="opacity-60 text-sm">No settings registered yet.</p>
      )}
    </div>
  );
}

function SettingRow({
  setting,
  onChange,
}: {
  setting: Setting;
  onChange: (key: string, value: string) => void;
}) {
  const [draft, setDraft] = useState(setting.value ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const dirty = draft.trim() !== (setting.value ?? "").trim();

  async function save() {
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: setting.key, value: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        setStatus("error");
        return;
      }
      onChange(setting.key, data.value ?? "");
      setDraft(data.value ?? "");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setError("Network error");
      setStatus("error");
    }
  }

  return (
    <div className="card">
      <div className="mb-3">
        <p className="font-semibold">{setting.label}</p>
        {setting.description && (
          <p className="text-sm opacity-70 mt-1">{setting.description}</p>
        )}
        <p className="text-xs opacity-50 mt-2">
          Key: <code>{setting.key}</code>
          {setting.updated_at && (
            <>
              {" · "}Updated{" "}
              {new Date(setting.updated_at).toLocaleString()}
              {setting.updated_by ? ` by ${setting.updated_by}` : ""}
            </>
          )}
        </p>
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Not set"
        />
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={!dirty || status === "saving"}
          style={{
            opacity: !dirty || status === "saving" ? 0.5 : 1,
            cursor: !dirty || status === "saving" ? "not-allowed" : "pointer",
          }}
        >
          {status === "saving"
            ? "Saving…"
            : status === "saved"
            ? "Saved ✓"
            : "Save"}
        </button>
      </div>

      {error && (
        <p
          className="mt-3 text-sm p-2 rounded"
          style={{
            background: "rgba(135,76,59,0.1)",
            color: "var(--ca-red)",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

