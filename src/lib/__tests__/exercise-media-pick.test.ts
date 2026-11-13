import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({}) }));
vi.mock("@/lib/api-client", () => ({ apiFetch: () => Promise.resolve({}) }));

import { pickHeroMedia, pickOwnVideo, pickThumbMedia, type ExerciseMediaRecord } from "../queries/exercise-library";

function media(resolution: string | null): ExerciseMediaRecord {
  return { id: `m-${resolution}`, exerciseId: "e1", kind: "gif", resolution, storagePath: `p/${resolution}`, url: `https://x/${resolution}.gif`, width: null, height: null, bytes: null, createdAt: "2026-01-01" } as ExerciseMediaRecord;
}

describe("pickHeroMedia", () => {
  it("takes the biggest render when only 180 and 360 exist (listed smallest first, as the server does)", () => {
    expect(pickHeroMedia([media("180"), media("360")])?.resolution).toBe("360");
  });

  it("still prefers 720, then 1080, when they are added later", () => {
    expect(pickHeroMedia([media("180"), media("360"), media("1080"), media("720")])?.resolution).toBe("720");
    expect(pickHeroMedia([media("180"), media("360"), media("1080")])?.resolution).toBe("1080");
  });

  it("copes with an untagged render and with nothing at all", () => {
    expect(pickHeroMedia([media(null)])?.resolution).toBeNull();
    expect(pickHeroMedia([])).toBeNull();
  });
});

describe("pickThumbMedia", () => {
  it("uses the smallest render that is wide enough for a thumbnail", () => {
    expect(pickThumbMedia([media("180"), media("360")])?.resolution).toBe("180");
    expect(pickThumbMedia([media("360"), media("720")])?.resolution).toBe("360");
  });

  it("falls back to the biggest when all are small, and to null when empty", () => {
    expect(pickThumbMedia([media("100")])?.resolution).toBe("100");
    expect(pickThumbMedia([])).toBeNull();
  });
});

describe("own clips", () => {
  const clip = { ...media("own"), kind: "video", url: "https://x/clip.mp4" } as ExerciseMediaRecord;

  it("the pictures never pick a video, and the clip is found on its own", () => {
    const all = [media("180"), media("360"), clip];
    expect(pickHeroMedia(all)?.resolution).toBe("360");
    expect(pickThumbMedia(all)?.resolution).toBe("180");
    expect(pickOwnVideo(all)?.url).toBe("https://x/clip.mp4");
  });

  it("an exercise with only a clip has no picture, and one with no clip has no video", () => {
    expect(pickHeroMedia([clip])).toBeNull();
    expect(pickThumbMedia([clip])).toBeNull();
    expect(pickOwnVideo([media("360")])).toBeNull();
  });
});
