# Read-only demo access and controlled rollout

This release adds two server-owned roles without adding endpoints or replacing JWT/session authentication. Git publication is authorized; deployment and production demo provisioning are separate steps. The owner confirmed on 14 November 2026 that public viewing of the original educational v1 data is permitted. This confirmation is not a claim that names or contact details were independently proven fictional. Original JSON remain private and the 190 original domain documents must not be altered.

## Authorization contract

`User.role` is `admin` or `demo` for new accounts. There is no schema default that promotes existing accounts. The existing private `user:init` administrative command explicitly creates an admin. Login accepts only email/password and cannot assign a role. No public registration or role-management endpoint exists.

User DTOs (Login, user-info and Dashboard) include `role`. Legacy/malformed assignments serialize as `null`; they may authenticate, inspect their own profile and log out, but business access returns `403 ROLE_NOT_CONFIGURED`. Only an explicit reviewed migration grants admin rights. An existing administrator's password and JWT/session records are preserved by that migration.

JWT signatures, issuer/audience, one-hour lifetime, token hashing, independent sessions and targeted logout are unchanged. Business middleware uses the database role loaded by the existing authentication middleware on every request. Editing a cached frontend profile, request header, body or JWT role claim cannot authorize writes.

Admin retains all 16 operations. Demo may log in, read its profile, log out and use every business GET, including customer details/history, supported name filtering, sorting and pagination. HEAD is also read-only. The seven mutations below return `403 DEMO_READ_ONLY` before business validation or mutation:

| Method | Route |
| --- | --- |
| POST | `/api/products` |
| PUT | `/api/products/:productId` |
| DELETE | `/api/products/:productId` |
| POST | `/api/suppliers` |
| PUT | `/api/suppliers/:supplierId` |
| POST | `/api/customers` |
| PATCH | `/api/customers/:customerId` |

The safe envelope remains `{ error: { code, message } }`. A rejected origin remains `403 ORIGIN_NOT_ALLOWED`; role denial is not a CORS failure. Invalid/missing/expired authentication remains 401 with its Bearer challenge. The role check protects all non-read business methods, including future mutations mounted within these modules.

## Existing-administrator migration plan

Read-only production inspection found one existing owner account without a role. The reviewed identity is retained privately outside Git. Production migration has not been applied by this release preparation.

1. Use a trusted local administrative process and the reviewed Atlas database. Inspect users and verify the exact existing owner ID/email; never promote a collection of role-less users.
2. Run the default read-only plan with that exact identity:

   ```sh
   npm run user:admin-role -- --id <reviewed-id> --email <reviewed-email>
   ```

3. Review `planned`/zero writes, the target database and the existing account. Apply only in the separately authorized production rollout:

   ```sh
   npm run user:admin-role -- --id <reviewed-id> --email <reviewed-email> --apply
   ```

4. The only update is `$set: { role: "admin" }` with an atomic ID/email/role-absent condition. A conflicting role, missing account, different email or concurrent change stops the operation. Repeating an already-admin migration does nothing. An existing demo account cannot be promoted by this command.
5. Verify that the password hash and session documents are unchanged, the exact owner now has admin and unrelated users remain untouched. Never print hashes, tokens or connection credentials. The old server ignores the extra role field, so perform this narrowly scoped migration **before** deploying the new required business guard; otherwise the unmigrated owner would receive 403.

No startup migration, global backfill, session revocation or credential rotation is performed automatically. These commands are local operator tools, not build/start hooks.

## Demo provisioning after server rollout

Do not run production provisioning during Git publication. First authorize and complete the administrator migration and Render deployment, verify the deployed commit and new OpenAPI role contract, and pass the isolated role suite. The current deployment must contain the guard; source publication alone is insufficient. Keep public credentials undistributed until live authorization checks below pass.

The identity is fixed: **Demo User**, `demo@e-pharmacy.example`. From the trusted Windows workstation, after the actual server/data gates have been verified:

```sh
npm run user:init-demo -- --server-protection-verified --public-data-approved
```

The flags are operator acknowledgments, not an automated assertion that deployment or data approval happened. Configuration uses existing `MONGODB_URI`/`JWT_SECRET`; no demo password environment variable is introduced. Existing process variables take precedence over `.env`, so inspect the target safely before executing. Neither passwords nor full connection strings belong in command arguments or terminal output.

The initializer generates 32 cryptographically random bytes, uses the existing scrypt hashing and stores the password in the current Windows user's Generic Credential Manager under `E-Pharmacy/<database>/demo` (production: `E-Pharmacy/e_pharmacy/demo`). It sends the password to the helper's stdin, never stdout, files or process arguments. The helper refuses existing entries and serializes concurrent helper writes with a named mutex. The administrator's credential target is never accessed.

Secure storage must succeed before inserting the user. A database failure retains the new vault entry for manual reconciliation, rather than discarding the only password recovery material. An orphan vault target requires operator review; do not overwrite it or automatically reset an existing account. Re-running with an existing compatible demo identity returns `exists`, does not generate a replacement password and does not change its role, name, hash or sessions. An incompatible existing role fails. Non-Windows execution refuses provisioning rather than emitting a password through a weaker fallback.

The owner can retrieve the demo credential privately through the existing approved local Windows credential workflow. No real password is included in Git, README, Swagger or public reports. Account creation never creates a session or modifies domain records.

## Verify before distributing credentials

After the protected server is deployed and the private account is provisioned, log in normally and verify user-info, all allowed GETs and independent logout. Safely probe the seven denied methods with empty bodies and invalid resource identifiers: require `403 DEMO_READ_ONLY`. If protection is missing, these probes must remain invalid business requests, not valid production mutations. Check the original BSON baseline before/after. Any 2xx, another role result, CORS mismatch or uncertain deployment stops public demo distribution. Never use valid production update/delete payloads as a protection probe.

The original dataset stays untouched. `seed:demo` remains an unrelated synthetic domain-data importer for isolated development/test databases and must never be used for public-account initialization or against production e_pharmacy.

Frontend release still needs actual hosting/origin and `/api` routing configuration; no live frontend URL is invented. Admin layout is unchanged. Demo uses the same Login, navigation, tables and dialogs with disabled Add/Edit/Delete controls; the backend remains the security boundary.

## Independent verification

`tests/roles.test.ts` uses isolated MongoDB and synthetic imported data. It checks both Login/User DTOs, business reads, every denied mutation with BSON equality, role/header injection, CORS distinction, existing-session role changes, admin CRUD, expiry/logout, exact migration, credential/session preservation, demo idempotence and storage failure. The ordinary integration suite still exercises admin contracts, OpenAPI/Swagger and the compiled server. No production write is needed for these tests.
