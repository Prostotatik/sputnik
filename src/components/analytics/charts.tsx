"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
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

const ACCENT = "#4fb6c8";
/** The leading series takes the accent; the rest step down the neutral ramp. */
export const SERIES_COLORS = [ACCENT, "#a1a1a6", "#6e6e74", "#4b4b50"];

const axis = { stroke: "#85858b", fontSize: 11, fontFamily: "var(--font-geist-mono)", tickLine: false, axisLine: false } as const;
const grid = "#232325";
const tooltipStyle = {
  contentStyle: { background: "#19191b", border: "1px solid rgb(237 237 237 / 0.12)", borderRadius: 8, fontSize: 12, color: "#ededed" },
  labelStyle: { color: "#a1a1a6" },
  itemStyle: { color: "#ededed" },
  cursor: { fill: "rgb(237 237 237 / 0.03)" },
};

export function TrendLines({ data }: { data: AnalyticsData["trends"] }) {
  const rows = data.buckets.map((label, i) => ({ label, ...Object.fromEntries(data.series.map((s) => [s.genre, s.values[i]])) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => `${v}%`} />
        <Tooltip {...tooltipStyle} formatter={(v) => `${v}%`} />
        {[...data.series].reverse().map((s) => {
          const i = data.series.indexOf(s);
          return (
            <Line
              key={s.genre}
              type="monotone"
              dataKey={s.genre}
              stroke={SERIES_COLORS[i]}
              strokeWidth={i === 0 ? 2 : 1.5}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SupplyDemand({ data }: { data: AnalyticsData["supplyDemand"] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 12, right: 0, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis yAxisId="games" {...axis} allowDecimals={false} />
        <YAxis yAxisId="interest" orientation="right" hide />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [n === "interest" ? `${compact(Number(v))} reviews` : `${v} games`, n === "interest" ? "Player interest" : "Games released"]} />
        <Bar yAxisId="games" dataKey="games" fill="#3a3a3e" radius={[2, 2, 0, 0]} maxBarSize={20} />
        <Line yAxisId="interest" type="monotone" dataKey="interest" stroke={ACCENT} strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function Opportunities({ data }: { data: AnalyticsData["opportunities"] }) {
  const rows = data.map((d) => ({ ...d, z: Math.max(1, d.avgMetascore ?? 50) }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ScatterChart margin={{ top: 12, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={grid} />
        <XAxis type="number" dataKey="games" name="Games" {...axis} allowDecimals={false} />
        <YAxis type="number" dataKey="interest" name="Reviews per game" {...axis} tickFormatter={(v) => compact(v)} />
        <ZAxis type="number" dataKey="z" range={[60, 360]} />
        <Tooltip
          {...tooltipStyle}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
            if (!p) return null;
            return (
              <div className="rounded-lg border border-line-2 bg-panel px-3 py-2 text-xs">
                <p className="font-medium text-fg">{p.genre}</p>
                <p className="font-mono text-muted">
                  {p.games} games, {compact(p.interest)} reviews per game
                </p>
                <p className="text-muted">{p.quadrant === "opportunity" ? "High demand, low supply" : `${p.quadrant[0].toUpperCase()}${p.quadrant.slice(1)}`}</p>
              </div>
            );
          }}
        />
        <Scatter data={rows}>
          {rows.map((r) => (
            <Cell key={r.genre} fill={r.quadrant === "opportunity" ? ACCENT : "#5c5c62"} fillOpacity={r.quadrant === "opportunity" ? 0.9 : 0.7} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
