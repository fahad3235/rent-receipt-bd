# Rent Receipt BD

Offline, bilingual (EN / বাংলা) monthly rent receipt book for landlords and tenants in Bangladesh. No server, no account, no network calls — all data stays in the browser's localStorage.

## Features

1. **Tenants** — add tenants with flat/property, monthly rent, advance deposit, optional phone, and tenancy start month. Inline validation on every field.
2. **Payments & receipts** — record full or partial payments per rent month (Cash, bKash, Nagad, Bank, Other). Each payment gets an auto receipt number (`RR-YYYY-####`, sequential per year) and a printable receipt with the amount in words.
3. **Dashboard** — per-month view: active tenants, collected, outstanding, and advance held, plus a per-tenant Paid / Partial / Unpaid table for the selected month.
4. **Vacate & refunds** — mark a tenant vacated with an advance refund (capped at the deposit held); vacated tenants stop counting toward future rent.
5. **Data portability** — JSON export, strict import validation (malformed files are rejected with data intact), and typed-`DELETE` erase-all.
6. **Bilingual + mobile** — EN/বাংলা toggle persisted across reloads, Bengali digits in Bangla mode, responsive down to 390 px.

## Money model

All money is stored as **integer paisa** to avoid float rounding errors. Amounts in words use the Bangladeshi scale (lakh / crore) in English.

## Stack

Vanilla HTML + CSS + JavaScript. No build step, no dependencies, no CDN.

## Run locally

Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Tests

```sh
node tests/logic.test.js
```

Headless-Chrome smoke checks (desktop + 390 px mobile, 0 console/page errors) are recorded in `TEST_RESULTS.md`.

## Limitations

- This is a **personal record tool, not a legal document** and not affiliated with any government body. Receipt wording is a convenience record; verify amounts before relying on them.
- No rent rates are assumed anywhere — every rent, advance, and payment amount is entered by the user.
- No reminders/notifications, no multi-user sync, no PDF export (receipts print via the browser's print dialog).
- Amount-in-words is English only (Bangla mode still renders digits in Bengali script).

## Status

MVP complete. See `TEST_RESULTS.md` for verified results.
