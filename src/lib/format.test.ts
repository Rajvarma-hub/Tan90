import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatSetpoint,
  formatSpan,
  formatTime,
  humanize,
  parseUtc,
} from "@/lib/format";

describe("parseUtc", () => {
  it("treats a naive backend timestamp as UTC", () => {
    expect(parseUtc("2026-11-14T12:38:00").toISOString()).toBe("2026-11-14T12:38:00.000Z");
  });

  it("keeps an explicit zone", () => {
    expect(parseUtc("2026-11-14T12:38:00Z").toISOString()).toBe("2026-11-14T12:38:00.000Z");
    expect(parseUtc("2026-11-14T18:08:00+05:30").toISOString()).toBe("2026-11-14T12:38:00.000Z");
  });
});

describe("date formatting", () => {
  it("shows Indian time for a UTC timestamp", () => {
    expect(formatDate("2026-11-14T12:38:00")).toBe("14 Nov 2026");
    expect(formatTime("2026-11-14T12:38:00")).toMatch(/^6:08\sPM$/);
    expect(formatDateTime("2026-11-14T12:38:00")).toMatch(/^14 Nov 2026, 6:08\sPM$/);
  });

  it("rolls the date over in India", () => {
    expect(formatDate("2026-11-14T20:00:00")).toBe("15 Nov 2026");
  });

  it("shows a dash when there is no value", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatTime(undefined)).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });
});

describe("formatSpan", () => {
  it("picks minutes, hours or days", () => {
    expect(formatSpan(12 * 60_000)).toBe("12 min");
    expect(formatSpan(60 * 60_000)).toBe("1 hour");
    expect(formatSpan(5 * 3_600_000)).toBe("5 hours");
    expect(formatSpan(48 * 3_600_000)).toBe("2 days");
  });

  it("never goes negative", () => {
    expect(formatSpan(-5_000)).toBe("0 min");
  });

  it("measures from a timestamp", () => {
    const now = Date.parse("2026-11-14T15:00:00Z");
    expect(formatDuration("2026-11-14T12:00:00", now)).toBe("3 hours");
  });
});

describe("formatSetpoint", () => {
  it("signs positive temperatures only", () => {
    expect(formatSetpoint(5)).toBe("+5 °C");
    expect(formatSetpoint(-18)).toBe("-18 °C");
    expect(formatSetpoint(0)).toBe("0 °C");
    expect(formatSetpoint(null)).toBe("—");
  });
});

describe("humanize", () => {
  it("turns a constant into a sentence", () => {
    expect(humanize("INTERNAL_TRANSFER")).toBe("Internal transfer");
  });
});
