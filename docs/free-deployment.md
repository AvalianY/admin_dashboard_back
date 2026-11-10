# Free deployment runbook

Status: preparation only. Provider documentation checked on 2026-11-09.
No cloud resources, production database changes, Git publication or deployments
are authorized by this document. Obtain the approvals listed below before
executing the corresponding steps.

Data publication policy: private original JSON and the source archive are excluded
from Git and must remain local. Permission to transfer those originals to Atlas
has not been confirmed. All cloud-demo instructions below use only the separate,
fictional `data/demo/` dataset, its own manifest and `demo-v1` provenance.

## 1. Target and availability

Use one Render **Free** Web Service in **Frankfurt**, native Node.js **26.13.0**,
and one MongoDB Atlas **Free** cluster on AWS **eu-central-1**. Keep the existing
GitHub repository and its visibility. Use the assigned HTTPS `onrender.com`
address; a custom domain is unnecessary.

Render documents Free web services and Frankfurt; the Atlas AWS matrix marks
Frankfurt as supporting Free clusters. Account eligibility and available capacity
still require confirmation in the creation forms. If the Free/Frankfurt
combination is missing, stop and report the actual free choices. Do not select a
different region or tier without approval.

References: [Render Free](https://render.com/docs/free),
[Render regions](https://render.com/docs/regions),
[Atlas AWS matrix](https://www.mongodb.com/docs/atlas/reference/amazon-aws/),
[Atlas Free creation](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).

## 2. Zero-cost gate

Check all of these in the actual accounts immediately before creating resources:

- Render workspace is the no-monthly-fee Hobby plan; compute is explicitly Free.
- Atlas cluster is explicitly Free/M0, with a displayed zero price.
- The target Render workspace and Atlas billing organization have no payment
  method or billable marketplace arrangement for this deployment.
- No paid trial, upgrade, autoscaling or supplementary purchase is selected.
- No Render database, disk, worker, cron service or preview deployment is added.
- No dedicated outbound IP, private endpoint, peering or paid monitoring is added.
- Atlas backup subscription is OFF. Do not enable an "Add Backups" offer.
- The owner can inspect Render Billing/usage and Atlas Billing/cluster metrics.
- Shared workspace quotas leave room for this project.
- If a payment method is required, stop that setup. Do not add one.

Render can bill Free services for overages when a payment method is attached.
Without one, bandwidth exhaustion suspends services and exhausted pipeline
minutes stop new builds. A build spending limit is not a universal billing cap.
[Billing behavior](https://render.com/docs/faq).

Atlas now offers an optional **paid** Free-cluster backup subscription:
$0.10/day, capped at $3/month. It requires a payment method. Leave it disabled;
the word "Free" in the cluster name does not make that subscription free.
[Backup terms](https://www.mongodb.com/docs/atlas/backup/cloud-backup/free-cluster-backup/).

## 3. Render configuration

The repository's `render.yaml` defines only:

```yaml
services:
  - type: web
    name: e-pharmacy-api
    runtime: node
    plan: free
    region: frankfurt
    buildCommand: npm ci --include=dev && npm run build
    startCommand: npm start
    autoDeployTrigger: "off"
    envVars:
      - key: NODE_VERSION
        value: "26.13.0"
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: CORS_ORIGINS
        value: ""
```

The lockfile controls installation; TypeScript remains available during build.
Build does not connect to MongoDB, initialize users or import data. `npm start`
runs the compiled `dist/server.js`, not a TypeScript development server.

`.node-version` also pins 26.13.0; `package.json` permits `>=26 <27`.
Render's explicit NODE_VERSION overrides its default runtime. Confirm the actual
Node version in the first build log; do not downgrade if provisioning fails.
[Runtime selection](https://render.com/docs/node-version),
[Node release](https://nodejs.org/en/blog/release/v26.13.0).

No HTTP health-check path is configured: the approved API has no public health
endpoint, and authenticated endpoints return 401 without credentials. Keep the
default TCP probe. The application binds `0.0.0.0` on the assigned PORT only
after its initial database connection succeeds. A TCP probe does not replace
the authenticated API/database smoke tests.
[Web service binding](https://render.com/docs/web-services),
[Health checks](https://render.com/docs/health-checks).

Blueprint creation can initiate the first deployment even with future automatic
deployments disabled. Creation therefore needs approval for that initial attempt.
The generated JWT secret is assigned if absent, not regenerated on each start.
Keep its value stable. When adding a frontend later, update the authorized
origin in Render and reconcile `render.yaml` so a later Blueprint sync does not
restore the initial empty value.
[Blueprint reference](https://render.com/docs/blueprint-spec).

## 4. Environment inventory

| Variable | Purpose and requirement | Secret | Location/default |
| --- | --- | --- | --- |
| MONGODB_URI | Required; explicit Atlas host and application database | Yes | Render secret; temporarily local for approved administration. No application default. The template's localhost URI is development-only. |
| JWT_SECRET | Required; at least 32 characters | Yes | Stable Render-generated value. Local CLI also requires a value because configuration is shared. No application default. |
| NODE_ENV | Application mode | No | Explicit `production` on Render; application default `development`. |
| PORT | HTTP listening port | No | Use Render's assigned value; do not hardcode a dashboard override. Local default 3000; Render normally supplies 10000. |
| NODE_VERSION | Render runtime selection, not read by application config | No | 26.13.0 in Blueprint and `.node-version`. |
| CORS_ORIGINS | Comma-separated exact authorized origins | No | Empty on initial Render deployment; application default empty. Development template allows localhost:5173. |
| INITIAL_USER_NAME | Required only by `user:init` | Private profile value | Local administrative process only; no default. |
| INITIAL_USER_EMAIL | Required only by `user:init` | Private profile value | Local administrative process only; no default. |
| INITIAL_USER_PASSWORD | Required only by `user:init` | Yes | Hidden local prompt; no default. Never configure it on Render. |
| SOURCE_DATA_DIR | Optional private original JSON directory for local `seed` and `test:source` only | Private local path | Default ignored `data/source/`; never needed on Render or by public tests/`seed:demo`. |

`MONGOMS_DOWNLOAD_DIR` is an optional local test-cache setting, not a production
requirement. No additional application environment variables are needed.

An empty CORS list permits requests without an Origin header, such as native
CLI clients, and rejects browser origins. It does not make the API public to
unauthenticated clients. Do not invent a frontend domain or use `*`.

Use provider secret fields and a trusted local process. Never paste credentials,
JWTs or credential-bearing URIs into chat, logs, screenshots or Git. Environment
variables inherited by child processes must be handled on a trusted workstation.

## 5. Local preflight and Git gates

With Node 26.13.0 and an isolated local test database environment:

```powershell
node --version
npm ci --include=dev
npm run check
npm audit
```

The public tests use committed synthetic fixtures; they work without `.env` or
private original JSON. `npm run test:source` is a separate local check, fails if
original files are unavailable and must never be counted as verified by skipping it.
The public tests validate the published OpenAPI artifact and compiled startup. Inspect
`render.yaml` against the [official schema](https://render.com/schema/render.yaml.json)
and verify that only the one Free service is present. A schema check does not
confirm account eligibility or available regional capacity.

Review source, lockfile, configuration, tests, synthetic demo JSON/manifest,
the original hash-only manifest and docs. Original JSON and the original ZIP
must not be staged, including when the repository is private.
`dist`, `node_modules`, coverage, logs and real environment files stay excluded;
Render regenerates compiled files during build. No essential source files may
be excluded. Use `git rev-parse --git-path info/exclude` for narrowly scoped local
operational exclusions if such files exist; do not add those rules to `.gitignore`.

Initial commit message: `feat: initialize E-Pharmacy backend`.
Review the exact file manifest and obtain **commit approval before staging**.
Then obtain **separate push approval** for the existing remote and branch.
Do not create another repository or change visibility. Record the approved
commit hash before connecting Render.

## 6. Atlas account, cluster and database user

After explicit cloud-creation approval:

1. Sign in or create the Atlas account; create/select the project for this app.
2. Select **Free/M0**, **AWS**, **Frankfurt/eu-central-1**. Inspect the zero-price
   summary before submission. Leave backups and all paid options disabled.
3. Keep the MongoDB version managed by Free; current documentation specifies 8.0.
   Do not select a paid tier to pin a patch version.
4. In Database Access create a dedicated password-authenticated database user.
   Assign `readWrite` to **e_pharmacy only**, all its collections, and restrict
   the user to this cluster where the UI offers that option. This supports the
   app's reads, writes, collection creation and indexes. Do not grant atlasAdmin,
   dbAdminAnyDatabase or readWriteAnyDatabase.
5. Store the database credentials privately. Atlas account credentials and the
   application administrator password are separate identities.
6. In Connect > Drivers obtain the Atlas URI. Specify `/e_pharmacy` before its
   query string, retain the provider's TLS/SRV options and use `authSource=admin`
   for the Atlas SCRAM user. Percent-encode credential components where needed.
   Do not disable TLS verification or default to the `test` database.

[Database user configuration](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/),
[Database role scope](https://www.mongodb.com/docs/manual/reference/built-in-roles/).

After the temporary workstation network rule is active, this standalone
PowerShell check is **read only** and can be used before production-write approval:

```powershell
$atlasPreviousUri = [Environment]::GetEnvironmentVariable('MONGODB_URI', 'Process')
try {
  $atlasSecureUri = Read-Host 'Atlas URI for e_pharmacy (hidden)' -AsSecureString
  $env:MONGODB_URI = [System.Net.NetworkCredential]::new('', $atlasSecureUri).Password
  $atlasReadOnly = @'
import mongoose from 'mongoose';
try {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000, autoCreate: false, autoIndex: false
  });
  if (mongoose.connection.name !== 'e_pharmacy') throw new Error('Unexpected database');
  await mongoose.connection.db.command({ ping: 1 });
  console.info('Connected to the expected e_pharmacy database.');
} catch {
  console.error('Connectivity or database identity check failed.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
'@
  $atlasReadOnly | node --input-type=module -
  if ($LASTEXITCODE -ne 0) { throw 'Stop: Atlas read-only preflight failed' }
} finally {
  [Environment]::SetEnvironmentVariable('MONGODB_URI', $atlasPreviousUri, 'Process')
  if ($atlasSecureUri) { $atlasSecureUri.Dispose() }
}
```

## 7. Network access

Add only the administrator workstation's actual current public IP as a temporary
`/32`, using the shortest offered expiry sufficient for setup, and remove it
afterwards. Atlas supports IP/CIDR rules and temporary entries lasting at most
seven days. These are database network rules, separate from the Atlas UI login.
[IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/).

The authoritative Render CIDRs must be copied from the **created service**:
service page > Connect > Outbound. Add every displayed CIDR to Atlas. They are
shared regional ranges, not exclusive addresses; database authentication remains
mandatory. Do not substitute old blog IPs, example addresses or one IP selected
from a CIDR. Do not buy dedicated IPs. Exact service CIDRs cannot be verified
before that service exists.
[Outbound addresses](https://render.com/docs/outbound-ip-addresses).

There is a bootstrap dependency: the first Render start may fail until its
outbound CIDRs are allowed. After approved creation, obtain the ranges, update
Atlas, and retry manually. Accept a temporary failed start instead of opening
`0.0.0.0/0`. Do not retry continuously while the access list is incomplete.

## 8. Initial administrator and synthetic demo import from the local project

This procedure is for **future execution only**, after explicit approval for
production database writes. Render Free shell/one-off jobs are unavailable;
do not add startup hooks as a workaround. Run from this backend repository with
the approved Node runtime and installed dependencies.

This procedure imports only the public synthetic dataset into the approved demo
database named `e_pharmacy`. Do not replace `seed:demo` with private `seed`, upload
original files or set a private data directory on Render. Original-data transfer
needs separate confirmed permission and is outside this procedure.

The following PowerShell session uses hidden prompts and restores the prior
process environment. It does not write an environment file. The temporary CLI
JWT value satisfies shared configuration only: init/seed issue no access tokens.
It is separate from the stable, Render-generated application signing secret.

```powershell
$deploymentNames = @(
  'NODE_ENV', 'MONGODB_URI', 'JWT_SECRET', 'CORS_ORIGINS',
  'INITIAL_USER_NAME', 'INITIAL_USER_EMAIL', 'INITIAL_USER_PASSWORD'
)
$deploymentPrevious = @{}
foreach ($deploymentName in $deploymentNames) {
  $deploymentPrevious[$deploymentName] = [Environment]::GetEnvironmentVariable($deploymentName, 'Process')
}
try {
  $env:NODE_ENV = 'production'
  $env:CORS_ORIGINS = ''
  $deploymentUri = Read-Host 'Atlas URI for e_pharmacy (hidden)' -AsSecureString
  $env:MONGODB_URI = [System.Net.NetworkCredential]::new('', $deploymentUri).Password
  $env:JWT_SECRET = & node --input-type=module -e "import { randomBytes } from 'node:crypto'; process.stdout.write(randomBytes(32).toString('base64url'))"
  if ($LASTEXITCODE -ne 0) { throw 'Local configuration failed' }

  # READ ONLY: no application models, collection creation or index creation.
  $deploymentPing = @'
import mongoose from 'mongoose';
try {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000, autoCreate: false, autoIndex: false
  });
  if (mongoose.connection.name !== 'e_pharmacy') throw new Error('Unexpected database');
  await mongoose.connection.db.command({ ping: 1 });
  console.info('Connected to the expected e_pharmacy database.');
} catch {
  console.error('Connectivity or database identity check failed.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
'@
  $deploymentPing | node --input-type=module -
  if ($LASTEXITCODE -ne 0) { throw 'Stop: database preflight failed' }

  $env:INITIAL_USER_NAME = Read-Host 'Initial application administrator name'
  $env:INITIAL_USER_EMAIL = Read-Host 'Initial application administrator email'
  $deploymentPassword = Read-Host 'Application administrator password (hidden)' -AsSecureString
  $env:INITIAL_USER_PASSWORD = [System.Net.NetworkCredential]::new('', $deploymentPassword).Password

  # WRITE: creates the account; refuses to overwrite an existing account.
  npm run user:init
  if ($LASTEXITCODE -ne 0) { throw 'Stop: inspect initialization without resetting accounts' }
  [Environment]::SetEnvironmentVariable('INITIAL_USER_PASSWORD', $null, 'Process')

  # WRITE: inserts the separate synthetic demo-v1 dataset, with hashes and provenance.
  npm run seed:demo
  if ($LASTEXITCODE -ne 0) { throw 'Stop: investigate import without dropping data' }

  # WRITE-CAPABLE verification: same source; must insert zero additional rows.
  npm run seed:demo
  if ($LASTEXITCODE -ne 0) { throw 'Repeated import verification failed' }

  # READ ONLY: verify source and total domain counts before mutation smoke tests.
  $deploymentCounts = @'
import mongoose from 'mongoose';
try {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000, autoCreate: false, autoIndex: false
  });
  if (mongoose.connection.name !== 'e_pharmacy') throw new Error('Unexpected database');
  const expected = { products: 60, suppliers: 5, customers: 88, orders: 25, financialtransactions: 12 };
  for (const [name, count] of Object.entries(expected)) {
    const collection = mongoose.connection.db.collection(name);
    const total = await collection.countDocuments({});
    const source = await collection.countDocuments({ 'provenance.key': { $exists: true } });
    if (total !== count || source !== count) throw new Error('Unexpected count');
    console.info(JSON.stringify({ collection: name, source, total }));
  }
} catch {
  console.error('Count or database identity verification failed; do not reset data.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
'@
  $deploymentCounts | node --input-type=module -
  if ($LASTEXITCODE -ne 0) { throw 'Source count verification failed' }
} finally {
  foreach ($deploymentName in $deploymentNames) {
    [Environment]::SetEnvironmentVariable($deploymentName, $deploymentPrevious[$deploymentName], 'Process')
  }
  if ($deploymentUri) { $deploymentUri.Dispose() }
  if ($deploymentPassword) { $deploymentPassword.Dispose() }
}
```

Before running, verify this is the intended fresh database; stop on unexpected
existing content. Inspect `demo-v1` provenance and all five synthetic import
results: 60/5/88/25/12, total **190**,
then `inserted: 0` on repeat. The administrator and session documents are separate
from that domain total. Source hashes, duplicate preservation, stable IDs and
unknown historical fields remain governed by the public synthetic import tests.
The separate local private-source suite is not run against Atlas.
Remove temporary network access and close the administrative terminal afterwards.
Never point the ordinary test suite at Atlas or run a database reset there.

## 9. Deployment sequence and approval boundaries

| Phase | Steps and completion evidence | Approval before execution |
| --- | --- | --- |
| A: local preflight | Install, typecheck, lint, tests, OpenAPI, production build, compiled startup; record actual outcomes | Already allowed for local isolated checks |
| B: Git | Review exact files; make the approved first commit; publish that hash to the existing GitHub remote | Separate commit and push approvals; commit permission does not authorize push |
| C: Atlas Free | Account/project, zero-cost gate, Free AWS Frankfurt, scoped user, temporary workstation IP, read-only ping | Cloud creation/configuration approval |
| D: database setup | Local user:init, seed:demo, repeated seed:demo, counts, synthetic source version and hashes | Explicit production-write approval; original data transfer is not authorized |
| E: Render Free | Connect approved repository/branch, inspect Free/Frankfurt summary, set environment, keep auto-deploys off; create one service | Render creation AND initial-deployment approval, because creation can deploy immediately |
| F: network | Obtain actual Connect > Outbound CIDRs, add Atlas rules, retry failed initial start manually | Approval for Atlas access-list changes and manual deployment/restart |
| G: public API | HTTPS, authentication, all 15 operations, persistence/restart, errors; isolate mutation tests as below | Explicit acceptance-test writes, environment switching and restart approval |
| H: acceptance | Record URL, deployed commit, active database name, tests, quota settings and zero paid resources | Owner accepts the evidence; only then may frontend development begin |

For a Dashboard-based service creation, enter the YAML-equivalent settings
manually; a repository containing render.yaml does not automatically apply it.
`generateValue` is a Blueprint instruction, not an application environment
variable: for manual creation, privately generate and store a cryptographically
random signing secret of at least 32 characters and enter that stable value in
Render's secret field. Do not print it or use the disposable administrative CLI key.
For Blueprint creation, review the generated resource summary and secret prompts.
In either path, check the final settings again after provisioning. Do not enable
automatic previews, add payment information or change repository visibility.

## 10. Public HTTPS smoke plan

Record only the real assigned HTTPS URL and deployed commit after deployment.
Do not guess either. Use a native client without an Origin header while CORS is
empty. Keep credentials and tokens in memory, not shell literals or reports.

Begin with read-only baselines: 60 active products, 5 suppliers, 88 customers,
25 orders and the documented partial historical results. Login/logout create
or revoke session documents and must be included in the test-write approval.

### Isolate mutation tests

Products use logical deletion; suppliers have no delete API; clients have no
create/delete API. Use only the approved synthetic demonstration records for
cloud tests, retaining an isolated acceptance database for mutation checks.

With explicit approval, prepare **e_pharmacy_acceptance**, a temporary database
in the same Free cluster, using a separately scoped temporary database user.
Use `seed:demo` for the same synthetic source and create a test administrator there. Repeat
the identity check above with that explicitly approved database name. Temporarily
point the same Render service to that database and run the mutation matrix.
This uses no second cluster or web service, but consumes the shared Free storage
and manual-deployment quotas. Keep the signing secret stable.

Then restore the URI for **e_pharmacy**, redeploy/restart as approved, and repeat
HTTPS, login/profile, all read operations, expected demo counts and logout against
the final production configuration. Tokens belong to their database's sessions;
do not expect a test-database token to authorize against production.

Record test IDs privately. Leave the isolated test data until targeted cleanup
is authorized. Never delete production collections, reset production data or
automatically purge imported records. If isolation is declined, obtain explicit
approval for each affected source record and cleanup operation before mutating it.

| Operation | Checks |
| --- | --- |
| POST /api/user/login | Valid credentials => 200, one-hour expiry; wrong credentials => 401 with Bearer challenge; no secrets in response/logs |
| GET /api/user/user-info | Actual account; missing/invalid token or wrong scheme => 401; Bearer/bearer/BEARER work with the unchanged valid token |
| GET /api/user/logout | 204 without body; old token then 401; independent second session still works |
| GET /api/dashboard | Baseline totals 60/5/88 from database; last30Days separate; exact current UTC date plus previous 29 dates; five recent registrations; Today/completeness rules |
| GET /api/orders | 25 source orders, literal `name` filtering, documented `sortBy`/`sortOrder`; original productUnits, unknown items and metadata preserved |
| GET /api/products | 60 active source rows, nine creation categories, literal name filter, allowed sort fields and default order; no implicit pagination |
| POST /api/products | Isolated named test product with approved category and exact decimal EUR string => 201; Heart/Leg/invalid category rejected; Dashboard count increases |
| PUT /api/products/:productId | Full editable fields; timestamps/provenance preserved; retain current legacy category or move to approved category; reject legacy switching/return; invalid IDs/body rejected |
| DELETE /api/products/:productId | Delete only the authorized test product => 204; active list and counter decrease; stored record remains logically deleted |
| GET /api/suppliers | Five synthetic suppliers, literal name search, correct statuses, unknown EUR and preserved fictional BDT examples with partial metadata |
| POST /api/suppliers | Isolated test supplier => 201; non-negative decimal EUR; invalid date/status or null amount rejected; remember there is no delete API |
| PUT /api/suppliers/:supplierId | In isolated legacy copy change status/address/company while retaining amount:null and BDT; explicit EUR accepted; known-to-null rejected; all fields required; conflict response documented as 409 |
| GET /api/customers | 88 separate customers, name search, default page 1/limit 20, maximum 100, final/empty pages and pagination metadata |
| GET /api/customers/:customerId | Profile and combined-history representation; missing verified links => history:null/partial, never invented relationships or verified empty history |
| PATCH /api/customers/:customerId | In isolated customer copy modify permitted profile fields; Dashboard reflects changes; spent/technical fields rejected and unsupplied fields preserved |

Also check malformed JSON => 400, oversized JSON => 413, unsupported charset or
encoding => 415, unknown fields => 400, disallowed Origin => 403, absent resource
=> 404; validate responses against OpenAPI. Do not manufacture production faults
to force 500: sanitization/logging are covered by isolated regression tests.

For expiry, save an issued token privately and manually check it after its real
expiresAt; do not alter production time, sign artificial tokens or schedule pings.
For restart, issue a token, perform one approved restart before its expiry, and
confirm the same token and stored records still work. Logout then remains revoked.
Respect cold starts and inspect Content-Type before treating a provider loading
page as an API response. No recurring warming requests are permitted.

Unknown historical dates/links/positions stay unknown in public acceptance.
Positive historical calculations with verified synthetic fixtures belong to
isolated local tests, not fabricated production corrections.

## 11. Operations and troubleshooting

Render Free sleeps after approximately 15 idle minutes; waking may take about a
minute. Filesystem changes disappear across restarts. Keep all durable domain
data and sessions in Atlas. The stable JWT secret and database session checks
preserve normal expiration/revocation across app restarts; a cold start does not
extend a token. Render may restart or suspend Free services. Shell access, disks
and one-off jobs are unavailable. There is no always-on availability promise.
The shared allowance is 750 running instance-hours/month; unusually high
service-initiated traffic can also cause suspension. [Free limits](https://render.com/docs/free).

Current Hobby allowances are 500 build minutes/month and 5 GB outbound/month;
check the actual workspace because other services share these allowances.
Monitor built-in usage pages, not paid add-ons.
[Build pipeline](https://render.com/docs/build-pipeline),
[Outbound bandwidth](https://render.com/docs/outbound-bandwidth).

Free web compute has 512 MB RAM and 0.1 CPU. Password checks use substantial
memory; successful single-user smoke tests do not establish capacity for many
concurrent logins. Do not lower password-hashing security or add new traffic
policies without approval. [Compute limits](https://render.com/docs/compute-plans).

Atlas Free currently uses MongoDB 8.0, 0.5 GB including indexes, up to 500
connections and 100 operations/second, 32 MB sort memory, and 10 GB ingress plus
10 GB egress per rolling seven days. Excess traffic/operations are throttled;
storage does not automatically expand. After 30 days without connections it
can pause. It has no peering/private endpoints. Monitor size/connections/ops and
resume a paused cluster manually. [Atlas limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

No managed backups are enabled by this design. The source can reproduce imported
rows, not later user edits. An optional encrypted local export needs its own
authorization and secure local storage; do not purchase backup storage/services.

The startup log appears only after MongoDB connects and the listener starts.
Expected startup failures emit a generic message and exit nonzero. Request 500s
emit safe structured diagnostics. The shutdown handler closes the HTTP server
and MongoDB and has a ten-second forced-exit deadline; it has no dedicated
shutdown log line. Render sends SIGTERM and normally allows thirty seconds.
Check lifecycle state/exit status rather than assuming a missing log means a
clean shutdown. [Termination](https://render.com/docs/deploys#graceful-shutdown).

If deploy fails: inspect Node/build version, lockfile install, assigned port,
environment variable names, scoped database permissions, paused-cluster status,
SRV/DNS/TLS and the actual outbound allowlist. Do not print a URI to diagnose it.
Fix configuration, then manually retry within the free quotas. Stop on payment
prompts or unavailable Free capacity. Do not enable paid options or keep-alive
services as a workaround.

## 12. Acceptance record

After the separately authorized deployment, record the real URL, deployed commit,
Node version, region/plan, database name (without URI), zero-cost checks, all
smoke outcomes, restart/expiry outcomes, the synthetic demo-v1 source version
and remaining provider limitations. Do not describe the cloud dataset as original records.
Do not mark deployment complete or begin frontend development before that record
is accepted. Local preparation does not substitute for public HTTPS verification.
