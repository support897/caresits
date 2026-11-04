import { describe, expect, it } from "vitest";
import { allDicts } from "@cc/core";
import "./i18n";

describe("CareSpace translations", () => {
  it("registers key care flows in all six non-English languages", () => {
    const dictionaries = allDicts();
    const keys = ["cs.welcome.dayOne", "cs.chats.filter.requests", "cs.today.ask", "cs.today.sendUpdate", "cs.calendar.timeoff", "cs.offline.banner"];
    for (const language of ["es", "ar", "hi", "vi", "yue", "zh"] as const) {
      for (const key of keys) expect(dictionaries[language]?.[key]).toBeTruthy();
    }
  });
});
