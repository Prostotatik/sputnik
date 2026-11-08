// Geometry check: compares block positions in the running UI (1222x1287, the reference canvas) with the
// blocks measured on doc/*-ref.png. Reports IoU and centre offset per block. Usage: node scripts/layout-vs-refs.mjs [baseUrl]
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3000";
// [x1, y1, x2, y2] measured on the reference images (1222x1287 px).
const REF = {
  games: {
    url: `/games${process.env.GAME ? `?game=${process.env.GAME}` : ""}`,
    blocks: {
      sidebar: [[0, 0, 118, 1287], () => document.querySelector("aside")],
      search: [[145, 22, 473, 57], () => document.querySelector("header label")],
      list: [[136, 92, 430, 825], () => document.querySelector('section[aria-label="Game list"]')],
      hero: [[447, 70, 1222, 540], () => document.querySelector("article > div")],
      opinions: [[474, 550, 1196, 812], () => document.querySelector("article > div.grid")],
      similar: [[135, 845, 812, 1057], () => document.querySelector('[aria-labelledby="similar-title"]')],
      youtube: [[828, 836, 1196, 1054], () => document.querySelector('[aria-labelledby="yt-title"]')],
      monitor: [[88, 1084, 1204, 1230], () => document.querySelector('section[aria-label="Service monitor"]')],
    },
  },
  workers: {
    url: "/workers",
    blocks: {
      title: [[148, 100, 430, 165], () => document.querySelector("h1").parentElement],
      kpis: [[508, 78, 1200, 178], () => document.querySelector("h1").parentElement.nextElementSibling],
      graph: [[150, 240, 1030, 730], () => document.querySelector(".react-flow")],
      legend: [[1040, 245, 1200, 698], () => document.querySelector('aside[aria-label="Legend"]')],
      nodeDetails: [[143, 757, 688, 1213], () => document.querySelector('[aria-labelledby="node-title"]')],
      runHistory: [[708, 757, 1200, 1213], () => document.querySelector('[aria-labelledby="history-title"]')],
    },
  },
  analytics: {
    url: "/analytics",
    blocks: {
      kpis: [[144, 172, 1200, 265], () => document.querySelectorAll("main .grid:not(.grid .grid)")[0]],
      genre: [[144, 284, 603, 516], () => document.querySelectorAll("main .grid:not(.grid .grid)")[1].children[0]],
      trends: [[620, 284, 1200, 522], () => document.querySelectorAll("main .grid:not(.grid .grid)")[1].children[1]],
      supply: [[142, 535, 603, 765], () => document.querySelectorAll("main .grid:not(.grid .grid)")[2].children[0]],
      insights: [[620, 540, 1200, 767], () => document.querySelectorAll("main .grid:not(.grid .grid)")[2].children[1]],
      opportunities: [[143, 785, 681, 998], () => document.querySelectorAll("main .grid:not(.grid .grid)")[3].children[0]],
      combinations: [[698, 785, 1200, 998], () => document.querySelectorAll("main .grid:not(.grid .grid)")[3].children[1]],
      topGames: [[143, 1015, 846, 1220], () => document.querySelectorAll("main .grid:not(.grid .grid)")[4].children[0]],
      market: [[862, 1015, 1200, 1220], () => document.querySelectorAll("main .grid:not(.grid .grid)")[4].children[1]],
    },
  },
};

const iou = (a, b) => {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  const area = (r) => (r[2] - r[0]) * (r[3] - r[1]);
  return inter / (area(a) + area(b) - inter);
};

const browser = await chromium.launch({ channel: "chrome" });
let worst = 1;
for (const [tab, { url, blocks }] of Object.entries(REF)) {
  const page = await browser.newPage({ viewport: { width: 1222, height: 1287 } });
  await page.goto(base + url);
  await page.waitForTimeout(4500);
  console.log(`\n${tab}`);
  for (const [name, [ref, pick]] of Object.entries(blocks)) {
    const box = await page.evaluate(`(${pick.toString()})()?.getBoundingClientRect().toJSON()`);
    if (!box) {
      console.log(`  ${name.padEnd(14)} MISSING`);
      worst = 0;
      continue;
    }
    const ours = [box.left, box.top, box.right, box.bottom].map(Math.round);
    const score = iou(ref, ours);
    worst = Math.min(worst, score);
    const dx = Math.round((ours[0] + ours[2] - ref[0] - ref[2]) / 2);
    const dy = Math.round((ours[1] + ours[3] - ref[1] - ref[3]) / 2);
    console.log(`  ${name.padEnd(14)} IoU ${score.toFixed(2)}  centre offset ${String(dx).padStart(4)},${String(dy).padStart(4)} px  ours ${ours.join(",")}`);
  }
  await page.close();
}
await browser.close();
console.log(`\nworst block IoU: ${worst.toFixed(2)}`);
