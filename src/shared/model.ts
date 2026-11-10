import { Schema, Types } from "mongoose";

export interface Provenance {
  key: string;
  version: string;
  file: string;
  index: number;
}
export interface DomainRecord {
  _id: Types.ObjectId;
  createdAt: Date | null;
  updatedAt: Date | null;
  importedAt: Date | null;
  provenance?: Provenance;
}
export interface LegacyMoney {
  amount: Types.Decimal128;
  currency: "BDT";
}
const provenance = new Schema<Provenance>(
  {
    key: { type: String, required: true },
    version: { type: String, required: true },
    file: { type: String, required: true },
    index: { type: Number, required: true },
  },
  { _id: false },
);
export const domainFields = {
  createdAt: { type: Date, default: null },
  updatedAt: { type: Date, default: null },
  importedAt: { type: Date, default: null },
  provenance: { type: provenance, default: undefined },
};
export const legacyMoneySchema = new Schema<LegacyMoney>(
  {
    amount: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, enum: ["BDT"], required: true },
  },
  { _id: false },
);
export function provenanceIndex<T>(schema: Schema<T>) {
  schema.index({ "provenance.key": 1 }, { unique: true, sparse: true });
}
export const customerLinkFields = {
  customerId: { type: Schema.Types.ObjectId, default: null, index: true },
  customerLinkStatus: {
    type: String,
    enum: ["unknown", "linked", "not_applicable"],
    default: "unknown" as const,
  },
};
export interface CustomerLink {
  customerId: Types.ObjectId | null;
  customerLinkStatus: "unknown" | "linked" | "not_applicable";
}

export function validateCustomerLink(link: CustomerLink) {
  return link.customerLinkStatus === "linked"
    ? link.customerId !== null
    : link.customerId === null;
}
