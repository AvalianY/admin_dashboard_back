import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app.js";
import { initializeUser } from "../src/modules/auth/service.js";
import { Product } from "../src/modules/products/model.js";
import { Supplier } from "../src/modules/suppliers/model.js";
import { Customer } from "../src/modules/customers/model.js";
import { Order } from "../src/modules/orders/model.js";
import { Transaction } from "../src/modules/transactions/model.js";
import { importSource } from "./source.js";
import { startDatabase, stopDatabase, config } from "./database.js";

const now = new Date("2026-11-09T12:00:00Z");
const app = createApp(config, () => now);
let token: string;
const productBody = {
  name: "New product",
  category: "Medicine",
  stock: 0,
  suppliers: "Independent string",
  price: "9007199254740993.01",
};
beforeAll(async () => {
  await startDatabase();
  await initializeUser(
    "Catalog Test",
    "catalog@example.test",
    "isolated password",
  );
  token = (
    await request(app)
      .post("/api/user/login")
      .send({ email: "catalog@example.test", password: "isolated password" })
  ).body.data.accessToken;
});
beforeEach(async () => {
  await Promise.all([
    Product.deleteMany({}),
    Supplier.deleteMany({}),
    Customer.deleteMany({}),
    Order.deleteMany({}),
    Transaction.deleteMany({}),
  ]);
  await importSource();
});
afterAll(stopDatabase);

describe("products", () => {
  it("lists all separate records in stable original order", async () => {
    const result = await request(app)
      .get("/api/products")
      .auth(token, { type: "bearer" });
    expect(result.status).toBe(200);
    expect(result.body.data.items).toHaveLength(60);
    expect(result.body.data.categories).toHaveLength(9);
    expect(result.body.data.categories).not.toContain("Heart");
    const source = await Product.find().sort({ "provenance.index": 1 });
    expect(
      result.body.data.items.map((item: { id: string }) => item.id),
    ).toEqual(source.map((item) => item.id));
  });
  it("creates EUR products with actual timestamps and exact monetary values first", async () => {
    const created = await request(app)
      .post("/api/products")
      .auth(token, { type: "bearer" })
      .send(productBody);
    expect(created.status).toBe(201);
    expect(created.body.data.price).toBe(productBody.price);
    expect(created.body.data.createdAt).toBe(now.toISOString());
    const list = await request(app)
      .get("/api/products")
      .auth(token, { type: "bearer" });
    expect(list.body.data.items[0].id).toBe(created.body.data.id);
  });
  it("implements all L1 transitions and preserves metadata", async () => {
    const legacy = (await Product.findOne({ category: "Heart" }))!;
    const originalKey = legacy.provenance!.key;
    const url = `/api/products/${legacy.id}`;
    const put = (category: string) =>
      request(app)
        .put(url)
        .auth(token, { type: "bearer" })
        .send({ ...productBody, category });
    expect((await put("Heart")).status).toBe(200);
    expect((await put("Leg")).status).toBe(400);
    expect((await put("Medicine")).status).toBe(200);
    expect((await put("Heart")).status).toBe(400);
    const stored = (await Product.findById(legacy.id))!;
    expect(stored.provenance!.key).toBe(originalKey);
    expect(stored.createdAt).toBeNull();
    expect(stored.legacyId).toBe(legacy.legacyId);
    expect(stored.photo).toBe(legacy.photo);
  });
  it("rejects legacy creation, invalid input, unsafe sorts and incomplete PUT", async () => {
    for (const changes of [
      { category: "Heart" },
      { category: "Leg" },
      { stock: -1 },
      { stock: 1.5 },
      { stock: "12" },
      { price: 1.25 },
      { price: "-1" },
      { deletedAt: null },
    ])
      expect(
        (
          await request(app)
            .post("/api/products")
            .auth(token, { type: "bearer" })
            .send({ ...productBody, ...changes })
        ).status,
      ).toBe(400);
    const product = (await Product.findOne())!;
    expect(
      (
        await request(app)
          .put(`/api/products/${product.id}`)
          .auth(token, { type: "bearer" })
          .send({ name: "Incomplete" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get("/api/products")
          .query({ sortBy: "$where" })
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get("/api/products?name[$ne]=x")
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(400);
  });
  it("searches literal substrings and sorts decimals numerically", async () => {
    const literal = await request(app)
      .get("/api/products")
      .query({ name: ".*" })
      .auth(token, { type: "bearer" });
    expect(literal.body.data.items).toEqual([]);
    const nul = await request(app)
      .get("/api/products")
      .query({ name: String.fromCharCode(0) })
      .auth(token, { type: "bearer" });
    expect(nul.status).toBe(200);
    expect(nul.body.data.items).toEqual([]);
    expect(
      (
        await request(app)
          .get("/api/products")
          .query({ name: "DEMO PRODUCT 001" })
          .auth(token, { type: "bearer" })
      ).body.data.items,
    ).toHaveLength(2);
    for (const price of ["120.00", "9.90"])
      await request(app)
        .post("/api/products")
        .auth(token, { type: "bearer" })
        .send({ ...productBody, name: `Sort ${price}`, price });
    const sorted = await request(app)
      .get("/api/products")
      .query({ name: "Sort ", sortBy: "price", sortOrder: "asc" })
      .auth(token, { type: "bearer" });
    expect(
      sorted.body.data.items.map((item: { price: string }) => item.price),
    ).toEqual(["9.90", "120.00"]);
  });
  it("logically deletes without restoring on reimport", async () => {
    const product = (await Product.findOne())!;
    expect(
      (
        await request(app)
          .delete(`/api/products/${product.id}`)
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(204);
    await importSource();
    expect(await Product.countDocuments()).toBe(60);
    expect((await Product.findById(product.id))!.deletedAt).toEqual(now);
    expect(
      (await request(app).get("/api/products").auth(token, { type: "bearer" }))
        .body.data.items,
    ).toHaveLength(59);
    expect(
      (
        await request(app)
          .put(`/api/products/${product.id}`)
          .auth(token, { type: "bearer" })
          .send(productBody)
      ).status,
    ).toBe(404);
  });
  it("protects resources and handles invalid or absent IDs", async () => {
    expect((await request(app).get("/api/products")).status).toBe(401);
    expect(
      (
        await request(app)
          .delete("/api/products/invalid")
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .delete(`/api/products/${new Types.ObjectId()}`)
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(404);
  });
});

describe("suppliers", () => {
  const body = {
    name: "Supplier Test",
    address: "Confirmed address",
    company: "Company Test",
    deliveryDate: "2026-11-10",
    amount: "1.25",
    status: "Active",
  };
  it("preserves legacy BDT and marks unknown EUR amounts", async () => {
    const result = await request(app)
      .get("/api/suppliers")
      .auth(token, { type: "bearer" });
    expect(result.status).toBe(200);
    expect(result.body.meta.completeness).toBe("partial");
    expect(
      result.body.data.items.every(
        (item: { amount: null; legacyMoney: { currency: string } }) =>
          item.amount === null && item.legacyMoney.currency === "BDT",
      ),
    ).toBe(true);
  });
  it.each([
    { status: "Deactive" },
    { address: "Updated address" },
    { company: "Updated company" },
  ])("edits legacy supplier fields while preserving unknown EUR: %j", async (change) => {
    const source = (await Supplier.findOne({ company: "Demo Company 01" }))!;
    const original = source.toObject();
    const updated = await request(app)
      .put(`/api/suppliers/${source.id}`)
      .auth(token, { type: "bearer" })
      .send({
        name: source.name,
        address: source.address,
        company: source.company,
        deliveryDate: source.deliveryDate,
        amount: null,
        status: source.status,
        ...change,
      });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ ...change, amount: null });
    expect(updated.body.meta.completeness).toBe("partial");
    const stored = (await Supplier.findById(source.id))!.toObject();
    expect(stored.amount).toBeNull();
    expect(stored.legacyMoney).toEqual(original.legacyMoney);
    expect(stored.provenance).toEqual(original.provenance);
    expect(stored.importedAt).toEqual(original.importedAt);
    expect(stored.createdAt).toBeNull();
    expect(stored.updatedAt).toEqual(now);
  });
  it("accepts explicit EUR without converting legacy money and rejects later null", async () => {
    const source = (await Supplier.findOne())!;
    const updated = await request(app)
      .put(`/api/suppliers/${source.id}`)
      .auth(token, { type: "bearer" })
      .send(body);
    expect(updated.status).toBe(200);
    expect(updated.body.data.amount).toBe(body.amount);
    const stored = (await Supplier.findById(source.id))!.toObject();
    expect(stored.legacyMoney).toEqual(source.toObject().legacyMoney);
    expect(stored.provenance).toEqual(source.toObject().provenance);
    const invalid = await request(app)
      .put(`/api/suppliers/${source.id}`)
      .auth(token, { type: "bearer" })
      .send({ ...body, amount: null });
    expect(invalid.status).toBe(400);
    expect((await Supplier.findById(source.id))!.amount!.toString()).toBe(body.amount);
  });
  it("rejects null on creation and keeps full PUT validation", async () => {
    expect((await request(app).post("/api/suppliers")
      .auth(token, { type: "bearer" }).send({ ...body, amount: null })).status).toBe(400);
    const source = (await Supplier.findOne())!;
    for (const field of Object.keys(body)) {
      const incomplete: Record<string, unknown> = { ...body };
      delete incomplete[field];
      expect((await request(app).put(`/api/suppliers/${source.id}`)
        .auth(token, { type: "bearer" }).send(incomplete)).status).toBe(400);
    }
    for (const invalid of [
      { status: "Deactive", amount: null },
      { ...body, amount: null, currency: "BDT" },
      { ...body, amount: "-1" },
      { ...body, deliveryDate: "2026-02-30" },
    ]) {
      expect((await request(app).put(`/api/suppliers/${source.id}`)
        .auth(token, { type: "bearer" }).send(invalid)).status).toBe(400);
    }
    expect((await Supplier.findById(source.id))!.amount).toBeNull();
  });
  it.each([
    { initial: null, requested: null },
    { initial: null, requested: "2.50" },
    { initial: "1.25", requested: "2.50" },
  ])("rejects an intervening monetary change: %j", async ({ initial, requested }) => {
    const source = (await Supplier.findOne())!;
    if (initial !== null) {
      source.amount = Types.Decimal128.fromString(initial);
      await source.save();
    }
    const staleRead = Supplier.findById(source.id);
    vi.spyOn(staleRead, "exec").mockImplementationOnce(async () => {
      await Supplier.updateOne({ _id: source._id }, {
        $set: { amount: Types.Decimal128.fromString("5.00") },
      });
      return source;
    });
    const readSpy = vi.spyOn(Supplier, "findById").mockReturnValueOnce(staleRead);
    try {
      const result = await request(app)
        .put(`/api/suppliers/${source.id}`)
        .auth(token, { type: "bearer" })
        .send({ ...body, amount: requested });
      expect(result.status).toBe(409);
      expect(result.body.error.code).toBe("CONCURRENT_CHANGE");
    } finally {
      readSpy.mockRestore();
    }
    const stored = (await Supplier.findById(source.id))!;
    expect(stored.amount!.toString()).toBe("5.00");
    expect(stored.name).toBe(source.name);
    expect(stored.toObject().legacyMoney).toEqual(source.toObject().legacyMoney);
  });
  it("creates and fully edits EUR supplier values without renaming product strings", async () => {
    const created = await request(app)
      .post("/api/suppliers")
      .auth(token, { type: "bearer" })
      .send(body);
    expect(created.status).toBe(201);
    expect(created.body.data.amount).toBe("1.25");
    const source = (await Supplier.findOne({ company: "Demo Company 01" }))!;
    const changed = await request(app)
      .put(`/api/suppliers/${source.id}`)
      .auth(token, { type: "bearer" })
      .send({ ...body, company: "Renamed company" });
    expect(changed.status).toBe(200);
    expect(changed.body.data.legacyMoney.currency).toBe("BDT");
    expect(await Product.countDocuments({ suppliers: "Demo Company 01" })).toBe(12);
    expect(
      (
        await request(app)
          .get("/api/suppliers")
          .query({ name: "SUPPLIER TEST" })
          .auth(token, { type: "bearer" })
      ).body.data.items.length,
    ).toBeGreaterThan(0);
  });
  it("rejects invalid dates, status, amount and unsupported fields", async () => {
    for (const changes of [
      { deliveryDate: "2026-02-30" },
      { amount: "-1" },
      { amount: "৳ 10" },
      { status: "Inactive" },
      { currency: "BDT" },
    ])
      expect(
        (
          await request(app)
            .post("/api/suppliers")
            .auth(token, { type: "bearer" })
            .send({ ...body, ...changes })
        ).status,
      ).toBe(400);
  });
});
