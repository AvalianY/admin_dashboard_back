import { categories, legacyCategories } from "./modules/products/model.js";
import { orderStatuses } from "./modules/orders/model.js";
import { z } from "zod";
import { datePattern } from "./shared/dates.js";

type Schema = Record<string, unknown>;
const string = { type: "string" };
const text = {
  ...string,
  minLength: 1,
  pattern: "\\S",
  description: "On input, leading/trailing whitespace is trimmed; at least one non-whitespace character is required.",
};
const email = {
  ...string,
  pattern: z.regexes.email.source,
  description: "Validated by the API's email pattern without trimming. The generic JSON Schema email format is not an additional constraint because its accepted values differ from that pattern.",
};
const integer = {
  type: "integer",
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
};
const decimal = {
  type: "string",
  format: "decimal128",
  pattern: "^-?[0-9]+(\\.[0-9]+)?$",
  description:
    "Exact BSON Decimal128 decimal (34 significant digits, supported Decimal128 exponent range); no binary floating-point conversion.",
};
const id = { type: "string", pattern: "^[a-fA-F0-9]{24}$" };
const date = { type: "string", format: "date", pattern: datePattern.source };
const instant = { type: "string", format: "date-time" };
const nullable = (schema: Schema): Schema => ({
  anyOf: [schema, { type: "null" }],
});
const array = (items: Schema): Schema => ({ type: "array", items });
const ref = (name: string): Schema => ({
  $ref: `#/components/schemas/${name}`,
});
const object = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): Schema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const categoryValues = [...categories];
const category = { type: "string", enum: categoryValues };
const legacyCategory = {
  type: "string",
  enum: [...categoryValues, ...legacyCategories],
};
const productFields = {
  name: text,
  category,
  stock: integer,
  suppliers: text,
  price: { ...decimal, pattern: "^[0-9]+(\\.[0-9]+)?$" },
};
const supplierFields = {
  name: text,
  address: text,
  company: text,
  deliveryDate: date,
  amount: productFields.price,
  status: { type: "string", enum: ["Active", "Deactive"] },
};
const profileFields = {
  name: text,
  email,
  address: text,
  phone: text,
  country: nullable(text),
};
const timestamps = {
  createdAt: nullable(instant),
  updatedAt: nullable(instant),
};
const schemas: Record<string, Schema> = {
  Error: object({
    error: object({ code: string, message: string, details: {} }, [
      "code",
      "message",
    ]),
  }),
  Meta: object(
    {
      completeness: { type: "string", enum: ["complete", "partial"] },
      missingData: array(string),
      pagination: object({
        page: { ...integer, minimum: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100 },
        total: integer,
        totalPages: integer,
      }),
      periods: ref("Periods"),
    },
    ["completeness", "missingData"],
  ),
  Period: object({
    from: instant,
    toExclusive: instant,
    timeZone: { const: "UTC" },
  }),
  Periods: object({ last30Days: ref("Period"), today: ref("Period") }),
  User: object({ id, name: string, email }),
  Login: object({
    email,
    password: { ...string, minLength: 1 },
  }),
  LoginResult: object({
    accessToken: string,
    tokenType: { const: "Bearer" },
    expiresAt: instant,
    user: ref("User"),
  }),
  ProductCreate: object(productFields),
  ProductUpdate: object({
    ...productFields,
    category: {
      ...legacyCategory,
      description:
        "Legacy value may only be retained by that existing record; otherwise use an approved category. Heart/Leg transitions and returning to legacy are forbidden.",
    },
  }),
  Product: object({
    id,
    legacyId: nullable(string),
    name: string,
    photo: nullable(string),
    category: legacyCategory,
    stock: integer,
    suppliers: string,
    price: decimal,
    currency: { const: "EUR" },
    ...timestamps,
  }),
  SupplierCreate: object(supplierFields),
  SupplierUpdate: object({
    ...supplierFields,
    amount: {
      ...nullable(supplierFields.amount),
      description: "Null may only retain an existing unknown EUR amount. Replacing a known EUR amount with null returns 400. A supplied EUR amount becomes the current value without converting legacy BDT. An intervening monetary change returns 409; reload before retrying.",
    },
  }),
  Supplier: object({
    id,
    name: string,
    address: string,
    company: string,
    deliveryDate: date,
    amount: nullable(decimal),
    currency: { const: "EUR" },
    legacyMoney: nullable(
      object({ amount: decimal, currency: { const: "BDT" } }),
    ),
    status: supplierFields.status,
    ...timestamps,
  }),
  CustomerPatch: { ...object(profileFields, []), minProperties: 1 },
  Customer: object({
    id,
    ...profileFields,
    photo: nullable(string),
    registerDate: date,
    spent: decimal,
    currency: { const: "EUR" },
    ...timestamps,
  }),
  OrderItem: object({
    productId: nullable(id),
    productName: string,
    quantity: integer,
    unitPrice: nullable(decimal),
    amount: nullable(decimal),
    currency: { const: "EUR" },
  }),
  Order: object({
    id,
    name: string,
    photo: nullable(string),
    address: string,
    productUnits: integer,
    price: decimal,
    currency: { const: "EUR" },
    status: { type: "string", enum: orderStatuses },
    orderDate: nullable(date),
    customerId: nullable(id),
    items: nullable(array(ref("OrderItem"))),
    ...timestamps,
  }),
  Transaction: object({
    id,
    name: string,
    amount: decimal,
    currency: { const: "EUR" },
    type: { type: "string", enum: ["Income", "Expense", "Error"] },
    businessDate: nullable(date),
    customerId: nullable(id),
    customerEmail: nullable(string),
    ...timestamps,
  }),
  HistoryEntry: {
    oneOf: [
      object({
        id,
        type: { const: "order" },
        customerId: id,
        date: nullable(date),
        details: ref("Order"),
      }),
      object({
        id,
        type: { const: "transaction" },
        customerId: id,
        date: nullable(date),
        details: ref("Transaction"),
      }),
    ],
  },
  CustomerDetails: object({
    customer: ref("Customer"),
    history: nullable(array(ref("HistoryEntry"))),
  }),
  Dashboard: object({
    user: ref("User"),
    totals: object({
      products: integer,
      suppliers: integer,
      customers: integer,
    }),
    last30Days: object({
      products: nullable(integer),
      suppliers: nullable(integer),
      customers: nullable(integer),
    }),
    recentCustomers: array(ref("Customer")),
    incomeExpensesToday: nullable(array(ref("Transaction"))),
  }),
};
const parameter = (name: string, schema: Schema) => ({
  name,
  in: "query",
  required: false,
  schema,
});
const nameSearch = parameter("name", {
  ...string,
  description:
    "Literal case-insensitive substring; leading/trailing whitespace is trimmed and regex metacharacters are not executable. Empty input does not filter.",
});
const sort = (fields: string[], defaultField: string) => [
  parameter("sortBy", { type: "string", enum: fields, default: defaultField }),
  parameter("sortOrder", {
    type: "string",
    enum: ["asc", "desc"],
    default: "desc",
  }),
];
const response = (data: Schema) => ({
  description:
    "Success. Null means unavailable, never a confirmed zero or empty set. Partial lists contain only confirmed records.",
  content: {
    "application/json": {
      schema: object({ data, meta: ref("Meta") }, ["data"]),
    },
  },
});
const errors = Object.fromEntries(
  [400, 401, 403, 404, 413, 415, 500].map((status) => [
    status,
    {
      description: (
        {
          400: "Invalid request",
          401: "Invalid credentials or authentication",
          403: "Origin not allowed",
          404: "Resource not found",
          413: "JSON body exceeds the unchanged 100 KB parser limit (after decompression when applicable)",
          415: "Unsupported request charset or Content-Encoding",
          500: "Unexpected failure",
        } as Record<number, string>
      )[status],
      content: { "application/json": { schema: ref("Error") } },
      ...(status === 401
        ? {
            headers: {
              "WWW-Authenticate": {
                description: "Bearer authentication challenge without token or internal error details.",
                schema: { type: "string", const: 'Bearer realm="e-pharmacy"' },
              },
            },
          }
        : {}),
    },
  ]),
);
function operation(
  summary: string,
  data: Schema | null,
  options: {
    body?: string;
    status?: number;
    parameters?: unknown[];
    public?: boolean;
  } = {},
) {
  const status = options.status ?? 200;
  return {
    summary,
    security: options.public ? [] : [{ bearerAuth: [] }],
    ...(options.parameters ? { parameters: options.parameters } : {}),
    ...(options.body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: ref(options.body) } },
          },
        }
      : {}),
    responses: {
      [status]:
        data === null
          ? { description: "Success; no response body." }
          : response(data),
      ...errors,
    },
  };
}
const pathId = (name: string) => [
  { name, in: "path", required: true, schema: id },
];

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "E-Pharmacy API",
    version: "1.0.0",
    description:
      "Authenticated administration API. Overall counters and 30-day statistics are separate. Unknown historical values use null with completeness metadata. New monetary values use EUR; legacy BDT is preserved without conversion. Unknown request body/query fields are rejected. JSON bodies have a 100 KB limit after decompression; invalid bodies return 400, oversized bodies 413, and unsupported charset/content encoding 415. The custom decimal128 format requires an exact BSON Decimal128 value; validators must enable that format in addition to the lexical pattern.",
  },
  paths: {
    "/api/user/login": {
      post: operation(
        "Create an independent one-hour session",
        ref("LoginResult"),
        { public: true, body: "Login" },
      ),
    },
    "/api/user/logout": {
      get: operation("Revoke the current session", null, { status: 204 }),
    },
    "/api/user/user-info": {
      get: operation("Authenticated user profile", ref("User")),
    },
    "/api/dashboard": {
      get: operation(
        "Live Dashboard; Today and the current UTC date plus previous 29 dates",
        ref("Dashboard"),
      ),
    },
    "/api/products": {
      get: operation(
        "Active products; known creation dates first, then stable source order by default",
        object({ items: array(ref("Product")), categories: array(category) }),
        {
          parameters: [
            nameSearch,
            ...sort(
              ["name", "category", "stock", "suppliers", "price", "createdAt"],
              "createdAt",
            ),
          ],
        },
      ),
      post: operation(
        "Create an EUR product in an approved category",
        ref("Product"),
        { body: "ProductCreate", status: 201 },
      ),
    },
    "/api/products/{productId}": {
      put: operation(
        "Replace editable fields; preserve historical and import metadata",
        ref("Product"),
        { body: "ProductUpdate", parameters: pathId("productId") },
      ),
      delete: operation("Logically delete an active product", null, {
        status: 204,
        parameters: pathId("productId"),
      }),
    },
    "/api/suppliers": {
      get: operation(
        "List suppliers, ordered by name and identifier",
        object({ items: array(ref("Supplier")) }),
        { parameters: [nameSearch] },
      ),
      post: operation("Create an EUR supplier record", ref("Supplier"), {
        body: "SupplierCreate",
        status: 201,
      }),
    },
    "/api/suppliers/{supplierId}": {
      put: operation(
        "Replace editable supplier fields without renaming product strings",
        ref("Supplier"),
        { body: "SupplierUpdate", parameters: pathId("supplierId") },
      ),
    },
    "/api/customers": {
      get: operation(
        "Customers ordered by registration date descending, then identifier",
        object({ items: array(ref("Customer")) }),
        {
          parameters: [
            nameSearch,
            parameter("page", {
              type: "integer",
              minimum: 1,
              maximum: Number.MAX_SAFE_INTEGER,
              default: 1,
              description: "Serialize as positive base-10 digits without leading zeroes.",
            }),
            parameter("limit", {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 20,
              description: "Serialize as positive base-10 digits without leading zeroes.",
            }),
          ],
        },
      ),
    },
    "/api/customers/{customerId}": {
      get: operation(
        "Customer with combined verified order and financial history",
        ref("CustomerDetails"),
        { parameters: pathId("customerId") },
      ),
      patch: operation(
        "Modify only supplied permitted profile fields",
        ref("Customer"),
        { body: "CustomerPatch", parameters: pathId("customerId") },
      ),
    },
    "/api/orders": {
      get: operation(
        "Order information including immutable snapshots or explicitly unknown positions",
        object({ items: array(ref("Order")) }),
        {
          parameters: [
            nameSearch,
            ...sort(
              [
                "name",
                "address",
                "productUnits",
                "price",
                "orderDate",
                "status",
              ],
              "orderDate",
            ),
          ],
        },
      ),
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Scheme names are case-insensitive. The exact token value remains case-sensitive and is verified against its JWT signature and server-side session. HTTP 401 includes a Bearer challenge.",
      },
    },
    schemas,
  },
};

Object.assign(openapi.paths["/api/products/{productId}"].put.responses, {
  409: {
    description:
      "A concurrent category transition changed the resource. Reload before retrying.",
    content: { "application/json": { schema: ref("Error") } },
  },
});

Object.assign(openapi.paths["/api/suppliers/{supplierId}"].put.responses, {
  409: {
    description: "A concurrent monetary change modified the supplier. Reload before retrying.",
    content: { "application/json": { schema: ref("Error") } },
  },
});
