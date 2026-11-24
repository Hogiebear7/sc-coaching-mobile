import { describe, expect, it } from "vitest";

import { dateDividerLabel, withDateDividers } from "../chat-dates";

// Tuesday 24 Nov 2026, 10:37 local time.
const NOW = new Date(2026, 10, 24, 10, 37);
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe("dateDividerLabel", () => {
  it("says Today and Yesterday", () => {
    expect(dateDividerLabel(at(2026, 11, 24, 9), NOW)).toBe("Today");
    expect(dateDividerLabel(at(2026, 11, 23, 23), NOW)).toBe("Yesterday");
  });

  it("uses the weekday within the last week and a full date after that", () => {
    expect(dateDividerLabel(at(2026, 11, 20), NOW)).toBe("Friday");
    expect(dateDividerLabel(at(2026, 11, 17), NOW)).toBe("17 November 2026");
    expect(dateDividerLabel(at(2026, 10, 22), NOW)).toBe("22 October 2026");
  });

  it("returns nothing for a bad date", () => {
    expect(dateDividerLabel("nope", NOW)).toBe("");
  });
});

describe("withDateDividers", () => {
  it("puts one divider before the first message of each day", () => {
    const msgs = [
      { id: "a", at: at(2026, 10, 22, 9) },
      { id: "b", at: at(2026, 10, 22, 18) },
      { id: "c", at: at(2026, 11, 24, 11) },
    ];
    const items = withDateDividers(msgs, (m) => m.at, (m) => m.id, NOW);
    expect(items.map((i) => (i.kind === "divider" ? `D:${i.label}` : i.key))).toEqual(["D:22 October 2026", "a", "b", "D:Today", "c"]);
  });

  it("skips the divider for a message with no usable date", () => {
    const items = withDateDividers([{ id: "x", at: "" }], (m) => m.at, (m) => m.id, NOW);
    expect(items.map((i) => i.kind)).toEqual(["message"]);
  });
});
