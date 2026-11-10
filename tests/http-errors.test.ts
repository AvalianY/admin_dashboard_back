import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { gzipSync } from "node:zlib";
import { mongo, Types } from "mongoose";
import { Ajv2020 } from "ajv/dist/2020.js";
import { createApp } from "../src/app.js";
import { initializeUser } from "../src/modules/auth/service.js";
import { Product } from "../src/modules/products/model.js";
import { Customer } from "../src/modules/customers/model.js";
import { openapi } from "../src/openapi.js";
import { startDatabase, stopDatabase, config } from "./database.js";

const app = createApp(config);
const input = { email: "errors@example.test", password: "isolated password" };
const validError = new Ajv2020({ strict: false }).compile(
  openapi.components.schemas.Error,
);
let token: string;
beforeAll(async () => {
  await startDatabase();
  await initializeUser("HTTP Errors", input.email, input.password);
  token = (await request(app).post("/api/user/login").send(input)).body.data.accessToken;
});

describe("unexpected error diagnostics", () => {
  it("logs a safe database failure event and keeps the response sanitized", async () => {
    const sensitive = ["never-log-password", "never-log-hash", "mongodb://user:secret@private.invalid/db", "private-customer-name"];
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const database = vi.spyOn(Product, "find").mockImplementationOnce(() => {
      throw new mongo.MongoServerError({ message: sensitive.join(" ") });
    });
    try {
      const result = await request(app).get("/api/products")
        .query({ sortBy: "name", name: sensitive[3] })
        .auth(token, { type: "bearer" }).send({ password: sensitive[0] });
      expect(result.status).toBe(500);
      expect(validError(result.body)).toBe(true);
      expect(logger).toHaveBeenCalledTimes(1);
      const logged = JSON.stringify(logger.mock.calls);
      const event = JSON.parse(logger.mock.calls[0][0] as string);
      expect(event).toEqual({ event: "http_request_failed", method: "GET", route: "/api/products", status: 500, errorCategory: "database" });
      for (const value of [...sensitive, token, input.password]) {
        expect(logged).not.toContain(value);
        expect(result.text).not.toContain(value);
      }
    } finally {
      database.mockRestore();
      logger.mockRestore();
    }
  });
  it("uses the route template without logging a customer identifier", async () => {
    const id = new Types.ObjectId().toString();
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const database = vi.spyOn(Customer, "findById").mockImplementationOnce(() => {
      throw new Error("private customer details");
    });
    try {
      const result = await request(app).get(`/api/customers/${id}`)
        .auth(token, { type: "bearer" });
      expect(result.status).toBe(500);
      expect(logger).toHaveBeenCalledTimes(1);
      expect(JSON.parse(logger.mock.calls[0][0] as string).route).toBe("/api/customers/:customerId");
      expect(JSON.stringify(logger.mock.calls)).not.toContain(id);
    } finally {
      database.mockRestore();
      logger.mockRestore();
    }
  });
  it("does not label expected validation, parser or authentication errors as server failures", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect((await request(app).post("/api/products").auth(token, { type: "bearer" }).send({ name: " " })).status).toBe(400);
      expect((await request(app).post("/api/user/login").set("Content-Type", "application/json").send("{")).status).toBe(400);
      expect((await request(app).post("/api/user/login").set("Content-Type", "application/json; charset=iso-8859-1").send("{}")).status).toBe(415);
      expect((await request(app).get("/api/dashboard")).status).toBe(401);
      expect(logger).not.toHaveBeenCalled();
    } finally {
      logger.mockRestore();
    }
  });
  it("returns a sanitized 500 even when the logging facility throws", async () => {
    const logger = vi.spyOn(console, "error").mockImplementationOnce(() => {
      throw new Error("logging unavailable");
    });
    const database = vi.spyOn(Product, "find").mockImplementationOnce(() => {
      throw new Error("private database failure");
    });
    try {
      const result = await request(app).get("/api/products").query({ sortBy: "name" })
        .auth(token, { type: "bearer" });
      expect(result.status).toBe(500);
      expect(validError(result.body)).toBe(true);
      expect(result.body.error.code).toBe("INTERNAL_ERROR");
      expect(result.text).not.toMatch(/private|logging unavailable/);
      expect(logger).toHaveBeenCalledTimes(1);
    } finally {
      database.mockRestore();
      logger.mockRestore();
    }
  });
});
afterAll(stopDatabase);

async function compressedRequest(body: Buffer) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test listener");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
      body: new Uint8Array(body),
    });
    const text = await response.text();
    return { status: response.status, body: JSON.parse(text), text };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

describe("HTTP request parsing", () => {
  it.each(["{", "true"])("rejects malformed or unsupported JSON shape: %s", async (body) => {
    const result = await request(app).post("/api/user/login")
      .set("Content-Type", "application/json").send(body);
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("INVALID_JSON");
    expect(validError(result.body)).toBe(true);
  });
  it.each([
    ["Content-Type", "application/json; charset=iso-8859-1"],
    ["Content-Encoding", "unsupported-audit-encoding"],
  ])("rejects unsupported request format: %s", async (header, value) => {
    const result = await request(app).post("/api/user/login")
      .set("Content-Type", "application/json").set(header, value)
      .send(JSON.stringify(input));
    expect(result.status).toBe(415);
    expect(result.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(validError(result.body)).toBe(true);
    expect(result.text).not.toContain(value);
  });
  it("returns 400 for a corrupt body using a supported compression", async () => {
    const result = await compressedRequest(Buffer.from("not a valid gzip stream"));
    expect(result.status).toBe(400);
    expect(validError(result.body)).toBe(true);
    expect(result.text).not.toContain("gzip stream");
  });
  it("preserves the 100 KB request limit", async () => {
    const result = await request(app).post("/api/user/login")
      .send({ ...input, password: "x".repeat(110 * 1024) });
    expect(result.status).toBe(413);
    expect(result.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(validError(result.body)).toBe(true);
  });
  it("applies the same limit to the decompressed JSON body", async () => {
    const body = JSON.stringify({ ...input, password: "x".repeat(110 * 1024) });
    const result = await compressedRequest(gzipSync(Buffer.from(body)));
    expect(result.status).toBe(413);
    expect(result.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(validError(result.body)).toBe(true);
  });
  it("accepts valid JSON", async () => {
    expect((await request(app).post("/api/user/login").send(input)).status).toBe(200);
  });
  it("accepts a valid supported compressed JSON body", async () => {
    const result = await compressedRequest(gzipSync(Buffer.from(JSON.stringify(input))));
    expect(result.status).toBe(200);
  });
  it("does not classify an unexpected application exception as a parser error", async () => {
    const spy = vi.spyOn(Product, "find").mockImplementationOnce(() => {
      throw Object.assign(new Error("private database credentials"), { status: 400 });
    });
    try {
      const result = await request(app).get("/api/products")
        .query({ sortBy: "name" }).auth(token, { type: "bearer" });
      expect(result.status).toBe(500);
      expect(result.body.error.code).toBe("INTERNAL_ERROR");
      expect(validError(result.body)).toBe(true);
      expect(result.text).not.toContain("credentials");
    } finally {
      spy.mockRestore();
    }
  });
});
