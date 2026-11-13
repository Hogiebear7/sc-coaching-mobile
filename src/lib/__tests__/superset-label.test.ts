import { describe, expect, it } from "vitest";

import { distinctGroups, supersetLetter, supersetMemberLabel } from "../superset-label";

describe("superset labels", () => {
  it("letters follow the order the supersets appear, whatever the stored label", () => {
    const groups = ["ST3", "ST3", null, "ST1", "ST1", "ST9"];
    expect(distinctGroups(groups)).toEqual(["ST3", "ST1", "ST9"]);
    expect(supersetLetter("ST3", groups)).toBe("A");
    expect(supersetLetter("ST1", groups)).toBe("B");
    expect(supersetLetter("ST9", groups)).toBe("C");
  });

  it("labels the exercises inside a superset A1, A2 ...", () => {
    expect(supersetMemberLabel("ST1", ["ST1", "ST1"], 0)).toBe("A1");
    expect(supersetMemberLabel("ST1", ["ST1", "ST1"], 1)).toBe("A2");
  });

  it("keeps a label it does not know, and runs past Z without breaking", () => {
    expect(supersetLetter("Circuit", ["ST1"])).toBe("Circuit");
    const many = Array.from({ length: 28 }, (_, i) => `ST${i + 1}`);
    expect(supersetLetter("ST26", many)).toBe("Z");
    expect(supersetLetter("ST27", many)).toBe("AA");
    expect(supersetLetter("ST28", many)).toBe("AB");
  });
});
