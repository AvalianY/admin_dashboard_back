import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { importSource, prepareSource } from "../src/import/source.js";
import { demoSourceLocation, originalSourceLocation } from "../src/import/locations.js";
import { Product } from "../src/modules/products/model.js";
import { Supplier } from "../src/modules/suppliers/model.js";
import { Customer } from "../src/modules/customers/model.js";
import { Order } from "../src/modules/orders/model.js";
import { Transaction } from "../src/modules/transactions/model.js";
import { startDatabase, stopDatabase } from "../tests/database.js";

const location = originalSourceLocation();
const now = new Date("2026-11-09T10:00:00Z");
const files = ["products.json", "suppliers.json", "customers.json", "orders.json", "Income-Expenses.json"];
const models = [Product, Supplier, Customer, Order, Transaction];
beforeAll(async () => {
  try { await prepareSource(now, location); }
  catch { throw new Error("Private source verification requires authorized original files matching data/source-manifest.json. Set SOURCE_DATA_DIR; no synthetic fallback or skipped verification is used."); }
  await startDatabase();
});
afterAll(stopDatabase);

describe("private original source verification", () => {
  it("verifies all eight unchanged originals against the approved manifest", async () => {
    const manifest = JSON.parse(await readFile(location.manifestPath, "utf8")) as {
      files: Record<string, { sha256: string; records: number }>;
    };
    expect(Object.keys(manifest.files)).toHaveLength(8);
    for (const [file, expected] of Object.entries(manifest.files)) {
      const buffer = await readFile(join(location.directory, file));
      expect(createHash("sha256").update(buffer).digest("hex"), file).toBe(expected.sha256);
      expect(JSON.parse(buffer.toString("utf8")).length, file).toBe(expected.records);
    }
  });
  it("preserves the original v1 identity and every source business field without printing private values", async () => {
    const report = await importSource(now, location);
    const hash = createHash("sha256");
    const allIds: string[] = [];
    const mismatches: string[] = [];
    const normalizeMoney = (value: string) => value.replace(/^৳\s*/, "").replaceAll(",", "").replace(/^\+/, "");
    const date = (value: string) => new Date(`${value} UTC`).toISOString().slice(0, 10);
    for (const [batchIndex, file] of files.entries()) {
      const buffer = await readFile(join(location.directory, file));
      hash.update(file); hash.update(buffer);
      const rows = JSON.parse(buffer.toString("utf8")) as Record<string, string>[];
      const documents = await models[batchIndex].collection.find({}).sort({ "provenance.index": 1 }).toArray();
      expect(documents.length, file).toBe(rows.length);
      for (const [index, row] of rows.entries()) {
        const stored = documents[index];
        allIds.push(stored._id.toString());
        const check = (field: string, equal: boolean) => { if (!equal) mismatches.push(`${file}:${index}:${field}`); };
        check("name", stored.name === row.name);
        check("historical timestamps", stored.createdAt === null && stored.updatedAt === null);
        check("importedAt", stored.importedAt.getTime() === now.getTime());
        check("provenance", stored.provenance.file === file && stored.provenance.index === index);
        check("currency", stored.currency === "EUR");
        if (batchIndex === 0) {
          for (const field of ["photo", "category", "suppliers"]) check(field, stored[field] === row[field]);
          check("legacyId", stored.legacyId === row.id);
          check("stock", stored.stock === Number(row.stock));
          check("price", stored.price.toString() === normalizeMoney(row.price));
          check("deletion", stored.deletedAt === null);
        } else if (batchIndex === 1) {
          check("address", stored.address === row.address);
          check("company", stored.company === row.suppliers);
          check("deliveryDate", stored.deliveryDate === date(row.date));
          check("status", stored.status === row.status);
          check("BDT", stored.amount === null && stored.legacyMoney.currency === "BDT" && stored.legacyMoney.amount.toString() === normalizeMoney(row.amount));
        } else if (batchIndex === 2) {
          for (const field of ["email", "address", "phone"]) check(field, stored[field] === row[field]);
          check("photo", stored.photo === (row.photo ?? row.image));
          check("registration", stored.registerDate === date(row.register_date));
          check("spent", stored.spent.toString() === normalizeMoney(row.spent));
          check("country", stored.country === null);
        } else if (batchIndex === 3) {
          for (const field of ["photo", "address", "status"]) check(field, stored[field] === row[field]);
          check("units", stored.productUnits === Number(row.products));
          check("price", stored.price.toString() === normalizeMoney(row.price));
          check("date", stored.orderDate === date(row.order_date));
          check("missing details", stored.items === null && stored.customerId === null && stored.customerLinkStatus === "unknown");
        } else {
          check("amount", stored.amount.toString() === normalizeMoney(row.amount));
          check("type", stored.type === row.type);
          check("unknown date/link", stored.businessDate === null && stored.customerId === null && stored.customerLinkStatus === "unknown");
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(new Set(allIds).size).toBe(190);
    expect(report.results.map((result) => result.count)).toEqual([60, 5, 88, 25, 12]);
    expect(report.version).toBe(`v1:${hash.digest("hex")}`);
    const rawProducts = JSON.parse(await readFile(join(location.directory, "products.json"), "utf8")) as { id: string; category: string }[];
    const rawCustomers = JSON.parse(await readFile(join(location.directory, "customers.json"), "utf8")) as { email: string }[];
    expect(new Set((await Product.find()).map((p) => p.legacyId)).size).toBe(new Set(rawProducts.map((p) => p.id)).size);
    expect(await Product.countDocuments({ category: { $in: ["Heart", "Leg"] } })).toBe(rawProducts.filter((p) => ["Heart", "Leg"].includes(p.category)).length);
    expect(new Set((await Customer.find()).map((c) => c.email)).size).toBe(new Set(rawCustomers.map((c) => c.email)).size);
  });
  it("reimports originals without changing identities, edits, legacy metadata or deletions", async () => {
    const product = (await Product.findOne())!;
    const customer = (await Customer.findOne())!;
    const supplier = (await Supplier.findOne())!;
    await Product.updateOne({ _id: product.id }, { name: "Local verification edit", deletedAt: now });
    await Customer.updateOne({ _id: customer.id }, { country: "Local verification country" });
    await Supplier.updateOne({ _id: supplier.id }, { status: supplier.status === "Active" ? "Deactive" : "Active" });
    const before = await Promise.all(models.map((model) => model.collection.find({}).sort({ _id: 1 }).toArray()));
    const report = await importSource(new Date(), location);
    const after = await Promise.all(models.map((model) => model.collection.find({}).sort({ _id: 1 }).toArray()));
    expect(report.results.every((result) => result.inserted === 0)).toBe(true);
    expect(JSON.stringify(before) === JSON.stringify(after)).toBe(true);
  });
  it("requires explicit migration instead of overwriting a different source version", async () => {
    const product = (await Product.findOne())!;
    await Product.updateOne({ _id: product.id }, { "provenance.version": "verification-other-version" });
    await expect(importSource(now, location)).rejects.toThrow("explicit migration");
    expect(await Product.countDocuments()).toBe(60);
  });
  it("refuses mixing the verified original and synthetic versions in either direction", async () => {
    const original = await prepareSource(now, location);
    await Product.updateMany({}, { "provenance.version": original.version });
    await expect(importSource(now, demoSourceLocation)).rejects.toThrow("explicit migration");
    expect(await Product.countDocuments()).toBe(60);
    await Promise.all(models.map((model) => model.collection.deleteMany({})));
    const demo = await importSource(now, demoSourceLocation);
    await expect(importSource(now, location)).rejects.toThrow("explicit migration");
    expect(await Product.countDocuments()).toBe(60);
    expect(await Product.countDocuments({ "provenance.version": demo.version })).toBe(60);
  });
});
