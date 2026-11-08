import type { AnalyticsData } from "./analytics";

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formulas in externally sourced text (CSV injection).
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(a: AnalyticsData): string {
  const rows: unknown[][] = [["section", "name", "metric", "value"]];
  const k = a.kpis;
  rows.push(["kpi", "Total games", "value", k.totalGames.value], ["kpi", "Total games", "delta", k.totalGames.delta]);
  rows.push(["kpi", "Average Metascore", "value", k.avgMetascore.value], ["kpi", "Average Userscore", "value", k.avgUserscore.value]);
  rows.push(["kpi", "Trending genre", k.trendingGenre.name, k.trendingGenre.growth]);
  for (const g of a.genreShare) rows.push(["genre_share", g.genre, "share_pct", g.share], ["genre_share", g.genre, "games", g.count]);
  for (const s of a.supplyDemand) rows.push(["supply_demand", s.label, "games", s.games], ["supply_demand", s.label, "interest", s.interest]);
  for (const o of a.opportunities) rows.push(["opportunity", o.genre, o.quadrant, `${o.games} games / ${o.interest} reviews per game`]);
  for (const p of a.combinations.pairs) rows.push(["combination", `${p.genre} + ${p.platform}`, "share_pct", p.share]);
  for (const t of a.topGames) rows.push(["top_game", t.title, "user_reviews", t.userReviews]);
  for (const i of a.insights?.items ?? []) rows.push(["insight", i.kind, "text", i.text]);
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}
