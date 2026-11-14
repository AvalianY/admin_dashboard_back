import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app.js";
import { initializeUser } from "../src/modules/auth/service.js";
import { User, Session } from "../src/modules/auth/models.js";
import { Customer } from "../src/modules/customers/model.js";
import { Product } from "../src/modules/products/model.js";
import { Supplier } from "../src/modules/suppliers/model.js";
import { Order } from "../src/modules/orders/model.js";
import { Transaction } from "../src/modules/transactions/model.js";
import { importSource } from "./source.js";
import { startDatabase, stopDatabase, config } from "./database.js";

const initialTime = "2026-11-14T01:59:59.999+02:00";
let now = new Date(initialTime);
const app = createApp(config, () => now);
const credentials = { email: "customer-create@example.test", password: "isolated password" };
const input = {
  name: "Created Test Customer",
  email: "customer@example.test",
  address: "Test Address",
  phone: "+491234567890",
  country: "Germany",
};
let token: string;
const create = (body: unknown = input) => request(app)
  .post("/api/customers").auth(token, { type: "bearer" }).send(body as object);

beforeAll(async () => {
  await startDatabase();
  await initializeUser("Customer Creation Test", credentials.email, credentials.password);
  const login = await request(app).post("/api/user/login").send(credentials);
  expect(login.status).toBe(200);
  token = login.body.data.accessToken;
});
beforeEach(async () => {
  now = new Date(initialTime);
  await Promise.all([Customer.deleteMany({}), Order.deleteMany({}), Transaction.deleteMany({})]);
});
afterAll(stopDatabase);

describe("POST /api/customers", () => {
  it("creates a complete DTO with exact zero money and injected UTC timestamps, without import or auth side effects", async () => {
    const users = await User.countDocuments();
    const sessions = await Session.countDocuments();
    const result = await create();
    expect(result.status).toBe(201);
    expect(result.body).toEqual({
      data: {
        ...input,
        id: expect.stringMatching(/^[a-f0-9]{24}$/),
        photo: null,
        registerDate: "2026-11-13",
        spent: "0",
        currency: "EUR",
        createdAt: "2026-11-13T23:59:59.999Z",
        updatedAt: "2026-11-13T23:59:59.999Z",
      },
      meta: { completeness: "complete", missingData: [] },
    });
    const stored = (await Customer.findById(result.body.data.id))!;
    expect(stored._id).toBeInstanceOf(Types.ObjectId);
    expect(stored.spent).toBeInstanceOf(Types.Decimal128);
    expect(stored.spent.toString()).toBe("0");
    expect(stored.createdAt).toEqual(now);
    expect(stored.updatedAt).toEqual(now);
    expect(stored.importedAt).toBeNull();
    const raw = (await Customer.collection.findOne({ _id: stored._id }))!;
    expect(raw).not.toHaveProperty("provenance");
    expect(await User.countDocuments()).toBe(users);
    expect(await Session.countDocuments()).toBe(sessions);
    expect(await Order.countDocuments()).toBe(0);
    expect(await Transaction.countDocuments()).toBe(0);
    const details = await request(app).get(`/api/customers/${stored.id}`).auth(token, { type: "bearer" });
    expect(details.status).toBe(200);
    expect(details.body.data.history).toEqual([]);
  });

  it("uses the injected clock on both sides of UTC midnight", async () => {
    const before = await create();
    now = new Date(now.getTime() + 1);
    const after = await create();
    expect(before.status).toBe(201);
    expect(after.status).toBe(201);
    expect(before.body.data.registerDate).toBe("2026-11-13");
    expect(after.body.data.registerDate).toBe("2026-11-14");
    expect(after.body.data.createdAt).toBe("2026-11-14T00:00:00.000Z");
    expect(after.body.data.updatedAt).toBe(after.body.data.createdAt);
  });

  it.each(["omitted", "null", "padded"])("handles %s country with the existing completeness rules", async (variant) => {
    const required = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "country"));
    const body = variant === "omitted" ? required : { ...required, country: variant === "null" ? null : " Germany " };
    const result = await create(body);
    expect(result.status).toBe(201);
    const expected = variant === "padded" ? "Germany" : null;
    expect(result.body.data.country).toBe(expected);
    expect((await Customer.findById(result.body.data.id))!.country).toBe(expected);
    expect(result.body.meta).toEqual(expected === null
      ? { completeness: "partial", missingData: ["customers.country"] }
      : { completeness: "complete", missingData: [] });
  });

  it.each(["name", "email", "address", "phone"])("rejects missing required %s without writing a customer", async (field) => {
    const body = Object.fromEntries(Object.entries(input).filter(([key]) => key !== field));
    const result = await create(body);
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
    expect(await Customer.countDocuments()).toBe(0);
  });

  it.each(["name", "email", "address", "phone"])("rejects empty, whitespace-only and non-string %s", async (field) => {
    for (const value of ["", " \t\n", null, 123]) {
      const result = await create({ ...input, [field]: value });
      expect(result.status).toBe(400);
      expect(result.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await Customer.countDocuments()).toBe(0);
  });

  it.each(["invalid", "customer@example", " customer@example.test ", "a..b@example.test"])("rejects invalid email %s", async (email) => {
    expect((await create({ ...input, email })).status).toBe(400);
    expect(await Customer.countDocuments()).toBe(0);
  });

  it.each(["", " \t ", 123, false, [], {}])("rejects invalid country %j", async (country) => {
    expect((await create({ ...input, country })).status).toBe(400);
    expect(await Customer.countDocuments()).toBe(0);
  });

  it.each([
    ["id", "000000000000000000000001"],
    ["_id", "000000000000000000000001"],
    ["registerDate", "2000-01-01"],
    ["spent", "1000"],
    ["currency", "BDT"],
    ["photo", "https://example.test/image.png"],
    ["createdAt", "2000-01-01T00:00:00.000Z"],
    ["updatedAt", "2000-01-01T00:00:00.000Z"],
    ["importedAt", "2000-01-01T00:00:00.000Z"],
    ["provenance", { key: "client-controlled" }],
    ["history", []],
    ["orders", []],
    ["orderIds", ["000000000000000000000001"]],
    ["customerId", "000000000000000000000001"],
    ["jwt", "client-controlled"],
    ["accessToken", "client-controlled"],
    ["unexpected", "client-controlled"],
  ])("rejects server-controlled or unknown field %s", async (field, value) => {
    const result = await create({ ...input, [field as string]: value });
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
    expect(await Customer.countDocuments()).toBe(0);
  });

  it("rejects undeclared query parameters and non-object bodies", async () => {
    expect((await create().query({ page: 1 })).status).toBe(400);
    expect((await create([input])).status).toBe(400);
    expect(await Customer.countDocuments()).toBe(0);
  });

  it("allows duplicate emails and does not add arbitrary text or phone constraints", async () => {
    const body = { ...input, name: ` ${"Customer ".repeat(600)} `, address: ` ${"Address ".repeat(600)} `, phone: " phone token ", email: "a@foo-.test" };
    const first = await create(body);
    const second = await create(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).not.toBe(second.body.data.id);
    expect(first.body.data.name).toBe(body.name.trim());
    expect(first.body.data.address).toBe(body.address.trim());
    expect(first.body.data.phone).toBe("phone token");
    expect(await Customer.countDocuments({ email: body.email })).toBe(2);
  });

  it.each(["missing", "invalid"])("requires authentication for a %s token", async (variant) => {
    const operation = request(app).post("/api/customers").send(input);
    if (variant === "invalid") operation.auth("invalid-token", { type: "bearer" });
    const result = await operation;
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("UNAUTHORIZED");
    expect(result.headers["www-authenticate"]).toBe('Bearer realm="e-pharmacy"');
    expect(await Customer.countDocuments()).toBe(0);
  });

  it("rejects a revoked session", async () => {
    const login = await request(app).post("/api/user/login").send(credentials);
    const revoked = login.body.data.accessToken;
    expect((await request(app).get("/api/user/logout").auth(revoked, { type: "bearer" })).status).toBe(204);
    expect((await request(app).post("/api/customers").auth(revoked, { type: "bearer" }).send(input)).status).toBe(401);
    expect(await Customer.countDocuments()).toBe(0);
  });

  it("rejects an expired session", async () => {
    now = new Date(now.getTime() + 60 * 60 * 1000);
    expect((await create()).status).toBe(401);
    expect(await Customer.countDocuments()).toBe(0);
  });

  it("integrates with list/search/five-row pages/detail/PATCH and Dashboard without changing fixture records or inventing history", async () => {
    await importSource(now);
    const originals = await Customer.find().sort({ _id: 1 }).lean();
    const orders = await Order.find().sort({ _id: 1 }).lean();
    const transactions = await Transaction.find().sort({ _id: 1 }).lean();
    const before = await request(app).get("/api/dashboard").auth(token, { type: "bearer" });
    const created = await create();
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const first = await request(app).get("/api/customers?page=1&limit=5").auth(token, { type: "bearer" });
    expect(first.status).toBe(200);
    expect(first.body.data.items).toHaveLength(5);
    expect(first.body.data.items[0].id).toBe(id);
    expect(first.body.meta.pagination).toEqual({ page: 1, limit: 5, total: 89, totalPages: 18 });
    const last = await request(app).get("/api/customers?page=18&limit=5").auth(token, { type: "bearer" });
    expect(last.body.data.items).toHaveLength(4);
    const defaultPage = await request(app).get("/api/customers").auth(token, { type: "bearer" });
    expect(defaultPage.body.data.items).toHaveLength(20);
    expect(defaultPage.body.meta.pagination.limit).toBe(20);
    const search = await request(app).get("/api/customers").query({ name: " created test customer ", limit: 5 }).auth(token, { type: "bearer" });
    expect(search.body.data.items.map((item: { id: string }) => item.id)).toEqual([id]);
    const details = await request(app).get(`/api/customers/${id}`).auth(token, { type: "bearer" });
    expect(details.status).toBe(200);
    expect(details.body.data.customer).toEqual(created.body.data);
    expect(details.body.data.history).toBeNull();
    expect(details.body.meta.missingData).toContain("customerHistory.relationships");
    const updated = await request(app).patch(`/api/customers/${id}`).auth(token, { type: "bearer" }).send({ name: "Updated Test Customer", country: null });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toEqual({ ...created.body.data, name: "Updated Test Customer", country: null });
    const dashboard = await request(app).get("/api/dashboard").auth(token, { type: "bearer" });
    expect(dashboard.body.data.totals).toEqual({ ...before.body.data.totals, customers: 89 });
    expect(dashboard.body.data.last30Days.customers).toBe(before.body.data.last30Days.customers + 1);
    expect(dashboard.body.data.recentCustomers[0]).toEqual(updated.body.data);
    expect(await Customer.find({ _id: { $in: originals.map((item) => item._id) } }).sort({ _id: 1 }).lean()).toEqual(originals);
    expect(await Order.find().sort({ _id: 1 }).lean()).toEqual(orders);
    expect(await Transaction.find().sort({ _id: 1 }).lean()).toEqual(transactions);
    expect(await Product.countDocuments()).toBe(60);
    expect(await Supplier.countDocuments()).toBe(5);
  });
});
