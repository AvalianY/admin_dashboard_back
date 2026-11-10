import { z } from "zod";
import { Order } from "./model.js";
import {
  literalFilter,
  nameQuery,
  sortOrder,
} from "../../shared/validation.js";
import { orderDto, orderMissing } from "../../shared/serializers.js";
import { completeness } from "../../shared/completeness.js";

export const orderQuery = z.strictObject({
  name: nameQuery,
  sortBy: z
    .enum(["name", "address", "productUnits", "price", "orderDate", "status"])
    .default("orderDate"),
  sortOrder,
});
export async function listOrders(input: z.infer<typeof orderQuery>) {
  const items = await Order.find(literalFilter(input.name)).sort({
    [input.sortBy]: input.sortOrder === "asc" ? 1 : -1,
    _id: 1,
  });
  return {
    data: { items: items.map(orderDto) },
    meta: completeness(items.flatMap(orderMissing)),
  };
}
