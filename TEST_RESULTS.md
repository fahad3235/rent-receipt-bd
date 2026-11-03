# TEST RESULTS — rent-receipt-bd (run #228, 2026-11-03 17:00 slot)

## Node unit tests — 15/15 passed

`node tests/logic.test.js` (run 2026-11-03 ~17:10 +06):

- Integer-paisa rounding (12500.555 → 1250056)
- Amount in words: ৳12,500.50 → "Twelve thousand five hundred taka and fifty paisa only"; zero → "Zero taka only"; ৳150,000 → "One lakh fifty thousand taka only"; singular "One taka only"; negative rejected
- Bengali digits: 2026-11 → ২০২৬-১১
- Month validation (2026-13 rejected, 2026-1 rejected) and label "Nov 2026"
- Tenant validation catches empty name / zero rent / negative advance / bad phone / bad month; valid tenant passes
- Payment validation: month before tenancy start rejected; valid payment passes
- Month status: Unpaid / Partial / Paid boundaries
- paidForMonth sums only the matching tenant + month
- Receipt numbers: RR-2026-0001/0002 → next RR-2026-0003; empty → RR-2026-0001
- Dashboard stats hand-verified: 2 active tenants, collected ৳15,000.00, outstanding ৳5,000.00, advance held ৳40,000.00; vacated tenant excluded; tenant starting after the view month owes nothing
- Import validation: valid export passes; unknown tenant id, missing receiptNo, duplicate tenant id, and non-object inputs all rejected

## Headless-Chrome smoke — 14/14 passed

Harness: `tests/smoke.py` (raw CDP against Playwright headless_shell-1187, file:// page), run 2026-11-03 ~17:20 +06:

- Page title, 4 tabs, dashboard visible by default
- Add tenant "Rahim Uddin / Flat 3B, Mirpur" → listed
- Dashboard collected ৳0.00 before any payment
- Record bKash payment ৳12,000 for 2026-11 → receipt RR-2026-0001 generated
- Dashboard collected ৳12,000.00, outstanding ৳0.00, advance held ৳24,000.00
- Second tenant (৳8,000, unpaid) → outstanding ৳8,000.00
- Empty tenant name → inline error shown, no tenant added
- Bangla toggle → collected renders as ৳১২,০০০.০০
- Reload persistence: tenant still listed
- 0 console errors / page exceptions during the whole run

## Mobile — 390 px, no horizontal overflow

`tests` mobile run (window 390×844): dashboard 375, tenants 375, receipts 390, data 390 scrollWidth — all tabs within the viewport.

## Repairs

0 app bugs. 0 test-side fixes after the first green run (console-error capture was added to the harness and the suite re-ran green).
