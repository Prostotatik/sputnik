import { describe, expect, it } from "vitest";
import { isPlaceholderPoint, realPoints } from "./opinions";

describe("isPlaceholderPoint", () => {
  it("drops points that only say there is nothing to dislike", () => {
    for (const t of ["No negative feedback", "Lacks criticism in review", "No technical issues mentioned", "No major complaints", "None noted drawbacks"]) {
      expect(isPlaceholderPoint(t)).toBe(true);
    }
  });

  it("keeps real complaints that start with no", () => {
    for (const t of ["No multiplayer", "No save anywhere", "Too easy", "Missing photo mode"]) {
      expect(isPlaceholderPoint(t)).toBe(false);
    }
    expect(realPoints(["Too easy", "No negative feedback"])).toEqual(["Too easy"]);
  });

  it("handles Russian placeholders and keeps Russian complaints", () => {
    for (const t of ["Нет негативных отзывов", "Отсутствие критики", "Без существенных минусов", "Жалоб не отмечено", "Никаких претензий"]) {
      expect(isPlaceholderPoint(t)).toBe(true);
    }
    for (const t of ["Нет мультиплеера", "Без сохранений в любой точке", "Слишком легко"]) {
      expect(isPlaceholderPoint(t)).toBe(false);
    }
  });
});
