import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

const backendOrigin = "https://e-pharmacy-api-kz62.onrender.com";
const blueprint = readFileSync("render.yaml", "utf8");
const configuredOrigin = blueprint
  .match(/- key: CORS_ORIGINS\s*\r?\n\s+value: ([^\r\n]+)/)?.[1]
  .trim()
  .replace(/^(["'])(.*)\1$/, "$2");
const config = loadConfig({
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://127.0.0.1/unused_cors_test",
  JWT_SECRET: "isolated-cors-test-key-with-at-least-32-characters",
  CORS_ORIGINS: configuredOrigin,
});
const app = createApp(config);

describe("production Swagger origin configured through the existing whitelist", () => {
  it("allows only the approved backend origin in the Blueprint", () => {
    expect(configuredOrigin).toBe(backendOrigin);
    expect(config.corsOrigins).toEqual([backendOrigin]);
  });

  it("passes same-origin POST through CORS to request validation", async () => {
    const result = await request(app)
      .post("/api/user/login")
      .set("Origin", backendOrigin)
      .send({});
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
    expect(result.headers["access-control-allow-origin"]).toBe(backendOrigin);
    expect(result.headers.vary).toContain("Origin");
  });

  it("rejects a foreign-origin POST without an allow-origin header", async () => {
    const result = await request(app)
      .post("/api/user/login")
      .set("Origin", "https://unapproved.example.test")
      .send({});
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
    expect(result.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("preserves requests without Origin", async () => {
    const result = await request(app).post("/api/user/login").send({});
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
    expect(result.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers allowed preflight with the exact origin, method and headers", async () => {
    const result = await request(app)
      .options("/api/user/login")
      .set("Origin", backendOrigin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    expect(result.status).toBe(204);
    expect(result.headers["access-control-allow-origin"]).toBe(backendOrigin);
    expect(result.headers["access-control-allow-methods"].split(",")).toContain("POST");
    expect(result.headers["access-control-allow-headers"].toLowerCase().split(",")).toEqual(["authorization", "content-type"]);
    expect(result.text).toBe("");
  });

  it("denies foreign-origin preflight without granting methods or headers", async () => {
    const result = await request(app)
      .options("/api/user/login")
      .set("Origin", "https://unapproved.example.test")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
    expect(result.headers["access-control-allow-origin"]).toBeUndefined();
    expect(result.headers["access-control-allow-methods"]).toBeUndefined();
    expect(result.headers["access-control-allow-headers"]).toBeUndefined();
  });

  it.each([
    "https://e-pharmacy-api-kz62.onrender.com.attacker.example",
    "https://attacker-e-pharmacy-api-kz62.onrender.com",
    "http://e-pharmacy-api-kz62.onrender.com",
    "http://localhost:5173",
    "null",
  ])("rejects unapproved or lookalike origin %s", async (origin) => {
    const result = await request(app)
      .post("/api/user/login")
      .set("Origin", origin)
      .send({});
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
    expect(result.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it.each([undefined, "Bearer documentation-invalid-token"])(
    "keeps JWT protection for an allowed origin with authorization %s",
    async (authorization) => {
      const call = request(app).get("/api/products").set("Origin", backendOrigin);
      if (authorization) call.set("Authorization", authorization);
      const result = await call;
      expect(result.status).toBe(401);
      expect(result.body.error.code).toBe("UNAUTHORIZED");
      expect(result.headers["www-authenticate"]).toBe('Bearer realm="e-pharmacy"');
      expect(result.headers["access-control-allow-origin"]).toBe(backendOrigin);
    },
  );
});
