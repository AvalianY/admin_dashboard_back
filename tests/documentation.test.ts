import { describe, expect, it } from "vitest";
import request from "supertest";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { FormatsPlugin } from "ajv-formats";
import { Types } from "mongoose";
import { createApp } from "../src/app.js";
import { openapi } from "../src/openapi.js";

const app = createApp({ nodeEnv: "test", port: 3000, mongodbUri: "mongodb://127.0.0.1/unused_documentation_test", jwtSecret: "documentation-test-key-with-at-least-32-characters", corsOrigins: ["http://localhost:3000"] });
const methodNames = new Set(["get", "post", "put", "patch", "delete"]);
const operations = () => Object.entries(openapi.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, value]) => ({ path, method, value })));

describe("public Swagger documentation with unchanged API protection", () => {
  it("opens the HTML through the canonical trailing-slash URL", async () => {
    const result = await request(app).get("/api-docs").redirects(1);
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toMatch(/text\/html/);
    expect(result.text).toContain("E-Pharmacy API Documentation");
    expect(result.text).toContain('id="swagger-ui"');
    expect(result.text).toContain('./swagger-ui-bundle.js');
    expect(result.headers["content-security-policy"]).toContain("script-src 'self'");
    expect(result.headers["content-security-policy"]).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
  it.each([
    ["swagger-ui.css", /text\/css/],
    ["swagger-ui-bundle.js", /javascript/],
    ["swagger-ui-standalone-preset.js", /javascript/],
    ["swagger-ui-init.js", /javascript/],
    ["favicon-32x32.png", /image\/png/],
  ])("serves the local interface resource %s", async (file, type) => {
    const result = await request(app).get(`/api-docs/${file}`);
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toMatch(type as RegExp);
  });
  it("loads the existing specification and keeps exactly fifteen business operations", async () => {
    const result = await request(app).get("/api-docs/openapi.json");
    expect(result.status).toBe(200);
    expect(result.body).toEqual(openapi);
    expect(result.body).toEqual(JSON.parse(await readFile("docs/openapi.json", "utf8")));
    expect(operations()).toHaveLength(15);
    expect(operations().every(({ method }) => methodNames.has(method))).toBe(true);
    expect(Object.keys(result.body.paths).some((path) => path.startsWith("/api-docs"))).toBe(false);
    expect(result.body.servers).toEqual([{ url: "/", description: "Current API server" }]);
    expect(result.headers["cache-control"]).toBe("no-store");
  });
  it("groups operations and retains the current Bearer security scheme", () => {
    expect(openapi.tags).toHaveLength(6);
    expect(openapi.components.securitySchemes.bearerAuth).toMatchObject({ type: "http", scheme: "bearer", bearerFormat: "JWT" });
    const ids: string[] = [];
    for (const { path, method, value } of operations()) {
      const op = value as unknown as { tags: string[]; operationId: string; security: unknown };
      expect(op.tags).toHaveLength(1);
      expect(openapi.tags.map((tag) => tag.name)).toContain(op.tags[0]);
      expect(op.security).toEqual(path === "/api/user/login" && method === "post" ? [] : [{ bearerAuth: [] }]);
      ids.push(op.operationId);
    }
    expect(new Set(ids).size).toBe(15);
  });
  it("does not persist or preauthorize tokens and offers standard Try it out", async () => {
    const result = await request(app).get("/api-docs/swagger-ui-init.js");
    expect(result.text).toContain('"url": "/api-docs/openapi.json"');
    expect(result.text).toContain('"persistAuthorization": false');
    expect(result.text).toContain('"tryItOutEnabled": false');
    expect(result.text).toContain('"validatorUrl": null');
    expect(result.text).not.toContain('"supportedSubmitMethods": []');
    expect(result.text).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    expect(result.text).not.toMatch(/mongodb(?:\+srv)?:\/\//);
  });
  it("preserves allowed origins, rejected origins and protected business routes", async () => {
    const allowed = await request(app).get("/api-docs/openapi.json").set("Origin", "http://localhost:3000");
    expect(allowed.status).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    const denied = await request(app).get("/api-docs/openapi.json").set("Origin", "https://unapproved.example.test");
    expect(denied.status).toBe(403);
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    expect(denied.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
    const protectedResponse = await request(app).get("/api/products").set("Origin", "http://localhost:3000");
    expect(protectedResponse.status).toBe(401);
    expect(protectedResponse.headers["www-authenticate"]).toBe('Bearer realm="e-pharmacy"');
    expect((await request(app).get("/api-docs/unapproved-path")).status).toBe(404);
  });
  it("provides synthetic examples that conform to the same request/response schemas", () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    const addFormats = createRequire(import.meta.url)("ajv-formats") as FormatsPlugin;
    addFormats(ajv);
    ajv.addFormat("decimal128", (s: string) => { try { Types.Decimal128.fromString(s); return true; } catch { return false; } });
    const validate = (schema: unknown, example: unknown) => {
      const compiled = ajv.compile({ ...(schema as Record<string, unknown>), components: openapi.components });
      expect(compiled(example), JSON.stringify(compiled.errors)).toBe(true);
    };
    for (const { value } of operations()) {
      const op = value as unknown as { requestBody?: { content: Record<string, { schema: unknown; example: unknown }> }; responses: Record<string, { content?: Record<string, { schema: unknown; example: unknown }> }> };
      if (op.requestBody) for (const media of Object.values(op.requestBody.content)) validate(media.schema, media.example);
      for (const response of Object.values(op.responses)) if (response.content) for (const media of Object.values(response.content)) validate(media.schema, media.example);
    }
    expect(JSON.stringify(openapi)).not.toMatch(/mongodb(?:\+srv)?:\/\//);
    expect(JSON.stringify(openapi)).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });
});
