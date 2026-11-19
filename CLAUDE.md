# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ReysPro — multi-tenant logistics management web app for Uzbek trucking companies (trips, clients, settlements, cash, fleet, drivers, TIR/Dazvol permits, reports). UI is in three languages; code comments, docs and commit messages are in Uzbek (Latin). The spec is `docs/texnik-shart.md`; dated reports live in `docs/hisobot-*.md`.

## Working rules (from `docs/texnik-shart.md` §12)

- The user is a business owner, not a programmer: reply in **Uzbek**, in plain language without jargon. Ask only when genuinely needed and never re-ask something already decided in the spec.
- The spec is the single source of truth. Do not change agreed rules. If you find an ambiguity or contradiction, add it to §11 instead of hiding it, and keep "requirement" (talab) separate from "proposal" (taklif). When the user brings new requirements or decisions, record them as a new dated subsection in §11.
- Work step by step: analyse the request, propose, and implement after the user confirms. Show a mockup for a new module or flow.
- Never call something "tested" unless it was actually run. A module is done only after these checks: functional, permission (a user from the wrong org sees nothing), calculation, concurrent users, phone and desktop layout, data integrity, archive (old documents are not lost), notifications.
- Priority order: 1) data security, 2) calculation correctness, 3) permissions, 4) no data loss, then search, report accuracy, phone/desktop usability, extensibility. Looks come after logical correctness. UI is simple and airy, not dense.

## Key requirements (summary of `docs/texnik-shart.md`)

Newer dated subsections in §11 override the older §2–§9 text. Examples: Super Admin sees no tenant data; the accountant is an org member, not global; the director manages currencies, staff and org documents.

**Tenancy and access**
- Every tenant table has `orgId`, and filtering is enforced on the server through the central filter (see Architecture).
- One login per person, never shared. Sessions on several devices are independent.
- Super Admin only creates organisations and their directors, approves applications and payments, and manages the public site. Super Admin cannot open tenant data, reset anyone's password or log in as another user.
- The director adds staff: manager, accountant, deputy (view only), specialist (VIEW/EDIT per section, numbered Mutaxassis-1, -2, …).
- Passwords: users set and reset them with a 6-digit e-mail code (valid 15 min, 5 attempts, at most one send per 60 s and 5 per hour). Temporary passwords from "Mening hisobim" have a VIEW/EDIT scope, last 1 h / 8 h / 1 day / 3 days, can be revoked, and cannot change credentials.
- Demo organisation: hidden from every real list, and demo users persist nothing.

**Data handling**
- No physical deletes of financial or operational records (payments, expenses, trips, TIR/Dazvol, ledger entries, documents). Use Active / Cancelled / Archived statuses and keep history. Physical delete is Super Admin only and rare.
- Documents are data plus an optional file, and versioned: a new version becomes ACTIVE and the old one ARCHIVE. Files: images, PDF, Office, zip/rar/7z, up to 10 MB.
- Audit who created, changed, changed status of, or uploaded files for financial, permit, payment and document records.
- Expiry alerts at 30 / 15 / 7 days and when overdue: vehicle and driver documents, lease, licence, TIR/Dazvol.

**Money rules**
- Each shipment (SMR/CMR) has its own client and price. Balance = actual prices + extra charges + demurrage (prostoy = days × daily rate) − payments.
- Demurrage needs a reason (`ShipmentCharge.fault`: CLIENT / DRIVER). Driver-fault demurrage is charged to nobody: it is shown but never enters balances, revenue or reports. Sum charges only through `BILLABLE_CHARGES` (`src/lib/charges.ts`) in queries or `billableAmounts` (settlement-core) in code. Old demurrage with no reason counts as client fault.
- The "accounting price" is a separate field that never enters balances.
- Client-billed extra charges and the organisation's own expenses never mix.
- Payment terms per shipment: *Shartnoma* (bank transfer only) or *Naqd kelishuv* (cash or card). The payment method must match the terms.
- Payments are allocated to specific trips (partial allowed) or recorded as client advance. Client balance = sum of shipment balances − unallocated advance. Incoming money auto-allocates to the oldest debt in the same currency.
- Multi-currency: each organisation has its own currency list. Every currency is kept and reported in its own column, never converted to so'm in reports. A cross-currency payment uses the Central Bank rate of the payment date, which the user can override in the same field; the rate used is stored on the payment.
- Cash module: bank / cash / card accounts with opening balances, transfers with an exchange rate, and expense categories (category › subcategory). Payments record which account received the money.
- Driver ledger (`DriverEntry`):
  - LESSOR side = owner-operators: membership, tax, TIR, Dazvol charges; their payments are cash income.
  - STAFF side = employee drivers: per-trip pay, bonuses; payouts are cash expense.
  - The two categories never mix. Entries are cancelled, never deleted.
- "Faqat ro'yxat" (list-only) trips carry no money and are excluded from debts and revenue.

**Operations**
- New trip:
  - only free vehicles are offered (no loaded active trip), and drivers busy on a loaded active trip are hidden;
  - choosing a tractor fills the default trailer and driver.
- "Qo'shimcha yuk" adds a shipment to an existing trip.
- Wherever trips are listed, show trip number, route and tractor plate.
- Trip stages are set by the driver in the Telegram bot, or by a manager on the driver's behalf; the source is stored. After unloading the vehicle is free again.
- Telegram bot (long polling, no public URL needed):
  - drivers link by sharing their own phone, which must match an active driver;
  - archived drivers get nothing;
  - drivers confirm or reject TIR/Dazvol hand-overs.
- TIR/Dazvol: intake from the upper organisation → issue to driver (tractor + driver) → return (used / unused) → hand back. Lost and void are also tracked. Expiry is mandatory, with a warning at 30 days. Dazvol is either paper or electronic.
- Subscription billing counts active tractors:
  - up to 10 → 100 000 so'm a month or 1 000 000 a year;
  - up to 20 → 200 000 / 2 000 000;
  - over 20 → 300 000 / 3 000 000;
  - yearly = 10 × monthly;
  - 25% off invoices created through 31.12.2027.
- Adding a tractor beyond the plan limit is blocked. Overdue subscriptions are never auto-blocked.
- Registration stays closed until the provider requisites are filled in Super Admin settings.

**Not built yet (in the spec):** trip-day and tariff calculation (UZ / CIS / Europe tariffs by date), official vs draft payroll, the Mintrans integration (only through an official API, never scraping). Border-crossing stages were removed on 18.11.2026 because trips can run entirely abroad. That conflicts with the spec's trip-day calculation, which relies on border dates; resolve it with the user before building trip days.

## Commands

```bash
npm run dev            # next dev
npm run lint           # tsc --noEmit (there is no ESLint)
npm test               # vitest run — needs PostgreSQL (DATABASE_URL); files run serially
npx vitest run test/trips.test.ts        # single file
npx vitest run -t "trip stages order"    # single test by name
npm run db:push        # prisma db push — no migrations folder; schema is pushed directly
npm run db:seed        # first Super Admin from SEED_ADMIN_PHONE / SEED_ADMIN_PASSWORD
npm run db:demo        # demo organisation data
npm run build          # prisma generate && next build
```

CI (`.github/workflows/ci.yml`): Postgres 16 → `prisma db push` → lint → test → build.

One-off data migrations are `scripts/migrate-YYYY-MM-DD.ts` run with `npx tsx`.

## Architecture

**Stack:** Next.js 16 App Router with server actions (no API layer except a few route handlers such as `files/`, `import/template/`), React 19, Prisma 6 + PostgreSQL, Tailwind 4, zod, jose (JWT session cookie), nodemailer.

**Routing**
- `src/app/(app)/` — the authenticated CRM; each section folder (`trips`, `clients`, `cash`, `lessors`, …) has `page.tsx`, `actions.ts` ("use server") and `forms.tsx` (client components using `useActionState`).
- `src/app/site/` — public marketing site. `src/proxy.ts` rewrites requests whose host is in `SITE_HOSTS` (reyspro.uz, www) to `/site`; `crm.reyspro.uz` and LAN addresses get the app.
- `src/proxy.ts` also rejects any POST/PUT/PATCH/DELETE without a `Next-Action` header (works around a Next.js CPU hang on no-JS bound-action posts). E2E tests of actions must therefore go through the JS action protocol, not plain form posts.
- `login`, `register`, `select-org`, `set-password`, `oferta` — auth / onboarding outside the app shell.

**Multi-tenancy and permissions (always go through these)**
- `src/lib/scope.ts`: every org-owned query takes its `where` from `orgScope(user)` / `orgForWrite(user)`; the org always comes from the session membership, never from client input. Super Admin has no org and sees no tenant data.
- `src/lib/roles.ts`: permission table (`can(role, perm)`); roles SUPER_ADMIN, DIRECTOR, MANAGER, DEPUTY, ACCOUNTANT, SPECIALIST.
- `src/lib/access.ts`: per-section VIEW/EDIT levels (SPECIALIST gets them per section from the director).
- `src/lib/session.ts`: `requireSession()`, `requireSection(section, "VIEW"|"EDIT")`, `assertWritable` (demo accounts must not persist anything). An `Account` (phone/password) can hold memberships (`User`) in several orgs; the session picks one.
- Mutating actions call `audit(...)` (`src/lib/audit.ts`).

**Pure core vs DB modules:** `src/lib/*-core.ts` files (trips-core, cash-core, settlement-core, currency-core, places-core, import-core, billing-core, …) are pure logic with no DB and are what the unit tests target; the same-named modules without `-core` wrap them with Prisma queries. Files that import `server-only` are aliased to a stub in vitest.

**Forms:** `src/lib/form.ts` — actions return `FormState` (`fail(errorKey, formData)` re-fills inputs); error values are i18n keys (`keyof Dict`), never raw strings.

**i18n:** `src/i18n/uz.ts` defines `Dict` (the source of keys); `uzCyrl.ts` and `ru.ts` must have every key, non-empty (`test/i18n.test.ts`). Server code uses `getT()`; client components get the dict via `getDict()`. Locale is in the `lang` cookie.

**Background jobs and Telegram bot**
- `src/instrumentation.ts` starts:
  - Telegram bot long-polling (`TELEGRAM_POLLING=off` disables it);
  - the driver-ledger scheduler (`driver-ledger.ts`, monthly membership fees) and the staff 9:00 digest (`AUTO_JOBS=off` disables both).
- Bot files:
  - `telegram-bot.ts`: update handling, the driver side (trip cards, stage buttons, balance) and contact linking;
  - `telegram-staff.ts`: the staff side (read-only views, daily digest, income notices);
  - `telegram-common.ts`: the shared API call and labels.
- Everything the bot imports must **not** import `server-only`, because instrumentation runs outside the react-server condition and the import throws there. That is why `alerts.ts`, `settlement.ts`, `cash.ts`, `search.ts` and `today.ts` have no `server-only`.
- Staff in the bot see exactly what their role and sections allow (`sectionLevel`, `orgScope`).

**Mail:** `src/lib/mailer.ts` — SMTP from `SMTP_*`; with no SMTP it appends to the `MAIL_OUTBOX` file.

**Domain notes:** trip stages are fixed (`EVENT_ORDER` in trips-core: ACCEPTED → ARRIVED_LOADING → LOADED → ARRIVED_UNLOADING → UNLOADED; the old ENTERED_UZ/EXITED_UZ border events remain in the enum but are no longer used). Places are stored as "City (Country)" via `formatPlace`. Times are handled in Asia/Tashkent (`parseTashkentDateTime`, `formatTashkent`). Money is multi-currency per org (`org-currency.ts`, `rates.ts`).

## Deployment (Windows test/production server on this machine)

- Code in `C:\logistika`; all persistent data (Postgres 16 data dir, uploads, backups, logs) under `D:\logistika-data`. New persistent paths must go there, never into the repo.
- Live server: scheduled task "Logistika Server" (SYSTEM, `scripts/start-server.ps1`, port 3000). Deploy = `scripts/update-server.ps1` run as Administrator (needs the user's UAC click); afterwards check that `.next\server\preview-props.json` exists and `http://localhost:3000/login` returns 200.
- Internet: Cloudflare Tunnel run as scheduled task "Logistika Tunnel" (`scripts/tunnel-task.ps1`, config `C:\ProgramData\cloudflared\config.yml`) → crm.reyspro.uz / reyspro.uz / www → localhost:3000. Secrets (Telegram, SMTP) are entered via `scripts/internet-sozlash.ps1` into `.env`; never print `.env` contents.
- `COOKIE_SECURE=auto` makes the session cookie Secure only when `x-forwarded-proto` is https (so LAN http still works).
- Verifying a build without touching the live `.next`: `NEXT_DIST_DIR=.next-check npx next build`, then `next start -p 3001` with `TELEGRAM_POLLING=off AUTO_JOBS=off` and SMTP disabled. Temporarily drop `.next` types from `tsconfig.json` include/exclude for that build and restore it after. `prisma generate` hits EPERM on the engine DLL while the live server runs; types still generate.
- PowerShell 5.1: `.ps1` files containing non-ASCII text must be saved as UTF-8 with BOM.
