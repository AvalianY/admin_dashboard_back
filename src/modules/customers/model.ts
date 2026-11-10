import { Schema, model, Types } from "mongoose";
import {
  domainFields,
  provenanceIndex,
  type DomainRecord,
} from "../../shared/model.js";

export interface CustomerRecord extends DomainRecord {
  name: string;
  email: string;
  address: string;
  phone: string;
  registerDate: string;
  photo: string | null;
  spent: Types.Decimal128;
  currency: "EUR";
  country: string | null;
}
const schema = new Schema<CustomerRecord>(
  {
    ...domainFields,
    name: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    registerDate: { type: String, required: true, index: true },
    photo: { type: String, default: null },
    spent: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, enum: ["EUR"], default: "EUR" },
    country: { type: String, default: null },
  },
  { versionKey: false },
);
provenanceIndex(schema);
export const Customer = model<CustomerRecord>("Customer", schema);
