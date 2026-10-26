"use client";

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { titleCase } from "@/lib/utils";

interface Analytics {
  enquiry_status: { status: string; count: number }[];
  dealer_approval_status: { status: string; count: number }[];
  manufacturer_interest: { manufacturer: string; count: number }[];
}

const COLORS = ["#2563EB", "#14B8A6", "#F59E0B", "#16A34A", "#64748B", "#DC2626", "#9333EA"];

export function AdminCharts() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    api.get<Analytics>("/api/admin/analytics").then(setData).catch(() => {});
  }, []);

  if (!data) return null;

  const enquiryData = data.enquiry_status.map((d) => ({ name: titleCase(d.status), value: d.count }));
  const mfrData = data.manufacturer_interest.map((d) => ({ name: d.manufacturer, count: d.count }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h3 className="mb-4 font-semibold text-navy">Enquiry Status</h3>
        {enquiryData.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={enquiryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {enquiryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-sm text-muted">No data yet.</p>}
      </div>

      <div className="card p-6">
        <h3 className="mb-4 font-semibold text-navy">Manufacturer Interest</h3>
        {mfrData.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mfrData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-sm text-muted">No enquiries recorded yet.</p>}
      </div>
    </div>
  );
}
