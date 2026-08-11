import { describe, expect, it } from "vitest";
import { StayDetector } from "../src/services/stay-detector";

describe("StayDetector", () => {
  it("detects a stay of 5+ minutes within 50m", () => {
    const detector = new StayDetector();
    const base = Date.parse("2026-08-11T00:00:00.000Z");

    const positions = Array.from({ length: 6 }, (_, i) => ({
      latitude: 35.681236 + i * 0.00001,
      longitude: 139.767125,
      recorded_at: new Date(base + i * 60_000).toISOString(),
    }));

    const stays = detector.detect(positions);
    expect(stays).toHaveLength(1);
    expect(stays[0].duration_seconds).toBe(300);
  });

  it("ignores short clusters", () => {
    const detector = new StayDetector();
    const base = Date.parse("2026-08-11T00:00:00.000Z");

    const positions = [
      {
        latitude: 35.681236,
        longitude: 139.767125,
        recorded_at: new Date(base).toISOString(),
      },
      {
        latitude: 35.681237,
        longitude: 139.767126,
        recorded_at: new Date(base + 60_000).toISOString(),
      },
    ];

    expect(detector.detect(positions)).toHaveLength(0);
  });
});
