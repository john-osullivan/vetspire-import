# Vetspire Import Toolkit (Clients, Patients, Immunizations)

This repository contains a small set of TypeScript CLIs to migrate a veterinary clinic’s legacy data into the Vetspire platform via GraphQL. It focuses on two PDF export formats supported by the previous Advantage system: a client/patient roster PDF and a vaccine history report PDF.

The toolchain parses those PDFs, prepares clean intermediate files, and performs idempotent imports into Vetspire with dry‑run support, throttling, and timestamped audit outputs.

## Why this exists

- Many clinics export data in formats that aren’t directly importable (e.g., labeled PDFs rather than CSV/JSON).
- Vetspire exposes a comprehensive GraphQL API, but translating messy legacy output into safe, structured create/update operations is non‑trivial.
- This project bridges that gap: parse → transform → import while avoiding duplicates and giving operators clear visibility into what happened.

## What’s implemented

- PDF → CSV converter for client/patient rosters
  - Parses a labeled roster PDF (example: `advantage_labeled_export.pdf`) into a normalized CSV suitable for import.
- Idempotent client/patient importer
  - Transforms each CSV row to Vetspire `ClientInput` + `PatientInput` (sex/neuter decoding, deceased detection, addresses/phones, active flags, historical IDs).
  - Checks existing records (by historical ID, email, or name) and creates, updates, or skips accordingly.
  - Dry‑run by default; opt‑in to real API calls with `--full-send`.
  - Timestamped JSON result files with successes, failures, updates, and skips.
- Immunization proposal builder (from vaccine PDF)
  - Parses a vaccine report PDF (example: `vaccine_export.pdf`) by lot sections and table rows using `pdf2json` positional data.
  - Optionally fetches current Vetspire patients to match rows to patient IDs via a deterministic key: `patientName_(Family, Given)`.
  - Produces a `proposals` JSON along with an `unmatched` list for review.
- Immunization importer
  - Reads proposals and creates immunizations idempotently.
  - Skips when a matching immunization already exists (field-by-field comparison including location/provider).
  - Always writes results and failures JSON to `./outputs`.
- Utilities
  - `update-import`: scans imported records and updates placeholder location IDs to your real location (useful after test imports).
  - Simple request rate limiter (≈5 req/s) to be polite to the API.

## Prerequisites

- Node.js 18+ (uses built‑in `fetch` and ESM)
- npm
- Vetspire API credentials and IDs (see “Environment”)
- The source PDFs you plan to import

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment

Copy `.env.example` to `.env` and fill in values provided by your Vetspire account:

```bash
VETSPIRE_API_KEY="<api_key>"
VETSPIRE_API_URL="https://api2.vetspire.com/graphql"
TEST_LOCATION_ID=<optional_test_location>
REAL_LOCATION_ID=<your_real_location_id>
PROVIDER_ID=<provider_id_for_immunizations>
```

Notes:

- Keep your real secrets out of source control; use `.env`, shells, or your preferred secrets manager.
- Many commands require `REAL_LOCATION_ID`; immunization import also requires `PROVIDER_ID`.

## Commands (CLIs)

Commands are auto‑synced from `src/commands` into `package.json` scripts. Run them via npm.

### Convert client/patient roster PDF → CSV

```bash
npm run convert-pdf -- ./advantage_labeled_export.pdf --output ./outputs
```

Produces a timestamped CSV in `./outputs` with columns defined by `src/types/clientTypes.ts` (e.g., `patientId, patientName, patientSpecies, ...`).

### Import clients and patients from CSV

Dry‑run (default):

```bash
npm run import-csv -- ./outputs/client-patient-records_....csv
```

Actually send to Vetspire:

```bash
npm run import-csv -- ./outputs/client-patient-records_....csv --full-send
```

Options:

- `--limit <n>`: process only the first N rows
- `--verbose`: print GraphQL variables and responses
- `--track-results`: write detailed JSON results and failures to `./outputs`

### Propose immunizations from vaccine PDF

```bash
npm run propose-immunizations -- ./vaccine_export.pdf --output ./outputs --fetch --dump-rows
```

What it does:

- Parses vaccine deliveries grouped by lot/manufacturer/expiry.
- Optionally fetches all current patients (with client names) to map each row to a `patientId`.
- Writes a proposals JSON with `proposals` (ready to import) and `unmatched` (rows lacking a matching patient).

Options:

- `--fetch`/`--no-fetch`: toggle fetching patients for matching (default: fetch)
- `--structured`: prefer `pdf2json` structured parsing (default: true)
- `--dump-rows`: emit a raw parsed rows JSON alongside proposals

### Import immunizations from proposals JSON

Dry‑run (default):

```bash
npm run import-immunizations -- ./outputs/immunization-proposals_....json
```

Full send:

```bash
npm run import-immunizations -- ./outputs/immunization-proposals_....json --full-send
```

Requirements: `REAL_LOCATION_ID` and `PROVIDER_ID` must be set.

### Update imported primary locations

```bash
npm run update-import -- --full-send
```

Finds records previously imported with placeholder/test location IDs and updates them to your `REAL_LOCATION_ID`. Useful if you did a test import before switching to the real location.

### Rollback (placeholder)

`npm run rollback-import` is scaffolded but not implemented. The intended behavior is to deactivate or remove records created by a prior run; it currently does not perform changes.

## Transformation details (clients & patients)

Source columns are defined in `src/types/clientTypes.ts`. Key transformation logic lives in `src/services/transformer.ts`:

- Sex and neuter status: legacy codes `MI, MN, FI, FS` → `sex` + `neutered`.
- Deceased detection: `patientStatus` codes include `D` and `ND` (treated as deceased flags per source data notes).
- Client activity: clients are marked inactive if their only pet is deceased (via the same row’s status).
- Address and phone: assembled from present, non‑placeholder fields.
- Historical IDs: original IDs are carried into `historicalId` for matching and traceability.
- Location: `createClient` always sets `primaryLocationId` to `REAL_LOCATION_ID`.
- Flags like `isEstimatedAge`/`isEstimatedWeight` are set when exact values aren’t available.

## Idempotency rules

To avoid duplicates, imports compare incoming data against existing records fetched from Vetspire:

- Client matching order: `historicalId` → email → (`givenName` + `familyName`)
- Patient matching order: `historicalId` → (`name` + `clientId`)
- On match, a minimal deep comparison is used to decide whether to `update` or `skip`.
- Results JSONs enumerate created/updated/skipped/failed objects for audit and retry.

## Immunization proposals and import

Parsing (`src/services/pdfParser.ts`):

- Uses `pdf2json` positional data to reliably extract lot metadata and row columns (date given, date due, patient, client, description, tag).
- Extracts rabies tag numbers from either the dedicated Tag column or as a trailing token in Description.

Transformation (`src/services/transformer.ts`):

- `type`: `INITIAL` unless description suggests a booster (e.g., contains `# 2`, `2nd`, `3rd`).
- `route`: `INTRANASAL` if description contains “intranasal”; otherwise `SUBCUTANEOUS`.
- `immunizationStatus`: `ACTIVE` if due date is in the future; else `COMPLETED`.
- `administered: true`, `declined: false`, `historical: true`, `site: "Unknown (Legacy)"`.

Import (`src/services/importer.ts`):

- Builds an index of existing immunizations per patient.
- Compares each proposal to existing entries (including location/provider) and skips exact matches.
- Creates missing immunizations, writing results/failures to `./outputs`.

## Outputs

All CLIs write their artifacts to `./outputs` using ISO‑like timestamped filenames so runs sort chronologically. Examples:

- `client-patient-records_YYYY-MM-DDTHH-mm-ssZ.csv`
- `import-results_full|dry_real_YYYY-MM-DDTHH-mm-ssZ.json`
- `immunization-proposals_YYYY-MM-DDTHH-mm-ssZ.json`
- `immunization-import-results_full|dry_YYYY-MM-DDTHH-mm-ssZ.json`

## Project layout

- `src/commands/*` — CLI entrypoints (yargs)
- `src/services/*` — parsing, transformation, import logic
- `src/clients/*` — adapters for PDFs and Vetspire GraphQL
- `src/types/*` — TypeScript models for inputs and Vetspire API
- `test/*` and `src/test/*` — integration tests and helpers

## Testing

Run all tests:

```bash
npm test
```

Notes:

- Some tests hit the real Vetspire API; they automatically skip if `VETSPIRE_API_URL` and `VETSPIRE_API_KEY` aren’t set.
- PDF‑parsing integration tests expect the sample PDFs to be present at repository root (e.g., `advantage_labeled_export.pdf`, `vaccine_export.pdf`).

## Limitations and notes

- The PDF parsers are tailored to the example reports included here. Other clinics’ exports may require small adjustments to the parsing heuristics.
- `rollback-import` is not implemented; prefer dry‑runs and small `--limit` slices before enabling `--full-send`.
- The importer throttles requests but you should still respect Vetspire rate limits and operational windows.
- Always review generated outputs in `./outputs` before moving on to the next step.

## License

See `LICENSE`.
