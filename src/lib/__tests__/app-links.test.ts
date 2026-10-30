import { describe, expect, it } from "vitest";

import { routeFromAppLink } from "../widgets/app-links";

describe("widget app links", () => {
  it("opens the screens the widgets and Live Activities link to", () => {
    expect(routeFromAppLink("sccoachingmobile://nutrition")).toBe("/nutrition");
    expect(routeFromAppLink("sccoachingmobile:///schedule")).toBe("/schedule");
    expect(routeFromAppLink("sccoachingmobile://log-workout?x=1")).toBe("/log-workout");
  });
  it("ignores anything else", () => {
    expect(routeFromAppLink("sccoachingmobile://")).toBeNull();
    expect(routeFromAppLink("sccoachingmobile://settings")).toBeNull();
    expect(routeFromAppLink("https://evil.example/nutrition")).toBeNull();
  });
});
