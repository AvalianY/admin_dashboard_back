import { Schema, model, Types } from "mongoose";
import {
  customerLinkFields,
  domainFields,
  provenanceIndex,
  validateCustomerLink,
  type CustomerLink,
  type DomainRecord,
} from "../../shared/model.js";

export const orderStatuses = [
  "Completed",
  "Confirmed",
  "Pending",
  "Cancelled",
  "Processing",
  "Shipped",
  "Delivered",
] as const;
export interface OrderItem {
  productId: Types.ObjectId | null;
  productName: string;
  quantity: number;
  unitPrice: Types.Decimal128 | null;
  amount: Types.Decimal128 | null;
  currency: "EUR";
}
export interface OrderRecord extends DomainRecord, CustomerLink {
  name: string;
  photo: string | null;
  address: string;
  productUnits: number;
  price: Types.Decimal128;
  currency: "EUR";
  status: string;
  orderDate: string | null;
  items: OrderItem[] | null;
}
const itemSchema = new Schema<OrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, default: null },
    productName: { type: String, required: true },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    unitPrice: { type: Schema.Types.Decimal128, default: null },
    amount: { type: Schema.Types.Decimal128, default: null },
    currency: { type: String, enum: ["EUR"], default: "EUR" },
  },
  { _id: false },
);
const schema = new Schema<OrderRecord>(
  {
    ...domainFields,
    ...customerLinkFields,
    name: { type: String, required: true },
    photo: { type: String, default: null },
    address: { type: String, required: true },
    productUnits: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    price: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, enum: ["EUR"], default: "EUR" },
    status: { type: String, enum: orderStatuses, required: true },
    orderDate: { type: String, default: null },
    items: { type: [itemSchema], default: null },
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
export const Order = model<OrderRecord>("Order", schema);
