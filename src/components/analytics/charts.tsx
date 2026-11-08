"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { AnalyticsData } from "@/core/analytics";
import { compact } from "@/lib/client/format";

export const GENRE_COLORS = ["#a855f7", "#3b82f6", "#22c55e", "#eab308", "#f97316", "#71717a"];

const axis = { stroke: "#5c5c66", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "#111114", border: "1px solid #2e2e37", borderRadius: 10, fontSize: 12, color: "#ededf0" },
  labelStyle: { color: "#ededf0" },
  itemStyle: { color: "#c9c9d1" },
  cursor: { fill: "rgb(255 255 255 / 0.03)" },
};

export function GenreDonut({ data }: { data: AnalyticsData["genreShare"] }) {
  const top = data[0];
  return (
    <div className="relative h-[180px] w-[180px] shrink-0">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="genre" innerRadius={62} outerRadius={84} paddingAngle={1.5} stroke="none" startAngle={90} endAngle={-270}>
            {data.map((d, i) => (
              <Cell key={d.genre} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} games`, n]} />
        </PieChart>
      </ResponsiveContainer>
      {top && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-semibold">{top.share}%</span>
          <span className="max-w-[100px] truncate text-[13px] text-muted">{top.genre}</span>
        </div>
      )}
    </div>
  );
}

export function TrendLines({ data }: { data: AnalyticsData["trends"] }) {
  const rows = data.buckets.map((label, i) => ({ label, ...Object.fromEntries(data.series.map((s) => [s.genre, s.values[i]])) }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={rows} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#1e1e24" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => `${v}%`} />
        <Tooltip {...tooltipStyle} formatter={(v) => `${v}%`} />
        {data.series.map((s, i) => (
          <Line key={s.genre} type="monotone" dataKey={s.genre} stroke={GENRE_COLORS[i]} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: GENRE_COLORS[i] }} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SupplyDemand({ data }: { data: AnalyticsData["supplyDemand"] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="bar-supply" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6b5ca8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#3b3366" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1e1e24" vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis yAxisId="games" {...axis} allowDecimals={false} />
        <YAxis yAxisId="interest" orientation="right" hide />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [n === "interest" ? `${compact(Number(v))} reviews` : `${v} games`, n === "interest" ? "Player interest" : "Games released"]} />
        <Bar yAxisId="games" dataKey="games" fill="url(#bar-supply)" radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Line yAxisId="interest" type="monotone" dataKey="interest" stroke="#a855f7" strokeWidth={2.2} dot={{ r: 3, fill: "#c4b5fd", strokeWidth: 0 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const QUADRANT_COLORS: Record<string, string> = { opportunity: "#f59e0b", competitive: "#a855f7", niche: "#3b82f6", saturated: "#71717a" };

export function Opportunities({ data }: { data: AnalyticsData["opportunities"] }) {
  const rows = data.map((d) => ({ ...d, z: Math.max(1, d.avgMetascore ?? 50) }));
  return (
    <ResponsiveContainer width="100%" height={190}>
      <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 14 }}>
        <CartesianGrid stroke="#1e1e24" />
        <XAxis type="number" dataKey="games" name="Games" {...axis} allowDecimals={false} label={{ value: "Number of games", position: "insideBottom", offset: -8, fill: "#8a8a96", fontSize: 11 }} />
        <YAxis type="number" dataKey="interest" name="Reviews per game" {...axis} tickFormatter={(v) => compact(v)} label={{ value: "Player interest", angle: -90, position: "insideLeft", offset: 18, fill: "#8a8a96", fontSize: 11 }} />
        <ZAxis type="number" dataKey="z" range={[80, 520]} />
        <Tooltip
          {...tooltipStyle}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
            if (!p) return null;
            return (
              <div className="rounded-lg border border-line-2 bg-panel px-3 py-2 text-xs">
                <p className="font-medium text-fg">{p.genre}</p>
                <p className="text-muted">
                  {p.games} games · {compact(p.interest)} reviews/game
                </p>
                <p className="text-muted capitalize">{p.quadrant === "opportunity" ? "High demand, low supply" : p.quadrant}</p>
              </div>
            );
          }}
        />
        <Scatter data={rows}>
          {rows.map((r) => (
            <Cell key={r.genre} fill={QUADRANT_COLORS[r.quadrant]} fillOpacity={0.75} stroke={QUADRANT_COLORS[r.quadrant]} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export { QUADRANT_COLORS };
