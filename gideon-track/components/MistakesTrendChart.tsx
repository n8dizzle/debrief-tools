"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface ChartSession {
  rep: number;
  mistakes: number;
  passed: boolean;
}

interface Props {
  sessions: ChartSession[];
  threshold: number;
  color: string;
}

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  if (payload.passed) {
    return (
      <svg x={cx - 7} y={cy - 7} width={14} height={14}>
        <circle cx={7} cy={7} r={6} fill="#2E7D4F" stroke="white" strokeWidth={2} />
      </svg>
    );
  }
  return (
    <svg x={cx - 6} y={cy - 6} width={12} height={12}>
      <circle cx={6} cy={6} r={5} fill={props.stroke} stroke="white" strokeWidth={2} />
    </svg>
  );
}

export default function MistakesTrendChart({ sessions, threshold, color }: Props) {
  const maxMistakes = Math.max(...sessions.map((s) => s.mistakes), threshold + 2);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={sessions} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
        <XAxis
          dataKey="rep"
          tick={{ fontSize: 12, fill: "var(--text-muted)" }}
          label={{ value: "Rep #", position: "insideBottom", offset: -2, fontSize: 12, fill: "var(--text-muted)" }}
        />
        <YAxis
          domain={[0, maxMistakes]}
          tick={{ fontSize: 12, fill: "var(--text-muted)" }}
          label={{ value: "Mistakes", angle: -90, position: "insideLeft", fontSize: 12, fill: "var(--text-muted)" }}
        />
        <Tooltip
          contentStyle={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "0.75rem",
            fontSize: "0.875rem",
            boxShadow: "var(--shadow-md)",
          }}
          formatter={(value) => [`${value} mistakes`, "Score"]}
          labelFormatter={(label) => `Rep #${label}`}
        />
        <ReferenceLine
          y={threshold}
          stroke="#2E7D4F"
          strokeDasharray="5 5"
          strokeWidth={2}
          label={{
            value: `Pass: ${threshold}`,
            position: "right",
            fontSize: 11,
            fill: "#2E7D4F",
          }}
        />
        <Line
          type="monotone"
          dataKey="mistakes"
          stroke={color}
          strokeWidth={3}
          dot={<CustomDot />}
          activeDot={{ r: 7, stroke: color, fill: "white", strokeWidth: 2.5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
