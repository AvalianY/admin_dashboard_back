import { Product } from "../products/model.js";
import { Supplier } from "../suppliers/model.js";
import { Customer } from "../customers/model.js";
import { Transaction } from "../transactions/model.js";
import { transactionResults } from "../transactions/service.js";
import { userDto } from "../auth/service.js";
import type { UserRecord } from "../auth/models.js";
import { completeness } from "../../shared/completeness.js";
import { utcPeriods } from "../../shared/dates.js";
import { customerDto, customerMissing } from "../../shared/serializers.js";

async function creationCount(
  model: typeof Product | typeof Supplier,
  filter: Record<string, unknown>,
  from: Date,
  to: Date,
) {
  const [knownCount, unknownCount] = await Promise.all([
    model.collection.countDocuments({
      ...filter,
      createdAt: { $gte: from, $lt: to },
    }),
    model.collection.countDocuments({ ...filter, createdAt: null }),
  ]);
  return unknownCount > 0 ? null : knownCount;
}

export async function getDashboard(user: UserRecord, now: Date) {
  const periods = utcPeriods(now);
  const [
    products,
    suppliers,
    customers,
    recent,
    productsPeriod,
    suppliersPeriod,
    customerCount,
    unknownRegistrations,
    todayRecords,
    undatedTransactions,
  ] = await Promise.all([
    Product.countDocuments({ deletedAt: null }),
    Supplier.countDocuments(),
    Customer.countDocuments(),
    Customer.find().sort({ registerDate: -1, _id: 1 }).limit(5),
    creationCount(Product, { deletedAt: null }, periods.start, periods.end),
    creationCount(Supplier, {}, periods.start, periods.end),
    Customer.countDocuments({
      registerDate: {
        $gte: periods.start.toISOString().slice(0, 10),
        $lte: periods.today,
      },
    }),
    Customer.collection.countDocuments({ registerDate: null }),
    Transaction.find({ businessDate: periods.today }).sort({ _id: 1 }),
    Transaction.countDocuments({ businessDate: null }),
  ]);
  const financial = await transactionResults(todayRecords);
  const missing = [
    ...recent.flatMap((customer) =>
      customerMissing(customer, "recentCustomers"),
    ),
    ...financial.missing,
  ];
  if (productsPeriod === null) missing.push("last30Days.products.createdAt");
  if (suppliersPeriod === null) missing.push("last30Days.suppliers.createdAt");
  if (unknownRegistrations > 0)
    missing.push("last30Days.customers.registerDate");
  if (undatedTransactions > 0) missing.push("incomeExpensesToday.businessDate");
  return {
    data: {
      user: userDto(user),
      totals: { products, suppliers, customers },
      last30Days: {
        products: productsPeriod,
        suppliers: suppliersPeriod,
        customers: unknownRegistrations > 0 ? null : customerCount,
      },
      recentCustomers: recent.map(customerDto),
      incomeExpensesToday:
        financial.items.length === 0 && undatedTransactions > 0
          ? null
          : financial.items,
    },
    meta: {
      ...completeness(missing),
      periods: { last30Days: periods.last30Days, today: periods.todayPeriod },
    },
  };
}
