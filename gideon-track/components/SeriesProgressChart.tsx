"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BookletData {
  id: string;
  name: string;
  status: "passed" | "in_progress" | "upcoming";
  is_current: boolean;
  total_reps: number;
}

interface SeriesOption {
  id: string;
  label: string;
  levelName: string;
  seriesName: string;
  booklets: BookletData[];
}

interface Props {
  seriesOptions: SeriesOption[];
  currentSeriesId: string | null;
  subjectColor: string;
}

export default function SeriesProgressChart({
  seriesOptions,
  currentSeriesId,
  subjectColor,
}: Props) {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>("");

  // Auto-select the series containing the current booklet
  useEffect(() => {
    if (currentSeriesId) {
      setSelectedSeriesId(currentSeriesId);
    } else if (seriesOptions.length > 0) {
      setSelectedSeriesId(seriesOptions[0].id);
    }
  }, [currentSeriesId, seriesOptions]);

  const selectedSeries = seriesOptions.find((s) => s.id === selectedSeriesId);
  if (!selectedSeries || selectedSeries.booklets.length === 0) return null;

  const chartData = selectedSeries.booklets.map((b) => ({
    name: b.name,
    attempts: b.total_reps,
    status: b.status,
    isCurrent: b.is_current,
  }));

  const maxAttempts = Math.max(...chartData.map((d) => d.attempts), 1);

  return (
    <div className="card mb-6 animate-fade-up stagger-2">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2
          className="text-lg"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-display), sans-serif", fontWeight: 700 }}
        >
          Series Progress
        </h2>
        {seriesOptions.length > 1 && (
          <select
            value={selectedSeriesId}
            onChange={(e) => setSelectedSeriesId(e.target.value)}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
          >
            {seriesOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Attempts per booklet &middot; <span style={{ color: "#2E7D4F" }}>Green = Passed</span>
      </p>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={true} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            interval={0}
            angle={chartData.length > 12 ? -45 : 0}
            textAnchor={chartData.length > 12 ? "end" : "middle"}
            height={chartData.length > 12 ? 60 : 30}
          />
          <YAxis
            domain={[0, maxAttempts + 1]}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            label={{ value: "Attempts", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--text-muted)" }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "0.75rem",
              fontSize: "0.8rem",
              boxShadow: "var(--shadow-md)",
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, _name: any, entry: any) => {
              const d = entry?.payload;
              const label = d?.isCurrent ? " (Current)" : d?.status === "passed" ? " (Passed)" : "";
              return [`${value} attempt${value !== 1 ? "s" : ""}${label}`, `Booklet ${d?.name}`];
            }}
            labelFormatter={() => ""}
          />
          <Bar dataKey="attempts" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {chartData.map((d, i) => {
              let fill = "var(--border-default)"; // upcoming
              let opacity = 0.5;
              if (d.status === "passed") {
                fill = "#2E7D4F";
                opacity = 0.85;
              } else if (d.isCurrent) {
                fill = subjectColor;
                opacity = 1;
              } else if (d.status === "in_progress") {
                fill = subjectColor;
                opacity = 0.6;
              }
              return <Cell key={i} fill={fill} fillOpacity={opacity} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
