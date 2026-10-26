"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { titleCase } from "@/lib/utils";

const COLORS = ["#2563EB", "#14B8A6", "#F59E0B", "#16A34A", "#64748B", "#DC2626"];

export function DealerAnalytics({ data }: { data: { status: string; count: number }[] }) {
  if (!data.length) return <p className="mt-4 text-sm text-muted">No quotation data yet.</p>;
  const chartData = data.map((d) => ({ name: titleCase(d.status), count: d.count }));

  return (
    <div className="mt-4 h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
