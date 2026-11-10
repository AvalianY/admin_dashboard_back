import { Customer } from "../customers/model.js";
import type { TransactionRecord } from "./model.js";
import { transactionDto } from "../../shared/serializers.js";

export async function transactionResults(records: TransactionRecord[]) {
  const identifiers = records
    .filter(
      (record) => record.customerLinkStatus === "linked" && record.customerId,
    )
    .map((record) => record.customerId!);
  const customers = await Customer.find({ _id: { $in: identifiers } });
  const emails = new Map(
    customers.map((customer) => [customer.id, customer.email]),
  );
  const missing = new Set<string>();
  const items = records.map((record) => {
    if (!record.businessDate) missing.add("transactions.businessDate");
    const email = record.customerId
      ? (emails.get(record.customerId.toString()) ?? null)
      : null;
    if (
      record.customerLinkStatus === "unknown" ||
      (record.customerLinkStatus === "linked" && email === null)
    )
      missing.add("transactions.customerRelationships");
    return transactionDto(record, email);
  });
  return { items, missing: [...missing] };
}
