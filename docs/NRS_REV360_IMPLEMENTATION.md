# NRS Rev360 Preparation Layer — Implementation Notes

**Status:** Release 1 (Phases 1–4) built · **Storage:** Firestore · **Classification:** rules only (no AI)
**Original spec:** [gemini-code-1794356331574.md](./gemini-code-1794356331574.md)

---

## 1. Decisions (Phase 0)

| Topic | Decision | Notes |
|---|---|---|
| Database | **Firestore** (Postgres deferred) | One document per tax month: `users/{email}/tax_ledger/{YYYY-MM}`. A full year = ~12 reads. |
| AI classification | **Not used** | Narrations never leave the device; rules + the user's own corrections. |
| Statutory thresholds | **Configurable per tax year, pending adviser sign-off** | `src/nrs/taxYearConfig.ts` — entries carry `verified: false` until confirmed. UI shows a warning banner meanwhile. |
| NRS upload templates | **Not yet obtained** — draft layouts in use | `src/nrs/exportLayouts.ts`. See section 4. |
| Scope | **Release 1 = Phases 1–4.** Phases 5–6 kept in backlog (section 5). | |

---

## 2. What was built

| Phase | Files | What it does |
|---|---|---|
| 1 — Data model | `src/nrs/types.ts`, `money.ts`, `tin.ts`, `taxYearConfig.ts` | Ledger transaction contract (integer kobo, VAT in basis points, direction, VAT treatment, CIT category, WHT fields, proof, classification audit). Per-period docs with status lifecycle and audit trail. TIN format checks. Per-year statutory config. |
| 2 — Classification | `src/nrs/classifier.ts`, `ledger.ts`, `importers.ts` | ~25 narration rules for Nigerian bank statements; counterparty memory learns from user corrections; low-confidence results go to "Needs review". Importers: bank CSV (auto-detects columns, day-first dates, preamble rows), Smart Vault, Mono statement items. Idempotent re-imports. |
| 3 — Compliance checks | `src/nrs/compliance.ts` | Unclassified/needs review, invalid TIN, input VAT without supplier TIN, missing receipts, WHT without payee TIN / credit note, sales without invoice ref, possible duplicates, VAT-registration threshold, small-company status, unverified thresholds. Health score. |
| 4 — Schedules & export | `src/nrs/schedules.ts`, `exportLayouts.ts`, `pdf.ts` | VAT return (Schedule A output VAT, Schedule C input VAT, net position, due date), WHT deduction schedule, annual CIT summary (feeds existing `citEngine`). CSV export (Excel-safe, formula-injection guarded), PDF review pack. OPEN → REVIEWED → FILED (locked) → AMENDING lifecycle. |
| Persistence | `src/nrs/ledgerStore.ts`, `firestore.rules` | `useTaxLedger()` hook: local cache + Firestore sync; demo account stays local. Rules lock FILED periods server-side. |
| UI | `src/components/dashboard/NRSReturnsTab.tsx` | New **NRS Returns** dashboard tab: Ledger · Compliance health · Returns & export. |
| Tests | `src/nrs/nrs.test.ts` | 33 unit tests covering all of the above. |

### Calculation conventions
- Bank amounts are treated as **VAT-inclusive**: VAT = gross × 750 / 10,750.
- VAT applies only to `STANDARD` supplies. Input VAT is **claimable only when the supplier TIN is valid**.
- WHT applies only to **outflows** (payments the taxpayer makes), on the **VAT-exclusive** amount, using the existing `WHT_RATE_SCHEDULE`.
- CIT figures are VAT-exclusive. Capital allowances on CAPEX are not yet computed (estimate is an upper bound).

### Deploying
- `firestore.rules` changed (new `tax_ledger` rule). Deploy with `npm run deploy` or `firebase deploy --only firestore:rules`.
- No new npm dependencies.

---

## 3. Items needing adviser confirmation

Edit `src/nrs/taxYearConfig.ts` and set `verified: true` once confirmed:

1. 2026 small-company limits (assumed ≤ ₦100m turnover, ≤ ₦250m fixed assets — NTA 2025).
2. 2026 VAT-registration threshold (assumed ₦100m).
3. VAT return and WHT remittance due day (assumed 21st of the following month).
4. Current WHT rates in `src/utils/whtEngine.ts` (WHT Regulations were revised in 2024).
5. VAT treatment of fuel, rent, and air travel in `src/nrs/classifier.ts`.
6. Accepted TIN formats in `src/nrs/tin.ts`.
7. Note: `src/utils/citEngine.ts` still uses the ₦25m tier for the stand-alone CIT calculator.

---

## 4. Recommendation: obtaining the official templates

Neither the VAT 002 nor WHT schedule upload templates were available when this was built. Recommended route, in order:

1. **Taxpayer portal download (fastest).** Log in to the NRS e-filing portal (Rev360 / formerly TaxPro Max) with the business TIN and open the VAT and WHT return screens — the bulk-upload screens typically offer a "Download template" (Excel). Save copies in `docs/templates/`.
2. **Ask the tax adviser** — practising accountants file these monthly and will have the current templates and TIN format.
3. **NRS tax office / help desk** — request the schedule templates and the published TIN format for third-party software.

When received: add one layout per template in `exportLayouts.ts` (exact headers + order), set `matchesOfficialTemplate: true`, and point `DEFAULT_LAYOUTS` at them. If the portal requires `.xlsx`, add an xlsx writer (e.g. SheetJS) at that point.

---

## 5. Backlog — revisit for future upgrades

Kept from the original spec and plan; not in Release 1.

### Phase 5 — Receipt OCR
- Upload/photo → Cloud Storage → OCR extracts vendor, TIN, date, amount, VAT.
- Auto-match receipt to ledger transaction (amount, ±3 days, vendor) → clears "missing proof".
- Store file SHA-256 in `documentProof.sha256` (field already in the data model).
- Decide OCR provider in line with the "no AI on user data" decision (on-device OCR, or explicit user consent).

### Phase 6 — E-invoicing & direct Rev360 submission
- Connect `InvoiceManager` to NRS e-invoicing (MBS) once API access for software providers is available.
- Submit returns via Rev360 API instead of file upload. Depends on NRS accreditation/credentials.

### Other upgrades identified
- **Live TIN verification** via an NRS/JTB lookup service (currently format-only).
- **Mono server sync** → feed `importMonoItem()` from the existing webhook (`app/api/webhooks/mono/route.ts`) via a Cloud Function.
- **WHT suffered** on sales (credit notes received from customers) as CIT credits.
- **Capital allowances** from CAPEX using `src/utils/capitalAllowances.ts`.
- **Encrypt BVN/NIN** at rest (NDPA 2023).
- **Large ledgers**: shard a period document beyond ~1,200 transactions (Firestore 1 MiB limit) and move the local cache from localStorage to IndexedDB.
- **Postgres migration** when ≥ 15–20k active users or stricter ledger requirements arise (see cost analysis); prefer Supabase/Neon. `prisma/schema.prisma` is kept as the future target.
- **Remove staff write access** to other users' subcollections in `firestore.rules` (pre-existing rule; `tax_ledger` already restricted).

