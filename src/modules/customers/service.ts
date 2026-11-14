import { z } from "zod";
import { Customer } from "./model.js";
import { Order } from "../orders/model.js";
import { Transaction } from "../transactions/model.js";
import { transactionResults } from "../transactions/service.js";
import {
  customerDto,
  customerMissing,
  orderDto,
  orderMissing,
} from "../../shared/serializers.js";
import { completeness } from "../../shared/completeness.js";
import { literalFilter, nameQuery, text } from "../../shared/validation.js";
import { ApiError } from "../../shared/errors.js";
import { decimal } from "../../shared/money.js";

const positiveInteger = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().positive().refine(Number.isSafeInteger));
export const customerQuery = z.strictObject({
  name: nameQuery,
  page: positiveInteger.default(1),
  limit: positiveInteger.pipe(z.number().max(100)).default(20),
});
const customerFields = {
  name: text,
  email: z.email(),
  address: text,
  phone: text,
  country: text.nullable(),
};
export const customerCreate = z.strictObject({
  ...customerFields,
  country: customerFields.country.default(null),
});
export const customerPatch = z
  .strictObject(customerFields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one editable field is required",
  );

export async function createCustomer(
  input: z.infer<typeof customerCreate>,
  now: Date,
) {
  const customer = await Customer.create({
    ...input,
    registerDate: now.toISOString().slice(0, 10),
    spent: decimal("0"),
    currency: "EUR",
    photo: null,
    createdAt: now,
    updatedAt: now,
    importedAt: null,
  });
  return {
    data: customerDto(customer),
    meta: completeness(customerMissing(customer)),
  };
}

export async function listCustomers(input: z.infer<typeof customerQuery>) {
  const filter = literalFilter(input.name);
  const total = await Customer.countDocuments(filter);
  const skip = (input.page - 1) * input.limit;
  const items =
    skip >= total
      ? []
      : await Customer.find(filter)
          .sort({ registerDate: -1, _id: 1 })
          .skip(skip)
          .limit(input.limit);
  return {
    data: { items: items.map(customerDto) },
    meta: {
      ...completeness(items.flatMap((item) => customerMissing(item))),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    },
  };
}

export async function updateCustomer(
  id: string,
  input: z.infer<typeof customerPatch>,
  now: Date,
) {
  const customer = await Customer.findByIdAndUpdate(
    id,
    { $set: { ...input, updatedAt: now } },
    { returnDocument: "after", runValidators: true },
  );
  if (!customer) throw new ApiError(404, "NOT_FOUND", "Customer not found");
  return {
    data: customerDto(customer),
    meta: completeness(customerMissing(customer)),
  };
}

export async function customerDetails(id: string) {
  const customer = await Customer.findById(id);
  if (!customer) throw new ApiError(404, "NOT_FOUND", "Customer not found");
  const [orders, transactions, unknownOrders, unknownTransactions] =
    await Promise.all([
      Order.find({ customerId: customer._id, customerLinkStatus: "linked" }),
      Transaction.find({
        customerId: customer._id,
        customerLinkStatus: "linked",
      }),
      Order.countDocuments({ customerLinkStatus: "unknown" }),
      Transaction.countDocuments({ customerLinkStatus: "unknown" }),
    ]);
  const financial = await transactionResults(transactions);
  const history = [
    ...orders.map((order) => ({
      id: order.id,
      type: "order" as const,
      customerId: id,
      date: order.orderDate,
      details: orderDto(order),
    })),
    ...financial.items.map((transaction) => ({
      id: transaction.id,
      type: "transaction" as const,
      customerId: id,
      date: transaction.businessDate,
      details: transaction,
    })),
  ].sort(
    (first, second) =>
      (second.date ?? "").localeCompare(first.date ?? "") ||
      first.id.localeCompare(second.id),
  );
  const missing = [
    ...customerMissing(customer),
    ...orders.flatMap(orderMissing),
    ...financial.missing,
  ];
  const uncertainLinks = unknownOrders > 0 || unknownTransactions > 0;
  if (uncertainLinks) missing.push("customerHistory.relationships");
  return {
    data: {
      customer: customerDto(customer),
      history: history.length === 0 && uncertainLinks ? null : history,
    },
    meta: completeness(missing),
  };
}
