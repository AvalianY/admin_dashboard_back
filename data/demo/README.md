# Synthetic demonstration data

All records in this directory are fictional. They are generated deterministically
by `scripts/generate-demo.mjs`, which never reads the private source directory.
Names are numbered demo labels, phone values are non-routable test tokens, and
email/image hosts use the reserved `example.test` domain. Image URLs are placeholders.

The five source-shaped files contain 60 products, 5 suppliers, 88 customers,
25 orders and 12 transactions. They deliberately exercise duplicates, Heart/Leg,
BDT, signed amounts, alternate image fields and unavailable historical details.
These examples are not assertions about the original records.

`source-manifest.json` records their hashes under the distinct `demo-v1` prefix.
Run `npm run seed:demo` only against an explicitly authorized empty demo database.
The importer refuses to mix this dataset with an existing original-source version.
Generation is optional (`npm run demo:generate`); tests consume the committed files
and verify their hashes and deterministic regeneration.
