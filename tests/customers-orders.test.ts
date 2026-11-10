import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { initializeUser } from "../src/modules/auth/service.js";
import { Product } from "../src/modules/products/model.js";
import { Supplier } from "../src/modules/suppliers/model.js";
import { Customer } from "../src/modules/customers/model.js";
import { Order } from "../src/modules/orders/model.js";
import { Transaction } from "../src/modules/transactions/model.js";
import { decimal } from "../src/shared/money.js";
import { importSource } from "./source.js";
import { startDatabase, stopDatabase, config } from "./database.js";

const now = new Date("2026-11-09T12:00:00Z");
const app = createApp(config, () => now);
let token: string;
beforeAll(async () => {
  await startDatabase();
  await initializeUser(
    "History Test",
    "history@example.test",
    "isolated password",
  );
  token = (
    await request(app)
      .post("/api/user/login")
      .send({ email: "history@example.test", password: "isolated password" })
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

describe("customers", () => {
  it("paginates a complete result set without merging emails", async () => {
    const result = await request(app)
      .get("/api/customers")
      .auth(token, { type: "bearer" });
    expect(result.status).toBe(200);
    expect(result.body.data.items).toHaveLength(20);
    expect(result.body.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 88,
      totalPages: 5,
    });
    expect(result.body.meta.missingData).toContain("customers.country");
    const final = await request(app)
      .get("/api/customers")
      .query({ page: 5 })
      .auth(token, { type: "bearer" });
    expect(final.body.data.items).toHaveLength(8);
    const empty = await request(app)
      .get("/api/customers")
      .query({ page: 100 })
      .auth(token, { type: "bearer" });
    expect(empty.body.data.items).toEqual([]);
    expect(empty.body.meta.completeness).toBe("complete");
    const search = await request(app)
      .get("/api/customers")
      .query({ name: "DEMO CUSTOMER" })
      .auth(token, { type: "bearer" });
    expect(search.body.data.items.length).toBeGreaterThan(0);
    for (const query of [
      { page: 0 },
      { limit: 101 },
      { page: "1.5" },
      { sortBy: "$where" },
    ])
      expect(
        (
          await request(app)
            .get("/api/customers")
            .query(query)
            .auth(token, { type: "bearer" })
        ).status,
      ).toBe(400);
  });
  it("changes only one identified profile and preserves non-editable values", async () => {
    const customer = (await Customer.findOne())!;
    const result = await request(app)
      .patch(`/api/customers/${customer.id}`)
      .auth(token, { type: "bearer" })
      .send({ name: "Verified new name", country: "Confirmed country" });
    expect(result.status).toBe(200);
    expect(result.body.data.name).toBe("Verified new name");
    expect(result.body.data.country).toBe("Confirmed country");
    const stored = (await Customer.findById(customer.id))!;
    expect(stored.registerDate).toBe(customer.registerDate);
    expect(stored.spent.toString()).toBe(customer.spent.toString());
    expect(stored.provenance!.key).toBe(customer.provenance!.key);
    for (const changes of [
      { spent: "0" },
      { registerDate: "2026-01-01" },
      { history: [] },
      { id: customer.id },
      {},
    ])
      expect(
        (
          await request(app)
            .patch(`/api/customers/${customer.id}`)
            .auth(token, { type: "bearer" })
            .send(changes)
        ).status,
      ).toBe(400);
    const another = (await Customer.findOne({ _id: { $ne: customer._id } }))!;
    expect(
      (
        await request(app)
          .patch(`/api/customers/${another.id}`)
          .auth(token, { type: "bearer" })
          .send({ email: customer.email })
      ).status,
    ).toBe(200);
  });
  it("does not invent empty history from unverified source relationships", async () => {
    const customer = (await Customer.findOne())!;
    const result = await request(app)
      .get(`/api/customers/${customer.id}`)
      .auth(token, { type: "bearer" });
    expect(result.body.data.history).toBeNull();
    expect(result.body.meta.missingData).toContain(
      "customerHistory.relationships",
    );
  });
  it("retrieves combined verified history and preserves snapshots after product changes/deletion", async () => {
    const customer = (await Customer.findOne())!;
    const product = (await Product.findOne())!;
    const order = (await Order.findOne())!;
    order.customerId = customer._id;
    order.customerLinkStatus = "linked";
    order.items = [
      {
        productId: product._id,
        productName: "Historical snapshot",
        quantity: 2,
        unitPrice: decimal("1.25"),
        amount: decimal("2.50"),
        currency: "EUR",
      },
    ];
    await order.save();
    const transaction = (await Transaction.findOne())!;
    transaction.customerId = customer._id;
    transaction.customerLinkStatus = "linked";
    transaction.businessDate = "2026-11-09";
    await transaction.save();
    await Product.updateOne(
      { _id: product.id },
      { name: "Current name changed" },
    );
    expect(
      (
        await request(app)
          .delete(`/api/products/${product.id}`)
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(204);
    const result = await request(app)
      .get(`/api/customers/${customer.id}`)
      .auth(token, { type: "bearer" });
    expect(result.body.data.history).toHaveLength(2);
    expect(
      result.body.data.history
        .map((entry: { type: string }) => entry.type)
        .sort(),
    ).toEqual(["order", "transaction"]);
    const historic = result.body.data.history.find(
      (entry: { type: string }) => entry.type === "order",
    );
    expect(historic.details.items[0].productName).toBe("Historical snapshot");
    expect(historic.details.items[0].amount).toBe("2.50");
    expect(result.body.meta.missingData).toContain("orders.items.quantities");
    const finance = result.body.data.history.find(
      (entry: { type: string }) => entry.type === "transaction",
    );
    expect(finance.details.customerEmail).toBe(customer.email);
    expect(result.body.meta.completeness).toBe("partial");
  });
  it("returns verified empty history only when all potential source links are resolved", async () => {
    await Order.updateMany({}, { customerLinkStatus: "not_applicable" });
    await Transaction.updateMany({}, { customerLinkStatus: "not_applicable" });
    const customer = (await Customer.findOne())!;
    await Customer.updateOne(
      { _id: customer.id },
      { country: "Confirmed country" },
    );
    const result = await request(app)
      .get(`/api/customers/${customer.id}`)
      .auth(token, { type: "bearer" });
    expect(result.body.data.history).toEqual([]);
    expect(result.body.meta.completeness).toBe("complete");
  });
});

describe("orders", () => {
  it("does not describe unavailable positions as an empty positive-unit order", async () => {
    const order = (await Order.findOne())!;
    await Order.updateOne({ _id: order.id }, { items: [] });
    const result = await request(app)
      .get("/api/orders")
      .query({ name: order.name })
      .auth(token, { type: "bearer" });
    expect(result.body.data.items[0].productUnits).toBeGreaterThan(0);
    expect(result.body.data.items[0].items).toBeNull();
    expect(result.body.meta.missingData).toContain("orders.items");
  });
  it("preserves unit counts and exposes unknown positions without synthetic products", async () => {
    const result = await request(app)
      .get("/api/orders")
      .auth(token, { type: "bearer" });
    expect(result.status).toBe(200);
    expect(result.body.data.items).toHaveLength(25);
    expect(
      result.body.data.items.every(
        (order: { items: null; productUnits: number }) =>
          order.items === null && Number.isInteger(order.productUnits),
      ),
    ).toBe(true);
    expect(result.body.meta.missingData).toContain("orders.items");
    expect(
      (
        await request(app)
          .get("/api/orders")
          .query({ name: ".*" })
          .auth(token, { type: "bearer" })
      ).body.data.items,
    ).toEqual([]);
    const sorted = await request(app)
      .get("/api/orders")
      .query({ sortBy: "productUnits", sortOrder: "asc" })
      .auth(token, { type: "bearer" });
    const quantities = sorted.body.data.items.map(
      (order: { productUnits: number }) => order.productUnits,
    ) as number[];
    expect(quantities).toEqual([...quantities].sort((a, b) => a - b));
    expect(
      (
        await request(app)
          .get("/api/orders")
          .query({ sortBy: "invalid" })
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/orders")
          .auth(token, { type: "bearer" })
          .send({})
      ).status,
    ).toBe(404);
  });
});
