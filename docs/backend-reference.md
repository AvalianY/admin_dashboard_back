# Backend technical reference

Authenticated Express 5 API using TypeScript, Node.js 26 LTS, MongoDB and Mongoose. This repository contains the administrative backend; no frontend implementation is included.

## Local setup

1. Install Node.js 26 and make a MongoDB 8.x database available.
2. Run `npm ci`.
3. Copy `.env.example` to `.env`. Configure `MONGODB_URI`, a cryptographically random `JWT_SECRET` of at least 32 characters, and the exact frontend origins in `CORS_ORIGINS` (comma-separated, without trailing paths).
4. Set `INITIAL_USER_NAME`, `INITIAL_USER_EMAIL`, and `INITIAL_USER_PASSWORD` locally, then run `npm run user:init`. The command refuses to overwrite an existing account. Remove the initialization password from the environment when finished.
5. For an authorized local demonstration database, run `npm run seed:demo`. This imports the explicitly synthetic dataset. Original-source import is a separate local operation described below.
6. Run `npm run dev`, or `npm run build` followed by `npm start`.

The default port is 3000. Development, test and production use separate databases and secrets. Do not point tests at a production database. Environment files are excluded from version control. No account password or token signing secret is provided in this repository.

## API

The complete contract is in [docs/openapi.json](openapi.json). Run `npm run docs` after changing contract definitions in `src/openapi.ts`.

| Methods    | Paths                                                    |
| ---------- | -------------------------------------------------------- |
| POST       | `/api/user/login`                                        |
| GET        | `/api/user/logout`, `/api/user/user-info`                |
| GET        | `/api/dashboard`, `/api/orders`                          |
| GET, POST  | `/api/products`, `/api/suppliers`                        |
| PUT        | `/api/products/:productId`, `/api/suppliers/:supplierId` |
| DELETE     | `/api/products/:productId`                               |
| GET        | `/api/customers`                                         |
| GET, PATCH | `/api/customers/:customerId`                             |

All application operations except login require `Authorization: Bearer <token>`. The scheme name is case-insensitive; the exact token value remains case-sensitive. HTTP 401 responses include `WWW-Authenticate: Bearer realm="e-pharmacy"`. Tokens expire after one hour and identify a server-side session. Logout revokes only that session. No public registration, refresh, product restore, order mutation or financial mutation routes are exposed. The public documentation routes are /api-docs/ (Swagger UI) and /api-docs/openapi.json (the same generated specification). They add no business API operations. The existing src/openapi.ts definition generates docs/openapi.json and is compiled into the server; the UI serves that same definition without requiring private source JSON or a separate documentation server.

Success responses use `{ data, meta? }`; errors use `{ error: { code, message, details? } }`. Deletion and logout return 204 without a body. GET logout responses and authenticated data are not cached. Invalid IDs/requests produce 400, invalid authentication 401, disallowed CORS origins 403, missing resources 404, oversized JSON bodies 413, unsupported charset/content encoding 415, and unexpected errors a sanitized 500. A product update racing a category transition or a supplier update racing a monetary change can return 409; reload before retrying. Unexpected request failures emit an `http_request_failed` diagnostic with the method, route template, status and error category; credentials, raw URLs, bodies and exception messages are excluded.

Search uses the `name` parameter as a literal case-insensitive substring. Products and orders accept only the documented `sortBy` fields and `asc`/`desc` `sortOrder`, with identifier tie-breaking. Product default ordering places known creation timestamps newest first, then unknown historical timestamps in original source order. Customer pages default to `page=1&limit=20`, with a maximum limit of 100. Customer ordering is registration date descending and identifier ascending. Other modules do not implicitly paginate.

PUT requires every editable product/supplier field. An existing supplier may retain `amount: null` only while its EUR amount remains unknown; a known EUR amount cannot be cleared, and creation requires a valid amount. PATCH changes only supplied permitted customer profile fields. Unknown mutable fields are rejected. Money is supplied as an exact decimal string; stock is a non-negative safe integer; API calendar dates use `YYYY-MM-DD`. Transport JSON bodies use Express's default 100 KB limit, applied after decompression when applicable. Required text is trimmed and must contain a non-whitespace character; passwords are not trimmed. Text fields have no sample-derived business length limits.

## Source integrity and import

The eight original JSON files and `E-Pharmacy.zip` are private inputs, excluded from Git. Existing local originals remain unchanged in the ignored `data/source/` directory. A clean clone contains no original records. `data/source-manifest.json` is public verification metadata containing only filenames, counts, SHA-256 values and the archive digest; it contains no customer records.

For authorized local original-data operations, set `SOURCE_DATA_DIR` to the directory containing the eight original files, using a private environment setting or hidden/local prompt. Relative paths resolve from the command's working directory. If omitted, the importer uses the ignored `data/source/` beside the repository. The approved manifest stays fixed at `data/source-manifest.json`; changing the directory does not bypass its hashes. Original provenance remains `v1:<content hash>`.

```powershell
$env:SOURCE_DATA_DIR = Read-Host 'Authorized private source directory'
# Local original verification: starts its own isolated MongoDB, never Atlas.
npm run test:source
# WRITE: only after configuring the explicitly authorized target database.
npm run seed
```

The owner authorized the original educational dataset for the public Atlas `e_pharmacy` database on 2026-11-13. Import it directly from the local ignored directory using `npm run seed`; keep original JSON and the archive out of GitHub and Render. Missing originals make `seed` / `test:source` fail clearly; neither substitutes synthetic data. `test:source` runs only against its isolated local MongoDB, never Atlas. See the [deployment runbook](free-deployment.md) for read-only preflight, initial account creation and integrity checks. The synthetic `seed:demo` command is for development and isolated tests, and must not target public `e_pharmacy`.

The public [synthetic dataset](../data/demo/README.md) is independently generated by `scripts/generate-demo.mjs`, without reading original records. It uses numbered demo names, fictional addresses, non-routable phone tokens and reserved `example.test` email/image hosts. Image URLs are placeholders. Its separate manifest uses `demo-v1:<content hash>`. `.gitattributes` preserves LF for demo JSON so checkout normalization cannot invalidate its hashes. `npm run seed:demo` explicitly selects it and ignores `SOURCE_DATA_DIR`. Regenerate with `npm run demo:generate`; tests also verify reproducibility. Never regenerate fixtures into the original directory or mix datasets in one database: the import version guard requires an explicit migration.

The original administration import preserves 60 products, 5 suppliers, 88 customers, 25 orders and 12 financial transactions. Pharmacy lists and reviews remain private source materials; this administrative specification defines no API modules for them. The synthetic dataset deliberately uses the same domain counts to exercise the required behavior; its values are fictional and its hashes/version are distinct.

Each row has a unique ObjectId and source-version/file/position provenance. Original product IDs are retained as non-unique `legacyId` values. Repeated products, customer emails and financial rows are preserved. Source hashes are checked before writing. Reimport uses insert-only operations keyed by provenance; it neither overwrites user edits nor restores logically deleted products. If interrupted, the same version can be rerun. Source corrections require explicit migrations and an approved manifest; changing source JSON is not an ordinary import operation.

| Source field                 | Stored/API interpretation                                                     |
| ---------------------------- | ----------------------------------------------------------------------------- |
| customer `photo` or `image`  | `photo`                                                                       |
| customer `register_date`     | ISO calendar `registerDate`, without an invented time                         |
| order `order_date`           | ISO calendar `orderDate`                                                      |
| order `products`             | integer `productUnits`, not invented positions                                |
| supplier `suppliers`, `date` | `company`, `deliveryDate`                                                     |
| product `id`                 | non-unique `legacyId`                                                         |
| formatted monetary strings   | exact Decimal128, with original lexical form retained in the unchanged source |

Historical `createdAt`/`updatedAt` remain null when unknown. `importedAt` is technical provenance. Neither import time nor the ObjectId timestamp is substituted for a historical business date. New records receive actual creation/modification timestamps.

## Categories, money and deletion

New products use the nine approved categories. Imported Heart/Leg values remain unchanged. An existing product may retain its current legacy category or move into the approved catalog. Switching between legacy categories or returning to legacy is forbidden. A supplier is a string on a product; editing a supplier document does not rename product strings.

Product deletion sets `deletedAt` and retains the document. Deleted products are excluded from active catalogs and product counters. Historical order snapshots are read from the order, never reconstructed from current product data.

Operational currency is EUR. Values without a conflicting source marker use EUR. Supplier values explicitly marked with the BDT symbol retain their exact legacy amount and currency; their normalized EUR `amount` is null. No exchange rate is assumed, no conversion service is used, and unconverted amounts are not aggregated with EUR. A user-entered EUR supplier update is a new current value and does not establish a historical conversion; legacy provenance remains preserved. Financial signs and Income/Expense/Error classifications are retained. Customer `spent` is a stored snapshot, not an inferred sum.

## Completeness and Dashboard

`meta.completeness` is `complete` or `partial`; `meta.missingData` identifies unavailable information. Numeric zero means a confirmed zero, an empty array means a confirmed empty set, and null denotes unavailable information. A non-empty confirmed subset can be returned with partial metadata when other source records cannot be classified.

Dashboard returns separate `totals` and `last30Days`. Initial overall totals are 60/5/88, calculated from the database. Thirty-day metrics use the current UTC calendar date and previous 29 dates, with an exclusive end at the next UTC midnight. Products use known creation dates and exclude deleted records; suppliers use known creation dates; customers use registration dates. Unknown applicable dates make the affected count null, rather than classifying those records outside the period.

Recent Customers contains the five latest registrations across all history, with current profile values. Income/Expenses Today includes only confirmed current-UTC-date transactions. Undated records remain stored but are not falsely included. If no match is known and undated records remain, the section is null; if all dates are known and no transaction matches, it is an empty array.

Initial source limitations are explicit: product/supplier historical creation dates are unknown; all 12 financial dates and all customer countries are unknown; verified customer relationships and historical order positions are absent. Initial order `items` and customer `history` therefore use null with missing-data metadata. Combined history supports distinguishable order/transaction entries once verified links exist. No matching by names or email is performed. Technical relationship status distinguishes unknown, linked and confirmed non-applicable relationships; future corrections must be verified migrations.

## Verification

After a clean clone, `npm ci` followed by `npm run check` runs type checking, lint, all public unit/integration tests and production build without private originals. Public tests explicitly select committed synthetic fixtures and do not skip missing-data checks. They validate actual requests/responses against OpenAPI and validate the document itself. Run `npm audit` for dependency advisories and `npm run docs` to regenerate OpenAPI.

`npm run test:source` is a separate local verification suite for authorized originals. It checks all eight hashes, every imported business field across 190 records, unchanged original provenance, duplicate preservation, reimport and dataset separation. It fails if originals are missing instead of reporting skipped verification as success. It is not a prerequisite for a clean-clone public test run. The command loads `.env` if present; public tests do not need it. Both suites always create their own isolated MongoDB processes.

Integration tests start and stop their own MongoDB 8.0.17 process using `mongodb-memory-server`; the first run needs access to MongoDB's official download host. Binaries are cached under `node_modules/.cache/mongodb-binaries`, or the directory set by `MONGOMS_DOWNLOAD_DIR`. Test databases are ephemeral and isolated. The database TTL cleanup monitor is disabled only in tests because the application clock is controlled; token and session expiration are still explicitly verified. Production retains its session TTL index. Extra fixtures that establish verified historical dates/relationships are restricted to isolated tests; they are not corrections to private originals or cloud demonstration data.

## Render preparation

`render.yaml` explicitly selects one Free Web Service in Frankfurt, Node.js 26.13.0 and disabled automatic deploy triggers. The server binds the assigned port on `0.0.0.0` after connecting to MongoDB. Use the existing MongoDB Atlas Free on AWS Frankfurt; configure the credential-bearing URI only in secret environment settings. For interactive Swagger requests, explicitly allow the current API origin in CORS_ORIGINS. The localhost:3000 documentation origin is included in the development template. Add any future frontend origin only after approval; do not use a wildcard. Initial account creation and original `v1` import via `npm run seed` are authorized local administrative operations, not build/startup hooks. The public database uses 190 original domain records; never import `demo-v1` there. Production build emits compiled code only; startup requires neither original nor synthetic JSON. Render creation/deployment and further Git publication require separate permission.

Follow the [free deployment runbook](free-deployment.md) for current provider references, billing safeguards, environment variables, scoped database/network access, secure initialization, approval gates and all 15 public API smoke tests. In particular, do not attach a payment method or enable the paid Atlas Free-cluster backup subscription. The Blueprint creates no database, disk or worker. Service creation can trigger an initial deployment even when later automatic deployments are off; publication, cloud creation, production writes and deployment require their respective approvals.

## Interactive documentation publication

Swagger UI is implemented locally using swagger-ui-express; /api-docs/openapi.json serves the existing OpenAPI definition. The compiled server includes this definition in dist/openapi.js. Documentation examples are synthetic and no production credentials or JWTs are embedded. persistAuthorization is false; authorization remains in page memory and is cleared on reload. validatorUrl is disabled, so no remote validator receives the specification.

The production documentation URL https://e-pharmacy-api-kz62.onrender.com/api-docs remains pending a separately authorized push and Render deployment. Its current 404 is expected until publication. The Blueprint now sets CORS_ORIGINS to the approved backend origin https://e-pharmacy-api-kz62.onrender.com only. Browser POST requests send Origin even from the same origin; the existing whitelist must allow it. Changing render.yaml locally does not guarantee an update of the existing Render service Environment. Verify the actual value during the separately approved deployment. No frontend origin is configured; the real one must be approved later. Production contains no localhost origin or wildcard. The business CORS/JWT middleware is unchanged.
