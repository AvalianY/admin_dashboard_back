import { Schema, model, Types } from "mongoose";
import {
  domainFields,
  legacyMoneySchema,
  provenanceIndex,
  type DomainRecord,
  type LegacyMoney,
} from "../../shared/model.js";

export interface SupplierRecord extends DomainRecord {
  name: string;
  address: string;
  company: string;
  deliveryDate: string;
  amount: Types.Decimal128 | null;
  currency: "EUR";
  legacyMoney: LegacyMoney | null;
  status: "Active" | "Deactive";
}
const schema = new Schema<SupplierRecord>(
  {
    ...domainFields,
    name: { type: String, required: true },
    address: { type: String, required: true },
    company: { type: String, required: true },
    deliveryDate: { type: String, required: true },
    amount: { type: Schema.Types.Decimal128, default: null },
    currency: { type: String, enum: ["EUR"], default: "EUR" },
    legacyMoney: { type: legacyMoneySchema, default: null },
    status: { type: String, enum: ["Active", "Deactive"], required: true },
  },
  { versionKey: false },
);
provenanceIndex(schema);
export const Supplier = model<SupplierRecord>("Supplier", schema);
