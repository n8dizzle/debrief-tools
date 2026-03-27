"use client";

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
  label: string;
  bestScore: number;
  totalReps: number;
  status: string;
}

interface Props {
  booklets: BookletData[];
  color: string;
}

export default function BookletProgressChart({ booklets, color }: Props) {
  if (booklets.length === 0) return null;

  const maxScore = Math.max(...booklets.map((b) => b.bestScore), 5);

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, booklets.length * 36 + 40)}>
      <BarChart
        data={booklets}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, maxScore + 1]}
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          label={{ value: "Best Score (mistakes)", position: "insideBottom", offset: -2, fontSize: 11, fill: "var(--text-muted)" }}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={100}
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
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
            const b = entry?.payload as BookletData | undefined;
            const reps = b?.totalReps ?? 0;
            return [
              `${value} mistakes (${reps} rep${reps !== 1 ? "s" : ""})`,
              "Best Score",
            ];
          }}
        />
        <Bar dataKey="bestScore" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {booklets.map((b, i) => (
            <Cell
              key={i}
              fill={b.status === "passed" ? "#2E7D4F" : color}
              fillOpacity={b.status === "passed" ? 0.85 : 0.6}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
