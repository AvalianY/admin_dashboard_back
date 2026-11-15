# Production activation — 15 November 2026

**Verdict: PRODUCTION PASS** for public read-only demonstration.

- [Frontend / Live Application](https://admin-dashboard-front-blush.vercel.app/)
- [Production API](https://e-pharmacy-api-kz62.onrender.com)
- [Swagger UI](https://e-pharmacy-api-kz62.onrender.com/api-docs/)
- [Frontend repository](https://github.com/AvalianY/admin_dashboard_front)
- [Backend repository](https://github.com/AvalianY/admin_dashboard_back)

## Deployed revisions and evidence

The backend target is `5ad05f67cde62d8ef102a3e3bc4ec3542a92b2f7`. The owner affirmed this target in response to the Render deployment question. The public OpenAPI JSON exactly matches that revision's local reviewed contract, contains 16 operations and requires the server-owned role in User DTOs. Live admin/demo authentication and enforcement match that code. The public API does not expose a commit identifier: the exact deployment SHA is owner-confirmed, not independently attested by an API version endpoint.

The frontend deployment is associated with `604163eb2bdd141df801467ec724f8bf19e11a44` by its successful GitHub Vercel status. Its live JS and CSS bytes match the reviewed local production build. Subsequent documentation-only commits do not change these deployed application artifacts. The owner performs all deployments; no platform-management automation or deployment was performed during this activation.

## Authentication and API

Existing administrator credentials were read through the existing Windows Credential Manager helper and passed only in memory. Login returns `role: admin`; user-info verifies the exact existing account. Dashboard, products, suppliers, customers, customer details/history and orders return HTTP 200. Counts match Atlas IDs and the original dataset. Logout returns 204; the revoked token then receives 401 with the Bearer challenge. The administrative document and password were not changed; the role migration was not repeated.

The existing `user:init-demo` command created one **Demo User**, `demo@e-pharmacy.example`, with `role: demo`. Its existing generator and scrypt implementation were unchanged. The password was stored in Windows Credential Manager at `E-Pharmacy/e_pharmacy/demo`. No seed, second database, password reset or replacement authentication mechanism was introduced. The initializer created no session; verification created and revoked only test sessions.

The successful admin and demo API suites contain 12 and 50 HTTPS requests respectively, in addition to public routing checks and browser traffic. The demo suite passed 123 checks, including OpenAPI response schemas, all allowed GETs, all 88 customers over 18 pages, name filters on four lists, product/order sorting, customer details/history, safe 400/404 responses, logout and session revocation. Financial values are checked through Dashboard and the preserved Atlas records; no separate financial endpoint exists. Unknown historical dates, money or relationships were not replaced.

## Server write restrictions

Each probe used an empty/invalid body and invalid resource ID, so a missing authorization guard could not turn it into a valid production mutation.

| Operation | Result |
| --- | --- |
| POST `/api/products` | 403 `DEMO_READ_ONLY` |
| PUT `/api/products/:invalidId` | 403 `DEMO_READ_ONLY` |
| DELETE `/api/products/:invalidId` | 403 `DEMO_READ_ONLY` |
| POST `/api/suppliers` | 403 `DEMO_READ_ONLY` |
| PUT `/api/suppliers/:invalidId` | 403 `DEMO_READ_ONLY` |
| POST `/api/customers` | 403 `DEMO_READ_ONLY` |
| PATCH `/api/customers/:invalidId` | 403 `DEMO_READ_ONLY` |

Login rejects a supplied role with 400. Spoofed role/user headers, query parameters and body fields cannot elevate demo access. Modified and unsigned JWTs return 401. The real token carries no role claim; the database profile remains authoritative. Changing the cached frontend role to admin and reloading restores `demo` from user-info, with mutation controls disabled. The isolated role/security suite also passed 20/20 tests. These probes supplement the earlier complete isolated admin CRUD suite; no valid production administrative mutation was performed during activation.

## Vercel, CORS and browsers

Initially the frontend origin was rejected with `403 ORIGIN_NOT_ALLOWED`. The owner manually added the exact origin `https://admin-dashboard-front-blush.vercel.app` to Render CORS, preserving the API origin. Afterward direct and proxied requests pass the origin check, OPTIONS returns 204 and unknown origins remain rejected. CORS was not disabled.

The unauthenticated Vercel `/api/user/user-info` returns JSON 401 with a Bearer challenge, not SPA HTML. A real authenticated Bearer token reaches the Render account correctly. Authenticated proxy replies use `private, no-store` and were not CDN HIT/STALE responses. SPA deep links return the built application; actual Chrome checks verify route restoration and F5.

Actual Chrome, without mock responses, passed under both administrator and demo at **375, 768 and 1440 px**. Each role covers Login plus Dashboard, Orders, Products, Suppliers and Customers at all three sizes: 18 page/viewport combinations and 18 local screenshots per role. The admin run passed 38 checks; demo passed 39. Search, filtering, sorting, client/server pagination, details/history, verified session restoration and logout work with the real API. Admin mutation controls remain enabled; demo controls remain disabled. A network safety guard allowed only actual Login and GET traffic and blocked no unexpected requests. Neither run produced application page errors, console errors or page overflow. The accepted layout was unchanged.

## Original-data integrity

| Collection | Documents |
| --- | ---: |
| Products | 60 |
| Suppliers | 5 |
| Customers | 88 |
| Orders | 25 |
| Financial transactions | 12 |
| **Total** | **190** |

Full BSON snapshots before/after provisioning and live checks match the established v1 baseline. The administrator's full BSON is unchanged. Only the authorized Users/Sessions activity occurred. Original JSON, credentials, tokens and raw production records are absent from this report and Git changes.

## Public credential publication

The owner explicitly approved public viewing of v1 and subsequent public demo-password publication after the security gates passed. The same existing Windows-vault demo password is published only in the visible top **Live Demo** blocks of all six German/Ukrainian/English README files. It is intentionally public and retained in Git history. No administrator password, JWT or MongoDB URI is published. No separate Demo Login button or authorization mechanism was added.

Documentation checks verify matching credentials, top placement before the table of contents, language switches, all local links, actual external links, and absence of administrative credentials, private original JSON and service files. The demo password is not reproduced in validation reports or tool output.
