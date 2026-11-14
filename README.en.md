<div align="center">

[Deutsch](README.md) · [Українська](README.uk.md) · [English](README.en.md)

# E-Pharmacy Backend

### A protected REST API for a pharmacy administration dashboard

[![Node.js](https://img.shields.io/badge/Node.js-26.13.0-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.3.0-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas_Free-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Mongoose](https://img.shields.io/badge/Mongoose-9.12.0-880000?logo=mongoose&logoColor=white)](https://mongoosejs.com/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1.0-6BA539?logo=openapiinitiative&logoColor=white)](docs/openapi.json)
[![Swagger UI](https://img.shields.io/badge/Swagger_UI-5.35.0-85EA2D?logo=swagger&logoColor=000)](#swagger-documentation)
[![Deployment](https://img.shields.io/badge/Deployment-Render_Free-000000?logo=render&logoColor=white)](https://e-pharmacy-api-kz62.onrender.com)

[Repository](https://github.com/AvalianY/admin_dashboard_back) · [Live API](https://e-pharmacy-api-kz62.onrender.com) · [Swagger UI](https://e-pharmacy-api-kz62.onrender.com/api-docs/)

**Swagger UI: live**

</div>

## Table of Contents

- [About the Project](#about-the-project)
- [Features](#features)
- [Technologies](#technologies)
- [API Endpoints](#api-endpoints)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Installation and Startup](#installation-and-startup)
- [Environment Variables](#environment-variables)
- [Data Import](#data-import)
- [Available Scripts](#available-scripts)
- [Swagger Documentation](#swagger-documentation)
- [Deployment](#deployment)
- [Testing and Quality](#testing-and-quality)
- [Author](#author)

## About the Project

**E-Pharmacy Backend** is the standalone server application for a pharmacy administration system. Its REST API provides protected access to products, suppliers, customers, historical orders and Dashboard metrics, backed by MongoDB Atlas.

This repository contains a modular Express backend. A completed frontend application is not included. The deployed server uses the approved original educational dataset of **190 domain documents**.

## Features

- JWT login with independent one-hour server-side sessions and targeted logout
- Product catalog with creation, full updates and soft deletion
- Supplier management with EUR amounts and preserved historical BDT information
- Customer creation, paginated lists, PATCH profile updates and verified customer history
- Read-only historical orders with preserved order snapshots
- Dashboard totals, separate 30-day statistics, five latest registrations and daily financial data
- Literal name search; product/order sorting; customer pagination
- Strict Zod validation, centralized errors and exact Decimal128 monetary values
- Explicit null/partial metadata for incomplete historical information
- SHA-256-verified idempotent imports with provenance and separate original/test datasets
- An OpenAPI contract and interactive Swagger UI with Bearer Authorization

## Technologies

| Technology | Version | Role |
| --- | --- | --- |
| Node.js | 26.13.0 (>=26 <27) | Runtime pinned in .node-version |
| TypeScript | 6.0.3 | Static typing |
| Express | 5.3.0 | HTTP routing and middleware |
| MongoDB Atlas | Free / MongoDB 8.0 | Persistent domain records and sessions |
| Mongoose | 9.12.0 | Models, schemas and data access |
| Zod | 4.6.7 | Configuration and request validation |
| JWT / jose | 6.2.17 | JWT signing and verification |
| Vitest / Supertest | 5.1.0 / 7.3.2 | Tests and HTTP integration |
| OpenAPI / Ajv | 3.1.0 / 8.20.0 | API contract and schema validation |
| Swagger UI Express / UI | 5.0.1 / 5.35.0 | Interactive documentation inside the existing server |
| Render | Free, Frankfurt | HTTPS hosting in Frankfurt |

## API Endpoints

| Method | Endpoint | Purpose | Bearer |
| --- | --- | --- | --- |
| POST | `/api/user/login` | Log in and create a session | No |
| GET | `/api/user/user-info` | Read the authenticated profile | Yes |
| GET | `/api/user/logout` | Revoke the current session | Yes |
| GET | `/api/dashboard` | Read Dashboard metrics and sections | Yes |
| GET | `/api/products` | Search and sort active products | Yes |
| POST | `/api/products` | Create a product | Yes |
| PUT | `/api/products/{productId}` | Replace all editable product fields | Yes |
| DELETE | `/api/products/{productId}` | Soft-delete a product | Yes |
| GET | `/api/suppliers` | Search suppliers | Yes |
| POST | `/api/suppliers` | Create a supplier | Yes |
| PUT | `/api/suppliers/{supplierId}` | Fully update a supplier | Yes |
| GET | `/api/customers` | Search and paginate customers | Yes |
| POST | `/api/customers` | Create a customer with server-owned registration and zero EUR spent | Yes |
| GET | `/api/customers/{customerId}` | Read a customer profile and verified history | Yes |
| PATCH | `/api/customers/{customerId}` | Partially update permitted profile fields | Yes |
| GET | `/api/orders` | Search and sort orders | Yes |

Successful responses use `{ data, meta? }`; errors use `{ error: { code, message, details? } }`. Creation returns 201; logout and deletion return 204 without a body. Protected operations require `Authorization: Bearer <token>`; 401 responses include a Bearer challenge. PUT requires every editable field; PATCH changes only the supplied permitted profile fields.

`POST /api/customers` requires `name`, `email`, `address` and `phone`; `country` is optional (string or null, default null). Existing text/email validation applies and duplicate emails are allowed. The server sets the current UTC registration date, creation/modification timestamps and exact Decimal128 zero EUR spent. Photo/import time are null, import provenance is absent, and no login account or purchase history is created. Unknown fields, including client-supplied financial, date and technical fields, are rejected.

The complete parameters, schemas and status codes are defined in the [OpenAPI contract](docs/openapi.json). Swagger routes document these **16 business operations** and do not add business operations.

## Architecture

Modules in `src/modules/` separate routers, services and Mongoose models. Zod validates input before database access; shared utilities handle DTOs, money, UTC periods, completeness metadata and errors.

The domain collections are `products`, `suppliers`, `customers`, `orders` and `financialtransactions`. Authentication uses `users` and `sessions`. JWTs reference server-side sessions, with stored token hashes supporting targeted revocation. There are no public registration or refresh routes.

`src/openapi.ts` generates `docs/openapi.json`; the same definition is compiled into the server for Swagger. Detailed import, category and historical-data rules are preserved in the [technical reference](docs/backend-reference.md).

## Project Structure

```text
admin_dashboard_back/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config.ts
│   ├── db.ts
│   ├── documentation.ts
│   ├── openapi.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── customers/
│   │   ├── dashboard/
│   │   ├── orders/
│   │   ├── products/
│   │   ├── suppliers/
│   │   └── transactions/
│   ├── shared/
│   ├── import/
│   └── scripts/
├── docs/
│   ├── openapi.json
│   ├── backend-reference.md
│   └── free-deployment.md
├── tests/
├── local-tests/
├── data/
│   ├── demo/
│   └── source-manifest.json
├── scripts/generate-demo.mjs
├── .env.example
├── .node-version
├── README.md
├── README.uk.md
├── README.en.md
├── package.json
└── render.yaml
```

## Installation and Startup

Requirements: Node.js **26.x** (reference runtime **26.13.0**), npm, Git and a separate MongoDB 8.x development database.

For a new clone:

```bash
git clone https://github.com/AvalianY/admin_dashboard_back.git
cd admin_dashboard_back
npm ci
```

Then create `.env` from `.env.example`: `cp .env.example .env`, or `Copy-Item .env.example .env` in PowerShell. Configure a **separate development database**, a random JWT_SECRET of at least 32 characters and the exact allowed origins. Do not use the production connection for local tests.

One-time account initialization requires your real INITIAL_USER_* values entered locally. Supply the password through a hidden process prompt and clear it afterwards; do not store it in project files. Existing accounts are never overwritten. See the [technical reference](docs/backend-reference.md).

```bash
npm run user:init
npm run seed:demo
npm run dev
```

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Required MongoDB connection with an explicit database name; configure privately |
| `JWT_SECRET` | Required random signing key of at least 32 characters; keep stable across restarts |
| `NODE_ENV` | development, test or production; defaults to development |
| `PORT` | Defaults to 3000 locally; use the assigned PORT on Render |
| `CORS_ORIGINS` | Comma-separated exact origins without paths or wildcards; http://localhost:3000 for local Swagger UI |
| `SOURCE_DATA_DIR` | Optional private original JSON directory; defaults to data/source/ |
| `INITIAL_USER_NAME` | Name for one-time user:init; local administrative process only |
| `INITIAL_USER_EMAIL` | Valid email for user:init; no server default |
| `INITIAL_USER_PASSWORD` | Hidden local password for user:init only; never configure on Render |

Existing process variables take precedence over `.env`, including with `--env-file-if-exists`. `.env`, original JSON and the source archive are excluded from Git. A clean clone contains no original personal records.

## Data Import

The two sources are intentionally separate:

| Source | Command | Use |
| --- | --- | --- |
| `v1` | `npm run seed` | Original educational dataset from ignored local data/source/; production e_pharmacy, 190 documents |
| `demo-v1` | `npm run seed:demo` | Deterministic synthetic data from data/demo/; development and isolated tests only |

Each import checks its own manifest and SHA-256, preserves every source row including duplicates and assigns unique provenance. Reimporting the same source adds no documents and does not overwrite user edits. Consequently, `seed` is **not a backup restore**. Original JSON must not be uploaded to GitHub or Render.

Production contains 60 products, 5 suppliers, 88 customers, 25 orders and 12 financial transactions. Unknown historical values remain unknown; BDT is not converted to EUR using an invented exchange rate. Never run `seed:demo` against the public production database.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | TypeScript development server with watch mode |
| `npm run build` | Compile TypeScript into dist/ |
| `npm start` | Start the compiled production server |
| `npm run typecheck` | Check types without emitting files |
| `npm run lint` | Run ESLint |
| `npm test` | Run the public isolated test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:source` | Verify originals separately in isolation; missing files fail explicitly |
| `npm run seed` | Import the approved original source |
| `npm run seed:demo` | Import synthetic development data |
| `npm run demo:generate` | Reproduce synthetic fixtures deterministically |
| `npm run user:init` | Initialize an account once without overwriting an existing account |
| `npm run docs` | Generate OpenAPI JSON from the existing definition |
| `npm run check` | Run typecheck, ESLint, tests and build in sequence |

## Swagger Documentation

Local UI: [http://localhost:3000/api-docs](http://localhost:3000/api-docs). It displays all 16 operations grouped by module, parameters, request/response examples, schemas and HTTP status codes. The JSON document is served at `/api-docs/openapi.json`. All examples are synthetic.

1. Expand the relevant module and operation.
2. Log in with your own credentials to obtain a token.
3. Enter only the token value in **Authorize** for the existing Bearer scheme.
4. Enable **Try it out** and execute the request deliberately.
5. Use Logout to revoke the current session.

Tokens are not persisted across reloads or browser sessions. Mutation requests change the selected database; production use requires a separately authorized test window with backup and restoration. Browser requests require the exact API origin in CORS_ORIGINS; protected operations still require JWT authentication.

Public Swagger UI: [https://e-pharmacy-api-kz62.onrender.com/api-docs/](https://e-pharmacy-api-kz62.onrender.com/api-docs/). The interactive documentation is deployed on Render with the existing Bearer scheme. The local customer-creation extension brings the contract to 16 operations; publishing it to GitHub and Render requires separate approval. Do not assume that the new POST is already available on production.

## Deployment

The existing API is live at [https://e-pharmacy-api-kz62.onrender.com](https://e-pharmacy-api-kz62.onrender.com) on **Render Free in Frankfurt**, using **MongoDB Atlas Free on AWS Frankfurt**. The root path may return 404; business operations are protected.

`render.yaml` pins Node 26.13.0, `npm ci --include=dev && npm run build`, `npm start` and disabled automatic deployments. After connecting to MongoDB, the server binds to `0.0.0.0` on the assigned PORT. Credentials belong in private environment settings; initialization and imports are not build/start hooks.

Render Free spins down idle services, so the next request may trigger a cold start. Durable data and sessions remain in Atlas; the service filesystem is ephemeral. [Free limits](https://render.com/docs/free). `render.yaml` allows only `https://e-pharmacy-api-kz62.onrender.com` as the production origin for Swagger. The actual Render Environment Settings must match this configuration: changing the local YAML does not automatically update an existing service. The frontend origin will be added only after approval.

Deployment procedure, secure administration and approval boundaries: [deployment runbook](docs/free-deployment.md). Further publication steps require separate approval.

## Testing and Quality

Public tests start their own ephemeral MongoDB instances and use synthetic fixtures without private originals. `test:source` checks originals separately and fails rather than skipping unavailable files. Tests do not run against Atlas.

The suite covers authentication, sessions, catalogs, Dashboard, import, request/response contracts, error handling and the actual compiled server. Swagger checks cover HTML, local assets, all 16 operations, examples, Bearer configuration, token-persistence settings and unchanged CORS/JWT boundaries. Customer-creation tests use an isolated MongoDB and cover validation, UTC boundaries, Decimal128, five-row pagination, profile updates, Dashboard and preservation of existing records.

**Live evidence from 2026-11-13:** all 15 business operations, 74 HTTPS requests and exact restoration of all 190 original documents after temporary test mutations — PASS. An earlier run also verified 49 safe HTTPS scenarios including a cold start. Following publication, the public Swagger UI and its OpenAPI JSON return HTTP 200; the specification includes all 15 operations and the existing Bearer scheme.

Local customer-creation extension checks passed: TypeScript, ESLint, production build, **200 public tests** and **5 separate original-data tests**; `npm audit` reports **0 known vulnerabilities**. A separate browser check of the compiled server renders all 16 Swagger operations and verifies the new request body, documented 201 response, Bearer transmission and cleared authorization after reload. Its dummy token returns the expected 401 without a database connection; valid creation is verified against isolated MongoDB by integration tests. Production acceptance of the new operation is still pending. Reproduce the local checks:

```bash
npm run check
npm run test:source
npm audit
```

## Author

This backend was developed as an **individual project**.

GitHub: [@AvalianY](https://github.com/AvalianY)

---

<div align="center">

An independent backend project focused on protected API contracts, traceable data and reproducible verification.

</div>
