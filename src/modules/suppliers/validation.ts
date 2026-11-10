import { z } from "zod";
import {
  calendarDate,
  nameQuery,
  nonNegativeMoney,
  text,
} from "../../shared/validation.js";

export const supplierCreate = z.strictObject({
  name: text,
  address: text,
  company: text,
  deliveryDate: calendarDate,
  amount: nonNegativeMoney,
  status: z.enum(["Active", "Deactive"]),
});
export const supplierUpdate = supplierCreate.extend({
  amount: nonNegativeMoney.nullable(),
});
export const supplierQuery = z.strictObject({ name: nameQuery });
