import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importSource } from "./source.js";
import { Product } from "../src/modules/products/model.js";
import { Supplier } from "../src/modules/suppliers/model.js";
import { Customer } from "../src/modules/customers/model.js";
import { Order } from "../src/modules/orders/model.js";
import { Transaction } from "../src/modules/transactions/model.js";
import { moneyString, sourceMoney, decimal } from "../src/shared/money.js";
import { startDatabase, stopDatabase } from "./database.js";

beforeAll(startDatabase);
afterAll(stopDatabase);
describe("synthetic source import", () => {
  it("preserves every source record, legacy identity, currencies and unknown dates", async () => {
    const report = await importSource(new Date("2026-11-09T10:00:00Z"));
    expect(report.results.map((result) => result.count)).toEqual([
      60, 5, 88, 25, 12,
    ]);
    const products = await Product.find().lean();
    expect(
      new Set(products.map((product) => product._id.toString())).size,
    ).toBe(60);
    expect(new Set(products.map((product) => product.legacyId)).size).toBe(30);
    expect(
      products.every(
        (product) => product.createdAt === null && product.updatedAt === null,
      ),
    ).toBe(true);
    expect(
      products.filter((product) => ["Heart", "Leg"].includes(product.category)),
    ).toHaveLength(24);
    const suppliers = await Supplier.find();
    expect(
      suppliers.every(
        (supplier) =>
          supplier.amount === null && supplier.legacyMoney?.currency === "BDT",
      ),
    ).toBe(true);
    expect(moneyString(suppliers[0].legacyMoney!.amount)).toBe("1001.01");
    const customers = await Customer.find();
    expect(new Set(customers.map((customer) => customer.email)).size).toBe(44);
    expect(customers.every((customer) => customer.country === null)).toBe(true);
    expect(await Transaction.countDocuments({ businessDate: null })).toBe(12);
    expect(await Transaction.countDocuments({ type: "Error" })).toBe(1);
    expect(await Order.countDocuments({ items: null, customerId: null })).toBe(
      25,
    );
    expect((await Order.findOne())!.productUnits).toBe(3);
  });
  it("reimports without overwriting changes, identities or deletions", async () => {
    const product = (await Product.findOne())!;
    const customer = (await Customer.findOne())!;
    await Product.updateOne(
      { _id: product._id },
      { name: "User modification", deletedAt: new Date() },
    );
    await Customer.updateOne(
      { _id: customer._id },
      { country: "Verified input" },
    );
    const report = await importSource();
    expect(report.results.every((result) => result.inserted === 0)).toBe(true);
    const same = (await Product.findById(product._id))!;
    expect(same.name).toBe("User modification");
    expect(same.deletedAt).not.toBeNull();
    expect((await Customer.findById(customer._id))!.country).toBe(
      "Verified input",
    );
    expect(await Product.countDocuments()).toBe(60);
  });
  it("requires an explicit migration for a changed source version", async () => {
    const product = (await Product.findOne())!;
    await Product.updateOne(
      { _id: product._id },
      { "provenance.version": "a-different-source-version" },
    );
    await expect(importSource()).rejects.toThrow("explicit migration");
  });
  it("normalizes decimal formats without conversion or floating-point arithmetic", () => {
    expect(moneyString(sourceMoney("+1,200.88").amount)).toBe("1200.88");
    expect(moneyString(sourceMoney("-23.75").amount)).toBe("-23.75");
    expect(sourceMoney("৳ 1001.01").currency).toBe("BDT");
    expect(moneyString(decimal("9007199254740993.01"))).toBe(
      "9007199254740993.01",
    );
    expect(() => decimal("1e2")).toThrow();
  });
});
