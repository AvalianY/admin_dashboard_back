import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { URL } from "node:url";

// This generator has no inputs from private source files.
const directory = new URL("../data/demo/", import.meta.url);
const pad = (number, width = 3) => String(number).padStart(width, "0");
const categories = ["Medicine", "Head", "Hand", "Dental Care", "Skin Care", "Eye Care", "Vitamins & Supplements", "Orthopedic Products", "Baby Care"];
const statuses = ["Completed", "Confirmed", "Pending", "Cancelled", "Processing", "Shipped", "Delivered"];
const sourceDate = (day) => {
  const date = new Date(Date.UTC(2023, 0, 1 + day));
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][date.getUTCMonth()];
  return `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
};
const products = Array.from({ length: 60 }, (_, row) => {
  const index = row % 30;
  return {
    id: `demo-product-${pad(index + 1)}`,
    name: `Demo Product ${pad(index + 1)}`,
    photo: `https://assets.example.test/products/${pad(index + 1)}.png`,
    suppliers: `Demo Company ${pad(index % 5 + 1, 2)}`,
    stock: String(index % 7),
    price: index === 0 ? "1,000.25" : `${10 + index}.25`,
    category: index < 12 ? (index % 2 ? "Leg" : "Heart") : categories[(index - 12) % categories.length],
  };
});
const suppliers = Array.from({ length: 5 }, (_, index) => ({
  name: `Demo Supplier ${pad(index + 1, 2)}`,
  address: `Fictional Supplier Address ${pad(index + 1, 2)} (TEST ONLY)`,
  suppliers: `Demo Company ${pad(index + 1, 2)}`,
  date: sourceDate(index),
  amount: `৳ ${1001 + index}.01`,
  status: index % 2 ? "Deactive" : "Active",
}));
const customers = Array.from({ length: 88 }, (_, index) => ({
  name: `Demo Customer ${pad(index + 1)}`,
  email: `customer${pad(index % 44 + 1)}@example.test`,
  address: `Fictional Customer Address ${pad(index + 1)} (TEST ONLY)`,
  phone: `TEST-PHONE-${pad(index + 1)}`,
  spent: `${index * 10}.50`,
  register_date: sourceDate(index),
  [index < 9 ? "photo" : "image"]: `https://assets.example.test/customers/${pad(index + 1)}.png`,
}));
const orders = Array.from({ length: 25 }, (_, index) => ({
  name: `Demo Order ${pad(index + 1)}`,
  photo: `https://assets.example.test/orders/${pad(index + 1)}.png`,
  address: `Fictional Order Address ${pad(index + 1)} (TEST ONLY)`,
  products: String(3 + index % 5),
  price: `${50 + index}.50`,
  status: statuses[index % statuses.length],
  order_date: sourceDate(index),
}));
const transactions = Array.from({ length: 12 }, (_, index) => {
  if (index < 2) return { name: "Demo Transaction 001", amount: "+1,000.00", type: "Income" };
  if (index === 11) return { name: "Demo Transaction 012", amount: "7.25", type: "Error" };
  return { name: `Demo Transaction ${pad(index + 1)}`, amount: index % 2 ? "+200.00" : "-12.50", type: index % 2 ? "Income" : "Expense" };
});
const files = { "products.json": products, "suppliers.json": suppliers, "customers.json": customers, "orders.json": orders, "Income-Expenses.json": transactions };
await mkdir(directory, { recursive: true });
const manifest = {
  kind: "synthetic",
  versionPrefix: "demo-v1",
  description: "Fictional, deterministic fixtures generated without reading the private E-Pharmacy source. Not original customer or business records.",
  files: {},
};
for (const [name, records] of Object.entries(files)) {
  const content = JSON.stringify(records, null, 2) + "\n";
  await writeFile(new URL(name, directory), content);
  manifest.files[name] = { sha256: createHash("sha256").update(content).digest("hex"), records: records.length };
}
await writeFile(new URL("source-manifest.json", directory), JSON.stringify(manifest, null, 2) + "\n");
