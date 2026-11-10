import type { DomainRecord } from "./model.js";
import { moneyString } from "./money.js";
import type { ProductRecord } from "../modules/products/model.js";
import type { SupplierRecord } from "../modules/suppliers/model.js";
import type { CustomerRecord } from "../modules/customers/model.js";
import type { OrderRecord } from "../modules/orders/model.js";
import type { TransactionRecord } from "../modules/transactions/model.js";

const dates = (value: DomainRecord) => ({
  createdAt: value.createdAt?.toISOString() ?? null,
  updatedAt: value.updatedAt?.toISOString() ?? null,
});
export const productDto = (value: ProductRecord) => ({
  id: value._id.toString(),
  legacyId: value.legacyId,
  name: value.name,
  photo: value.photo,
  category: value.category,
  stock: value.stock,
  suppliers: value.suppliers,
  price: moneyString(value.price),
  currency: value.currency,
  ...dates(value),
});
export const supplierDto = (value: SupplierRecord) => ({
  id: value._id.toString(),
  name: value.name,
  address: value.address,
  company: value.company,
  deliveryDate: value.deliveryDate,
  amount: value.amount === null ? null : moneyString(value.amount),
  currency: value.currency,
  legacyMoney: value.legacyMoney
    ? {
        amount: moneyString(value.legacyMoney.amount),
        currency: value.legacyMoney.currency,
      }
    : null,
  status: value.status,
  ...dates(value),
});
export const customerDto = (value: CustomerRecord) => ({
  id: value._id.toString(),
  name: value.name,
  email: value.email,
  address: value.address,
  phone: value.phone,
  photo: value.photo,
  registerDate: value.registerDate,
  spent: moneyString(value.spent),
  currency: value.currency,
  country: value.country,
  ...dates(value),
});
export const orderDto = (value: OrderRecord) => ({
  id: value._id.toString(),
  name: value.name,
  photo: value.photo,
  address: value.address,
  productUnits: value.productUnits,
  price: moneyString(value.price),
  currency: value.currency,
  status: value.status,
  orderDate: value.orderDate,
  customerId: value.customerId?.toString() ?? null,
  items:
    value.items === null || (value.items.length === 0 && value.productUnits > 0)
      ? null
      : value.items.map((item) => ({
          productId: item.productId?.toString() ?? null,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice:
            item.unitPrice === null ? null : moneyString(item.unitPrice),
          amount: item.amount === null ? null : moneyString(item.amount),
          currency: item.currency,
        })),
  ...dates(value),
});
export const transactionDto = (
  value: TransactionRecord,
  customerEmail: string | null = null,
) => ({
  id: value._id.toString(),
  name: value.name,
  amount: moneyString(value.amount),
  currency: value.currency,
  type: value.type,
  businessDate: value.businessDate,
  customerId: value.customerId?.toString() ?? null,
  customerEmail,
  ...dates(value),
});

export const customerMissing = (value: CustomerRecord, prefix = "customers") =>
  value.country === null ? [`${prefix}.country`] : [];
export const supplierMissing = (value: SupplierRecord) =>
  value.amount === null ? ["suppliers.eurAmount"] : [];
export function orderMissing(value: OrderRecord) {
  const missing = [];
  if (
    value.items === null ||
    (value.items.length === 0 && value.productUnits > 0)
  )
    missing.push("orders.items");
  else {
    if (
      value.items.some(
        (item) => item.unitPrice === null || item.amount === null,
      )
    )
      missing.push("orders.items.money");
    if (
      value.items.reduce((sum, item) => sum + BigInt(item.quantity), 0n) !==
      BigInt(value.productUnits)
    )
      missing.push("orders.items.quantities");
  }
  if (value.orderDate === null) missing.push("orders.orderDate");
  if (value.customerLinkStatus === "unknown")
    missing.push("orders.customerRelationships");
  return missing;
}
