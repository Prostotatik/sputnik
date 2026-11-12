// Captures the README screenshots from a running instance. Read-only: it opens dialogs and tabs
// but never saves a rule, starts a run or presses Test, so it is safe against production.
//   node scripts/readme-shots.mjs https://sputnik.morozfedor.dev doc/readme
import fs from "node:fs";
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "doc/readme";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5, locale: "ru-RU", colorScheme: "dark" });
const log = (m) => console.log(`[readme-shots] ${m}`);
const settle = (ms = 1500) => page.waitForTimeout(ms);
const shot = async (name, opts = {}) => {
  await page.screenshot({ path: `${out}/${name}.png`, ...opts });
  log(`${name}.png`);
};
// Screenshot of an element with some breathing room around it.
const clip = async (name, locator, pad = 12) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${name}: element not visible`);
  await shot(name, { clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 } });
};

try {
  // 1. Games: list + card.
  await page.goto(`${base}/games`);
  await page.getByRole("heading", { name: "Новые игры" }).waitFor();
  await settle(2500);
  await shot("games");

  // 2. Workers: the graph.
  await page.goto(`${base}/workers`);
  await page.getByRole("heading", { name: "Воркеры" }).waitFor();
  await settle(2500);
  await shot("workers");

  // 3. A step's overview: status, timing, agent, current rules.
  await page.locator(".react-flow__node", { hasText: "Сводка критиков" }).first().click();
  await settle();
  const details = page.locator("section", { has: page.getByRole("heading", { name: "Подробности шага" }) });
  await clip("workers-step", details);

  // 4. Rules editor: parameters, model, prompt with placeholders.
  await page.getByRole("tab", { name: "Правила" }).click();
  await settle();
  await clip("workers-rules", details);

  // 5. What the step produced in the last run.
  await page.locator(".react-flow__node", { hasText: "Отбор новых игр" }).first().click();
  await page.getByRole("tab", { name: "Выход" }).click();
  await settle();
  await clip("workers-output", details);

  // 6. New custom rule from an example (not saved).
  await page.getByRole("button", { name: "Добавить правило" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Монетизация" }).click();
  await settle();
  await clip("workers-add-rule", dialog, 0);
  await page.keyboard.press("Escape");

  // 7. History: a past run on the same graph.
  await page.getByRole("tab", { name: "История" }).click();
  await settle(2500);
  await shot("workers-history", { clip: { x: 240, y: 0, width: 1200, height: 760 } });

  // 8. Analytics and Monitoring.
  await page.goto(`${base}/analytics`);
  await page.getByRole("heading", { name: "Аналитика" }).waitFor();
  await settle(3000);
  await shot("analytics");
  await page.goto(`${base}/monitoring`);
  await page.getByRole("heading", { name: "Мониторинг" }).waitFor();
  await settle(3000);
  await shot("monitoring");
} finally {
  await browser.close();
}
