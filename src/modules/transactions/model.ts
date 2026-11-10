import { Schema, model, Types } from "mongoose";
import {
  customerLinkFields,
  domainFields,
  provenanceIndex,
  validateCustomerLink,
  type CustomerLink,
  type DomainRecord,
} from "../../shared/model.js";

export interface TransactionRecord extends DomainRecord, CustomerLink {
  name: string;
  amount: Types.Decimal128;
  currency: "EUR";
  type: "Income" | "Expense" | "Error";
  businessDate: string | null;
}
const schema = new Schema<TransactionRecord>(
  {
    ...domainFields,
    ...customerLinkFields,
    name: { type: String, required: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, enum: ["EUR"], default: "EUR" },
    type: {
      type: String,
      enum: ["Income", "Expense", "Error"],
      required: true,
    },
    businessDate: { type: String, default: null, index: true },
  },
  { versionKey: false },
);
schema.pre("validate", function () {
  if (!validateCustomerLink(this))
    this.invalidate(
      "customerId",
      "Inconsistent verified customer relationship",
    );
});
provenanceIndex(schema);
export const Transaction = model<TransactionRecord>(
  "FinancialTransaction",
  schema,
);
