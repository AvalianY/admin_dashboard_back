import { Schema, model, Types } from "mongoose";
import {
  domainFields,
  provenanceIndex,
  type DomainRecord,
} from "../../shared/model.js";

export const categories = [
  "Medicine",
  "Head",
  "Hand",
  "Dental Care",
  "Skin Care",
  "Eye Care",
  "Vitamins & Supplements",
  "Orthopedic Products",
  "Baby Care",
] as const;
export const legacyCategories = ["Heart", "Leg"] as const;
export interface ProductRecord extends DomainRecord {
  legacyId: string | null;
  name: string;
  photo: string | null;
  category: string;
  stock: number;
  suppliers: string;
  price: Types.Decimal128;
  currency: "EUR";
  deletedAt: Date | null;
}
const schema = new Schema<ProductRecord>(
  {
    ...domainFields,
    legacyId: { type: String, default: null },
    name: { type: String, required: true },
    photo: { type: String, default: null },
    category: {
      type: String,
      enum: [...categories, ...legacyCategories],
      required: true,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    suppliers: { type: String, required: true },
    price: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, enum: ["EUR"], default: "EUR" },
    deletedAt: { type: Date, default: null, index: true },
  },
  { versionKey: false },
);
provenanceIndex(schema);
export const Product = model<ProductRecord>("Product", schema);
