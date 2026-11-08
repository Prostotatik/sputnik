import { describe, expect, it } from "vitest";
import {
  clipWindow,
  isRelevant,
  parseDuration,
  parseSearchHtml,
  parseViews,
  pickCandidates,
  remainingBudgetSec,
  type VideoCandidate,
} from "./youtube";

const renderer = (id: string, title: string, views: string, length: string) => ({
  videoRenderer: {
    videoId: id,
    title: { runs: [{ text: title }] },
    ownerText: { runs: [{ text: "Chan" }] },
    viewCountText: { simpleText: views },
    lengthText: { simpleText: length },
  },
});

const html = `<html><script>var ytInitialData = ${JSON.stringify({
  contents: {
    sectionListRenderer: {
      contents: [
        {
          itemSectionRenderer: {
            contents: [
              renderer("a1", "Elden Ring (Full Game) - No Commentary", "7,697,718 views", "11:46:35"),
              renderer("b2", "So this is why everyone loves Elden Ring", "2,460,047 views", "1:51:51"),
              renderer("c3", "Elden Ring trailer", "9,000,000 views", "2:10"),
              renderer("d4", "Elden Ring Let's Play Part 1", "500,000 views", "45:00"),
              renderer("e5", "Minecraft let's play", "9,999,999 views", "30:00"),
            ],
          },
        },
      ],
    },
  },
})};</script></html>`;

const filter = {
  minDurationMinutes: 8,
  excludePattern: "no commentary|nocommentary|no talking|without commentary|trailer|soundtrack|\\bost\\b",
  maxCandidates: 2,
};

describe("YouTube let's-play discovery", () => {
  it("parses search results", () => {
    const videos = parseSearchHtml(html);
    expect(videos).toHaveLength(5);
    expect(videos[0]).toMatchObject({ id: "a1", views: 7697718, durationSec: 42395, channel: "Chan" });
  });

  it("prefers the most viewed commentated, relevant, long-enough video", () => {
    const picked = pickCandidates("Elden Ring", parseSearchHtml(html), filter);
    expect(picked.map((v) => v.id)).toEqual(["b2", "d4"]);
  });

  it("parses counters and durations", () => {
    expect(parseViews("1,234 views")).toBe(1234);
    expect(parseViews(undefined)).toBe(0);
    expect(parseDuration("1:02:03")).toBe(3723);
    expect(parseDuration("45:00")).toBe(2700);
  });

  it("checks title relevance", () => {
    expect(isRelevant("The Legend of Zelda: Tears of the Kingdom", "Zelda Tears of the Kingdom let's play #1")).toBe(true);
    expect(isRelevant("Hades II", "Minecraft let's play")).toBe(false);
    expect(isRelevant("Planted!", "Spring Has Sprung! | Gets Planted | Full Episode | The Magic School Bus")).toBe(false);
    expect(isRelevant("Planted!", "Planted Gameplay Part 1")).toBe(true);
  });

  it("keeps the clip inside the video and tracks the daily budget", () => {
    expect(clipWindow(3600, 120, 180)).toEqual({ start: 120, end: 300 });
    expect(clipWindow(200, 120, 180)).toEqual({ start: 20, end: 200 });
    expect(remainingBudgetSec(21_500, 360)).toBe(100);
    expect(remainingBudgetSec(30_000, 360)).toBe(0);
  });

  it("returns nothing for pages without data", () => {
    expect(parseSearchHtml("<html></html>")).toEqual([] as VideoCandidate[]);
  });
});
