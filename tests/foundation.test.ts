import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { completeness } from "../src/shared/completeness.js";
import { isCalendarDate, utcPeriods } from "../src/shared/dates.js";

describe("foundation", () => {
  it("validates configuration without exposing values", () => {
    expect(() =>
      loadConfig({
        MONGODB_URI: "private-value",
        JWT_SECRET: "private-secret",
      }),
    ).toThrow("Invalid configuration: MONGODB_URI, JWT_SECRET");
    const config = loadConfig({
      MONGODB_URI: "mongodb://127.0.0.1/test",
      JWT_SECRET: "x".repeat(32),
      CORS_ORIGINS: "http://localhost:5173",
    });
    expect(config.port).toBe(3000);
    expect(config.corsOrigins).toEqual(["http://localhost:5173"]);
    expect(() =>
      loadConfig({
        MONGODB_URI: config.mongodbUri,
        JWT_SECRET: config.jwtSecret,
        CORS_ORIGINS: "*",
      }),
    ).toThrow();
  });
  it("uses 30 inclusive UTC calendar dates across month/year boundaries", () => {
    expect(utcPeriods(new Date("2026-01-01T23:59:59Z")).last30Days).toEqual({
      from: "2025-12-03T00:00:00.000Z",
      toExclusive: "2026-01-02T00:00:00.000Z",
      timeZone: "UTC",
    });
    expect(utcPeriods(new Date("2026-11-09T00:00:00Z")).today).toBe(
      "2026-11-09",
    );
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2023-02-29")).toBe(false);
  });
  it("accepts the assigned production port and an empty initial browser-origin list", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      PORT: "10000",
      MONGODB_URI: "mongodb://127.0.0.1/e_pharmacy_isolated_test",
      JWT_SECRET: "isolated-deployment-test-key-at-least-32-characters",
      CORS_ORIGINS: "",
    });
    expect(config.nodeEnv).toBe("production");
    expect(config.port).toBe(10000);
    expect(config.corsOrigins).toEqual([]);
  });
  it("keeps unknown distinct from confirmed absence", () => {
    expect(completeness()).toEqual({
      completeness: "complete",
      missingData: [],
    });
    expect(completeness(["dates", "dates"])).toEqual({
      completeness: "partial",
      missingData: ["dates"],
    });
  });
});
