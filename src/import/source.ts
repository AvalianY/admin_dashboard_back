import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { Types } from "mongoose";
import { isCalendarDate } from "../shared/dates.js";
import { sourceMoney } from "../shared/money.js";
import {
  Product,
  categories,
  legacyCategories,
} from "../modules/products/model.js";
import { Supplier } from "../modules/suppliers/model.js";
import { Customer } from "../modules/customers/model.js";
import { Order, orderStatuses } from "../modules/orders/model.js";
import { Transaction } from "../modules/transactions/model.js";
import { originalSourceLocation, type SourceLocation } from "./locations.js";

const sourceText = z.string().min(1);
const customerSchema = z
  .strictObject({
    name: sourceText,
    email: z.email(),
    address: sourceText,
    phone: sourceText,
    spent: sourceText,
    register_date: sourceText,
    photo: sourceText.optional(),
    image: sourceText.optional(),
  })
  .refine(
    (value) => Boolean(value.photo) !== Boolean(value.image),
    "Exactly one source image field is required",
  );
const productSchema = z.strictObject({
  id: sourceText,
  name: sourceText,
  photo: sourceText,
  suppliers: sourceText,
  stock: z.string().regex(/^\d+$/),
  price: sourceText,
  category: z.enum([...categories, ...legacyCategories]),
});
const supplierSchema = z.strictObject({
  name: sourceText,
  address: sourceText,
  suppliers: sourceText,
  date: sourceText,
  amount: sourceText,
  status: z.enum(["Active", "Deactive"]),
});
const orderSchema = z.strictObject({
  name: sourceText,
  photo: sourceText,
  address: sourceText,
  products: z.string().regex(/^\d+$/),
  price: sourceText,
  status: z.enum(orderStatuses),
  order_date: sourceText,
});
const transactionSchema = z.strictObject({
  name: sourceText,
  amount: sourceText,
  type: z.enum(["Income", "Expense", "Error"]),
});
const files = [
  "products.json",
  "suppliers.json",
  "customers.json",
  "orders.json",
  "Income-Expenses.json",
] as const;
const counts = [60, 5, 88, 25, 12] as const;
const models = [Product, Supplier, Customer, Order, Transaction] as const;

export function sourceDate(value: string) {
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const match = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(value);
  if (!match) throw new Error("Invalid source date");
  const month = months.indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
  const result = `${match[3]}-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  if (!isCalendarDate(result)) throw new Error("Invalid source date");
  return result;
}

function eur(raw: string) {
  const money = sourceMoney(raw);
  if (money.currency !== "EUR") throw new Error("Conflicting currency marker");
  return money.amount;
}

export async function prepareSource(
  now = new Date(),
  location: SourceLocation = originalSourceLocation(),
) {
  const buffers = await Promise.all(
    files.map((file) => readFile(join(location.directory, file))),
  );
  const manifest = z
    .object({
      versionPrefix: z.string().regex(/^[a-z0-9-]+$/).default("v1"),
      files: z.record(
        z.string(),
        z.object({ sha256: z.string(), records: z.number() }),
      ),
    })
    .parse(
      JSON.parse(
        await readFile(
          location.manifestPath,
          "utf8",
        ),
      ),
    );
  buffers.forEach((buffer, index) => {
    if (
      createHash("sha256").update(buffer).digest("hex") !==
      manifest.files[files[index]]?.sha256
    )
      throw new Error(`Unapproved source modification: ${files[index]}`);
  });
  const hash = createHash("sha256");
  buffers.forEach((buffer, index) => {
    hash.update(files[index]);
    hash.update(buffer);
  });
  const version = `${manifest.versionPrefix}:${hash.digest("hex")}`;
  const batches = buffers.map((buffer, batchIndex) => {
    const records = z
      .array(z.unknown())
      .parse(JSON.parse(buffer.toString("utf8")));
    if (records.length !== counts[batchIndex])
      throw new Error(`Unexpected source count: ${files[batchIndex]}`);
    const documents = records.map((raw, index) => {
      const common = {
        _id: new Types.ObjectId(),
        createdAt: null,
        updatedAt: null,
        importedAt: now,
        provenance: {
          key: `${version}:${files[batchIndex]}:${index}`,
          version,
          file: files[batchIndex],
          index,
        },
      };
      if (batchIndex === 0) {
        const row = productSchema.parse(raw);
        return {
          ...common,
          legacyId: row.id,
          name: row.name,
          photo: row.photo,
          category: row.category,
          stock: Number(row.stock),
          suppliers: row.suppliers,
          price: eur(row.price),
          currency: "EUR",
          deletedAt: null,
        };
      }
      if (batchIndex === 1) {
        const row = supplierSchema.parse(raw);
        const money = sourceMoney(row.amount);
        return {
          ...common,
          name: row.name,
          address: row.address,
          company: row.suppliers,
          deliveryDate: sourceDate(row.date),
          amount: money.currency === "EUR" ? money.amount : null,
          currency: "EUR",
          legacyMoney: money.currency === "BDT" ? money : null,
          status: row.status,
        };
      }
      if (batchIndex === 2) {
        const row = customerSchema.parse(raw);
        return {
          ...common,
          name: row.name,
          email: row.email,
          address: row.address,
          phone: row.phone,
          spent: eur(row.spent),
          registerDate: sourceDate(row.register_date),
          photo: row.photo ?? row.image,
          currency: "EUR",
          country: null,
        };
      }
      if (batchIndex === 3) {
        const row = orderSchema.parse(raw);
        return {
          ...common,
          name: row.name,
          photo: row.photo,
          address: row.address,
          productUnits: Number(row.products),
          price: eur(row.price),
          currency: "EUR",
          status: row.status,
          orderDate: sourceDate(row.order_date),
          customerId: null,
          customerLinkStatus: "unknown",
          items: null,
        };
      }
      const row = transactionSchema.parse(raw);
      return {
        ...common,
        name: row.name,
        amount: eur(row.amount),
        currency: "EUR",
        type: row.type,
        businessDate: null,
        customerId: null,
        customerLinkStatus: "unknown",
      };
    });
    return { file: files[batchIndex], expected: counts[batchIndex], documents };
  });
  return { version, batches };
}

export async function importSource(
  now = new Date(),
  location: SourceLocation = originalSourceLocation(),
) {
  const { version, batches } = await prepareSource(now, location);
  // Preflight the entire source before any insert; a changed version requires an explicit migration.
  for (let index = 0; index < models.length; index++) {
    const Model = models[index];
    await Model.init();
    if (
      await Model.collection.countDocuments({
        "provenance.version": { $exists: true, $ne: version },
      })
    )
      throw new Error(
        "Existing source version differs; explicit migration required",
      );
    for (const document of batches[index].documents)
      await new Model(document).validate();
  }
  const results = [];
  for (let index = 0; index < models.length; index++) {
    const Model = models[index];
    const batch = batches[index];
    const result = await Model.collection.bulkWrite(
      batch.documents.map((document) => ({
        updateOne: {
          filter: { "provenance.key": document.provenance.key },
          update: { $setOnInsert: document },
          upsert: true,
        },
      })),
      { ordered: true },
    );
    const count = await Model.collection.countDocuments({
      "provenance.version": version,
    });
    if (count !== batch.expected)
      throw new Error(`Import count mismatch: ${batch.file}`);
    results.push({ file: batch.file, count, inserted: result.upsertedCount });
  }
  return { version, results };
}
