import type { AnalyticsData } from "./analytics";
import { genreRu } from "@/lib/genres";

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formulas in externally sourced text (CSV injection).
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const QUADRANT = { opportunity: "высокий спрос, мало релизов", competitive: "высокая конкуренция", niche: "узкая ниша", saturated: "рынок насыщен" } as const;
const INSIGHT = { up: "рост", down: "спад", opportunity: "ниша" } as const;

export function toCsv(a: AnalyticsData): string {
  const rows: unknown[][] = [["раздел", "название", "метрика", "значение"]];
  const k = a.kpis;
  rows.push(["показатели", "Игр в выборке", "значение", k.totalGames.value], ["показатели", "Игр в выборке", "изменение", k.totalGames.delta]);
  rows.push(["показатели", "Средний Metascore", "значение", k.avgMetascore.value], ["показатели", "Средний Userscore", "значение", k.avgUserscore.value]);
  rows.push(["показатели", "Растущий жанр", k.trendingGenre.name ? genreRu(k.trendingGenre.name) : "", k.trendingGenre.growth]);
  for (const g of a.genreShare) rows.push(["доля жанров", genreRu(g.genre), "доля, %", g.share], ["доля жанров", genreRu(g.genre), "игр", g.count]);
  for (const s of a.supplyDemand) rows.push(["предложение и спрос", s.label, "игр", s.games], ["предложение и спрос", s.label, "отзывов", s.interest]);
  for (const o of a.opportunities) rows.push(["ниши", genreRu(o.genre), QUADRANT[o.quadrant], `${o.games} игр / ${o.interest} отзывов на игру`]);
  for (const p of a.combinations.pairs) rows.push(["сочетания", `${genreRu(p.genre)} + ${p.platform}`, "доля, %", p.share]);
  for (const t of a.topGames) rows.push(["топ игр", t.title, "отзывов игроков", t.userReviews]);
  for (const i of a.insights?.items ?? []) rows.push(["инсайт", INSIGHT[i.kind], "текст", i.text]);
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}
