import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
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
const dashboard = () =>
  request(app).get("/api/dashboard").auth(token, { type: "bearer" });
beforeAll(async () => {
  await startDatabase();
  await initializeUser(
    "Dashboard Test",
    "dashboard@example.test",
    "isolated password",
  );
  token = (
    await request(app)
      .post("/api/user/login")
      .send({ email: "dashboard@example.test", password: "isolated password" })
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

describe("Dashboard", () => {
  it("separates verified totals from unknown 30-day and Today results", async () => {
    const result = await dashboard();
    expect(result.status).toBe(200);
    expect(result.body.data.totals).toEqual({
      products: 60,
      suppliers: 5,
      customers: 88,
    });
    expect(result.body.data.last30Days).toEqual({
      products: null,
      suppliers: null,
      customers: 0,
    });
    expect(result.body.data.incomeExpensesToday).toBeNull();
    expect(result.body.data.recentCustomers).toHaveLength(5);
    expect(result.body.meta.completeness).toBe("partial");
    expect(result.body.meta.periods.last30Days).toEqual({
      from: "2026-10-11T00:00:00.000Z",
      toExclusive: "2026-11-10T00:00:00.000Z",
      timeZone: "UTC",
    });
    const recent = await Customer.find()
      .sort({ registerDate: -1, _id: 1 })
      .limit(5);
    expect(
      result.body.data.recentCustomers.map(
        (customer: { id: string }) => customer.id,
      ),
    ).toEqual(recent.map((customer) => customer.id));
    expect(result.body.data.recentCustomers[0].registerDate).toBe("2023-03-29");
  });
  it("reflects approved mutations without falsely completing historical metrics", async () => {
    const created = await request(app)
      .post("/api/products")
      .auth(token, { type: "bearer" })
      .send({
        name: "New",
        category: "Medicine",
        stock: 2,
        suppliers: "Text",
        price: "1.25",
      });
    expect(created.status).toBe(201);
    expect((await dashboard()).body.data.totals.products).toBe(61);
    expect((await dashboard()).body.data.last30Days.products).toBeNull();
    expect(
      (
        await request(app)
          .delete(`/api/products/${created.body.data.id}`)
          .auth(token, { type: "bearer" })
      ).status,
    ).toBe(204);
    const recent = (await Customer.findOne().sort({
      registerDate: -1,
      _id: 1,
    }))!;
    await request(app)
      .patch(`/api/customers/${recent.id}`)
      .auth(token, { type: "bearer" })
      .send({ name: "Updated current profile", country: "Verified country" });
    const supplier = await request(app)
      .post("/api/suppliers")
      .auth(token, { type: "bearer" })
      .send({
        name: "New supplier",
        address: "Address",
        company: "Company",
        deliveryDate: "2026-11-10",
        amount: "10.00",
        status: "Active",
      });
    expect(supplier.status).toBe(201);
    const result = await dashboard();
    expect(result.body.data.totals).toEqual({
      products: 60,
      suppliers: 6,
      customers: 88,
    });
    expect(result.body.data.recentCustomers[0].name).toBe(
      "Updated current profile",
    );
    expect(result.body.data.recentCustomers[0].country).toBe(
      "Verified country",
    );
  });
  it("calculates exact UTC calendar boundaries using confirmed isolated fixtures", async () => {
    const old = new Date("2020-01-01T00:00:00Z");
    await Product.updateMany({}, { createdAt: old });
    await Supplier.updateMany({}, { createdAt: old });
    const products = await Product.find().limit(4);
    await Product.updateOne(
      { _id: products[0].id },
      { createdAt: new Date("2026-10-11T00:00:00Z") },
    );
    await Product.updateOne(
      { _id: products[1].id },
      { createdAt: new Date("2026-10-10T23:59:59.999Z") },
    );
    await Product.updateOne(
      { _id: products[2].id },
      { createdAt: new Date("2026-11-10T00:00:00Z") },
    );
    await Product.updateOne(
      { _id: products[3].id },
      { createdAt: now, deletedAt: now },
    );
    const supplier = (await Supplier.findOne())!;
    await Supplier.updateOne({ _id: supplier.id }, { createdAt: now });
    const customers = await Customer.find().limit(4);
    for (const [index, date] of [
      "2026-10-11",
      "2026-11-09",
      "2026-10-10",
      "2026-11-10",
    ].entries())
      await Customer.updateOne(
        { _id: customers[index].id },
        { registerDate: date },
      );
    expect((await dashboard()).body.data.last30Days).toEqual({
      products: 1,
      suppliers: 1,
      customers: 2,
    });
  });
  it("includes only confirmed Today transactions and preserves signs and Error", async () => {
    const expense = (await Transaction.findOne({ type: "Expense" }))!;
    const failed = (await Transaction.findOne({ type: "Error" }))!;
    for (const transaction of [expense, failed])
      await Transaction.updateOne(
        { _id: transaction.id },
        { businessDate: "2026-11-09", customerLinkStatus: "not_applicable" },
      );
    const result = await dashboard();
    expect(result.body.data.incomeExpensesToday).toHaveLength(2);
    expect(
      result.body.data.incomeExpensesToday.find(
        (item: { type: string }) => item.type === "Expense",
      ).amount,
    ).toBe("-12.50");
    expect(
      result.body.data.incomeExpensesToday.find(
        (item: { type: string }) => item.type === "Error",
      ).amount,
    ).toBe("7.25");
    expect(result.body.meta.missingData).toContain(
      "incomeExpensesToday.businessDate",
    );
  });
  it("distinguishes confirmed zero and empty results from unknown data", async () => {
    await Product.updateMany({}, { createdAt: new Date("2020-01-01") });
    await Supplier.updateMany({}, { createdAt: new Date("2020-01-01") });
    await Customer.updateMany({}, { country: "Verified fixture country" });
    await Transaction.updateMany(
      {},
      { businessDate: "2020-01-01", customerLinkStatus: "not_applicable" },
    );
    const result = await dashboard();
    expect(result.body.data.last30Days).toEqual({
      products: 0,
      suppliers: 0,
      customers: 0,
    });
    expect(result.body.data.incomeExpensesToday).toEqual([]);
    expect(result.body.meta.completeness).toBe("complete");
    expect(result.body.meta.missingData).toEqual([]);
  });
  it("resolves confirmed customer emails from current profiles only", async () => {
    const customer = (await Customer.findOne())!;
    const transaction = (await Transaction.findOne())!;
    await Transaction.updateOne(
      { _id: transaction.id },
      {
        businessDate: "2026-11-09",
        customerId: customer._id,
        customerLinkStatus: "linked",
      },
    );
    await request(app)
      .patch(`/api/customers/${customer.id}`)
      .auth(token, { type: "bearer" })
      .send({ email: "current@example.test" });
    expect(
      (await dashboard()).body.data.incomeExpensesToday[0].customerEmail,
    ).toBe("current@example.test");
  });
  it("does not expose unapproved mutation routes", async () => {
    expect(
      (
        await request(app)
          .put("/api/dashboard")
          .auth(token, { type: "bearer" })
          .send({})
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post("/api/transactions")
          .auth(token, { type: "bearer" })
          .send({})
      ).status,
    ).toBe(404);
  });
});
