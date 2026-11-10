import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createRequire } from "node:module";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { FormatsPlugin } from "ajv-formats";
import { createApp } from "../src/app.js";
import { openapi } from "../src/openapi.js";
import { initializeUser } from "../src/modules/auth/service.js";
import { Product } from "../src/modules/products/model.js";
import { Supplier } from "../src/modules/suppliers/model.js";
import { Customer } from "../src/modules/customers/model.js";
import { importSource } from "./source.js";
import { startDatabase, stopDatabase, config } from "./database.js";

const app = createApp(config);
const ajv = new Ajv2020({ strict: false, allErrors: true });
const addFormats = createRequire(import.meta.url)("ajv-formats") as FormatsPlugin;
addFormats(ajv);
ajv.addFormat("decimal128", (value: string) => {
  try {
    Types.Decimal128.fromString(value);
    return true;
  } catch {
    return false;
  }
});
ajv.addSchema(openapi, "urn:epharmacy:requests");
const credentials = { email: "requests@example.test", password: "isolated password" };
let token: string, productId: string, supplierId: string, customerId: string;
beforeAll(async () => {
  await startDatabase();
  await initializeUser("Request Contracts", credentials.email, credentials.password);
  await importSource();
  token = (await request(app).post("/api/user/login").send(credentials)).body.data.accessToken;
  productId = (await Product.findOne())!.id;
  supplierId = (await Supplier.findOne())!.id;
  customerId = (await Customer.findOne())!.id;
});
afterAll(stopDatabase);

const pointer = (path: string) => path.replaceAll("~", "~0").replaceAll("/", "~1");
function requestValid(path: string, method: string, body: unknown) {
  return ajv.compile({
    $ref: `urn:epharmacy:requests#/paths/${pointer(path)}/${method}/requestBody/content/application~1json/schema`,
  })(body);
}
function responseValid(path: string, method: string, status: number, body: unknown) {
  const valid = ajv.compile({
    $ref: `urn:epharmacy:requests#/paths/${pointer(path)}/${method}/responses/${status}/content/application~1json/schema`,
  });
  expect(valid(body), JSON.stringify(valid.errors)).toBe(true);
}
const product = { name: "Product", category: "Medicine", stock: 1, suppliers: "Supplier", price: "1.25" };
const supplier = { name: "Supplier", address: "Address", company: "Company", deliveryDate: "2026-11-09", amount: "1.25", status: "Active" };
interface Target {
  path: string;
  method: "post" | "put" | "patch";
  url: () => string;
  body: Record<string, unknown>;
  fields: string[];
  status: number;
}
const targets: Target[] = [
  { path: "/api/products", method: "post", url: () => "/api/products", body: product, fields: ["name", "suppliers"], status: 201 },
  { path: "/api/products/{productId}", method: "put", url: () => `/api/products/${productId}`, body: product, fields: ["name", "suppliers"], status: 200 },
  { path: "/api/suppliers", method: "post", url: () => "/api/suppliers", body: supplier, fields: ["name", "address", "company"], status: 201 },
  { path: "/api/suppliers/{supplierId}", method: "put", url: () => `/api/suppliers/${supplierId}`, body: supplier, fields: ["name", "address", "company"], status: 200 },
  { path: "/api/customers/{customerId}", method: "patch", url: () => `/api/customers/${customerId}`, body: {}, fields: ["name", "address", "phone", "country"], status: 200 },
];

describe("OpenAPI request and response parity", () => {
  it.each(targets.flatMap((target) => target.fields.map((field) => ({ ...target, field }))))(
    "$method $path trims and validates $field consistently",
    async (target) => {
      for (const [value, accepted] of [[" \t\n\u00a0\ufeff", false], [" Padded value ", true]] as const) {
        const body = { ...target.body, [target.field]: value };
        expect(requestValid(target.path, target.method, body)).toBe(accepted);
        const result = await request(app)[target.method](target.url()).auth(token, { type: "bearer" }).send(body);
        expect(result.status).toBe(accepted ? target.status : 400);
        responseValid(target.path, target.method, result.status, result.body);
        if (accepted) expect(result.body.data[target.field]).toBe(value.trim());
      }
    },
  );
  it.each([
    { email: "REQUESTS@example.test", accepted: true },
    { email: "user@example", accepted: false },
    { email: " requests@example.test ", accepted: false },
    { email: "a..b@example.test", accepted: false },
  ])("matches email validation for $email", async ({ email, accepted }) => {
    const body = { ...credentials, email };
    expect(requestValid("/api/user/login", "post", body)).toBe(accepted);
    const result = await request(app).post("/api/user/login").send(body);
    expect(result.status).toBe(accepted ? 200 : 400);
    responseValid("/api/user/login", "post", result.status, result.body);
  });
  it("preserves whitespace in passwords instead of applying text normalization", async () => {
    const body = { ...credentials, password: " " };
    expect(requestValid("/api/user/login", "post", body)).toBe(true);
    const result = await request(app).post("/api/user/login").send(body);
    expect(result.status).toBe(401);
    responseValid("/api/user/login", "post", 401, result.body);
  });
  it.each(["a@foo-.test", "a@foo--.test"])(
    "describes the existing email pattern without an extra format restriction: %s",
    async (email) => {
      const body = { email };
      const path = "/api/customers/{customerId}";
      expect(requestValid(path, "patch", body)).toBe(true);
      const result = await request(app).patch(`/api/customers/${customerId}`)
        .auth(token, { type: "bearer" }).send(body);
      expect(result.status).toBe(200);
      expect(result.body.data.email).toBe(email);
      responseValid(path, "patch", 200, result.body);
    },
  );
  it("documents the actual Bearer challenge on HTTP 401", async () => {
    const result = await request(app).get("/api/user/user-info");
    expect(result.status).toBe(401);
    const validHeader = ajv.compile({
      $ref: `urn:epharmacy:requests#/paths/${pointer("/api/user/user-info")}/get/responses/401/headers/WWW-Authenticate/schema`,
    });
    expect(validHeader(result.headers["www-authenticate"])).toBe(true);
    responseValid("/api/user/user-info", "get", 401, result.body);
  });
  it.each([
    { value: "2028-02-29", accepted: true },
    { value: "2026-02-29", accepted: false },
    { value: "2026-11-09T00:00:00Z", accepted: false },
  ])("matches calendar validation for $value", async ({ value, accepted }) => {
    const body = { ...supplier, deliveryDate: value };
    expect(requestValid("/api/suppliers", "post", body)).toBe(accepted);
    const result = await request(app).post("/api/suppliers").auth(token, { type: "bearer" }).send(body);
    expect(result.status).toBe(accepted ? 201 : 400);
    responseValid("/api/suppliers", "post", result.status, result.body);
  });
  it.each([
    { change: { price: "9007199254740993.01" }, accepted: true },
    { change: { price: "-1" }, accepted: false },
    { change: { price: "1e3" }, accepted: false },
    { change: { price: "12345678901234567890123456789012345" }, accepted: false },
    { change: { price: 1.25 }, accepted: false },
    { change: { stock: Number.MAX_SAFE_INTEGER + 1 }, accepted: false },
    { change: { stock: 1.5 }, accepted: false },
    { change: { category: "Heart" }, accepted: false },
    { change: { deletedAt: null }, accepted: false },
  ])("matches product input validation: $change", async ({ change, accepted }) => {
    const body = { ...product, ...change };
    expect(requestValid("/api/products", "post", body)).toBe(accepted);
    const result = await request(app).post("/api/products").auth(token, { type: "bearer" }).send(body);
    expect(result.status).toBe(accepted ? 201 : 400);
    responseValid("/api/products", "post", result.status, result.body);
  });
  it("documents null only for retaining an existing unknown supplier amount", async () => {
    const source = (await Supplier.findOne({ amount: null }))!;
    const body = { ...supplier, amount: null };
    expect(requestValid("/api/suppliers", "post", body)).toBe(false);
    expect(requestValid("/api/suppliers/{supplierId}", "put", body)).toBe(true);
    const result = await request(app).put(`/api/suppliers/${source.id}`).auth(token, { type: "bearer" }).send(body);
    expect(result.status).toBe(200);
    responseValid("/api/suppliers/{supplierId}", "put", 200, result.body);
    const known = await request(app).put(`/api/suppliers/${supplierId}`).auth(token, { type: "bearer" }).send(body);
    expect(known.status).toBe(400);
    responseValid("/api/suppliers/{supplierId}", "put", 400, known.body);
  });
  it("documents a concurrent supplier monetary change as HTTP 409", async () => {
    const source = (await Supplier.findById(supplierId))!;
    const staleRead = Supplier.findById(supplierId);
    vi.spyOn(staleRead, "exec").mockImplementationOnce(async () => {
      await Supplier.updateOne({ _id: source._id }, {
        $set: { amount: Types.Decimal128.fromString("8.00") },
      });
      return source;
    });
    const readSpy = vi.spyOn(Supplier, "findById").mockReturnValueOnce(staleRead);
    try {
      const result = await request(app).put(`/api/suppliers/${supplierId}`)
        .auth(token, { type: "bearer" }).send({ ...supplier, amount: "9.00" });
      expect(result.status).toBe(409);
      responseValid("/api/suppliers/{supplierId}", "put", 409, result.body);
    } finally {
      readSpy.mockRestore();
    }
    expect((await Supplier.findById(supplierId))!.amount!.toString()).toBe("8.00");
  });
  it.each([
    { body: {}, accepted: false },
    { body: { spent: "0" }, accepted: false },
    { body: { country: null }, accepted: true },
  ])("matches PATCH constraints: $body", async ({ body, accepted }) => {
    const path = "/api/customers/{customerId}";
    expect(requestValid(path, "patch", body)).toBe(accepted);
    const result = await request(app).patch(`/api/customers/${customerId}`).auth(token, { type: "bearer" }).send(body);
    expect(result.status).toBe(accepted ? 200 : 400);
    responseValid(path, "patch", result.status, result.body);
  });
  it.each([
    { status: 400, header: "Content-Type", value: "application/json", body: "{" },
    { status: 413, header: "Content-Type", value: "application/json", body: JSON.stringify({ password: "x".repeat(110 * 1024) }) },
    { status: 415, header: "Content-Type", value: "application/json; charset=iso-8859-1", body: "{}" },
    { status: 415, header: "Content-Encoding", value: "unsupported", body: "{}" },
  ])("documents the actual HTTP $status parser response", async ({ status, header, value, body }) => {
    const result = await request(app).post("/api/user/login").set("Content-Type", "application/json").set(header, value).send(body);
    expect(result.status).toBe(status);
    responseValid("/api/user/login", "post", status, result.body);
  });
});
