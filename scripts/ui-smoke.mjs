// End-to-end UI check against a running `pnpm dev`: edits a rule, presses Run Now, captures screenshots.
// WARNING: this starts a REAL collection run (Metacritic requests and Gemini calls that count against quotas).
// The edited rule is restored to its default at the end.
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "/tmp";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } });
const log = (m) => console.log(`[ui-smoke] ${m}`);

try {
await page.goto(`${base}/workers`);
await page.getByText("Summarize Critics").first().click();
await page.getByRole("tab", { name: "Rules" }).click();
const field = page.getByLabel("Reviews sampled per summary");
await field.fill("10");
await page.getByRole("button", { name: "Save rules" }).click();
await page.getByText("Saved. The next run uses these rules.").waitFor({ timeout: 10_000 });
log("rule saved: critic maxReviews = 10");

await field.fill("0");
await page.getByRole("button", { name: "Save rules" }).click();
const alert = page.getByRole("alert").filter({ hasText: "maxReviews" });
await alert.waitFor({ timeout: 10_000 });
log(`invalid value rejected: ${(await alert.innerText()).trim()}`);

await page.goto(`${base}/games`);
await page.getByRole("heading", { name: "New Games" }).waitFor();
await page.getByRole("button", { name: "Run Now" }).first().click();
await page.getByText("Running…").first().waitFor({ timeout: 20_000 });
log("Run Now accepted, UI shows Running…");
await page.waitForTimeout(25_000);
await page.screenshot({ path: `${out}/games-running.png`, fullPage: true });
await page.goto(`${base}/workers`);
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/workers-running.png`, fullPage: true });
log("screenshots written");
} finally {
  await fetch(`${base}/api/pipeline/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset" }) });
  log("critic summary rule restored to default");
  await browser.close();
}
