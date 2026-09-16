# Morocco Core requirement matrix

This matrix records verified behaviour for the current repository. `VERIFIED`
means the implementation was exercised against the staging database and, where
marked, through the browser. `PARTIAL` means the operational core exists but an
optional or external integration is still absent. `BLOCKED` is reserved for
evidence that cannot be collected without an external deployment/provider.

| Requirement | Status | Implementation | Migration | Evidence |
|---|---|---|---|---|
| Tenant isolation and private storage | VERIFIED | RLS policies, scoped services and signed private objects | `0009`–`0032`, `0067`–`0068` | `npm run test:security` 8/8; browser tenant case |
| Roles and server permissions | VERIFIED | `requireAgencyPermission`, role matrix and RPC checks | `0068` | security 8/8; Agent forbidden-action browser case |
| Login rate limiting | VERIFIED | IP + email bucket RPC and login action | `0069` | `tests/auth-rate-limit.test.mjs` 1/1 |
| Leaked-password protection | PARTIAL | Supabase Auth setting is plan-gated | — | Advisor limitation documented; no fake implementation |
| Moroccan/foreign/company customer data | VERIFIED | Customer schema/forms for CIN, passport, licence, ICE/IF/RC, WhatsApp | `0052` | Morocco workflow tests; browser fixtures |
| Customer documents and expiry alerts | VERIFIED | Private customer-document bucket, signed URLs and dashboard alerts | `0052`, `0067` | security storage isolation; build |
| Duplicate detection and internal risk flags | VERIFIED | Database duplicate guards and risk actions scoped to agency | `0104`–`0105` | Morocco duplicate tests 15/15 |
| Separate payer, principal and additional drivers | VERIFIED | `rental_participants` actions and dossier UI | `0055`, `0064` | browser tests 05–06 with persisted participants |
| Owned, financed and sub-rental vehicles | VERIFIED | Ownership fields, supplier cost and settlement service | `0064` | Morocco settlement test; browser case 11 |
| Owner margin and settlement | VERIFIED | Idempotent owner settlement linked to expense/caisse | `0064`, `0070`–`0071` | Morocco test 13/15; browser case 11 |
| Vehicle documents and expiration alerts | VERIFIED | Private vehicle-document bucket and expiry widgets | `0026`–`0027` | security storage test; build |
| Exact-vehicle reservation | VERIFIED | Availability checks and exclusion protection | `0028`–`0029`, `0064` | browser double-booking case; security availability |
| Category reservation and later assignment | VERIFIED | Unassigned category flow and category guard | `0064` | browser case 04; Morocco category test |
| Pickup/return dates and times | VERIFIED | Exact timestamp fields and Morocco timezone conversion | `0059`, `0099`–`0101` | Morocco period tests 15/15 |
| Double-booking protection | VERIFIED | PostgreSQL overlap constraint plus server guard | `0028`–`0029` | security and browser case 02 |
| Vehicle calendar | VERIFIED | Vehicle timeline with branch/status filters | existing calendar migrations | production build route and browser navigation |
| Daily/weekly/monthly/seasonal pricing | VERIFIED | Pricing resolver and reservation snapshot | `0030`, `0032` | security extras/pricing coverage; build |
| Minimum price and audited manager override | VERIFIED | Permission-gated override history | `0030`, `0032` | pricing tests and server validation |
| Extras | VERIFIED | Small configurable catalogue and reservation/contract snapshots | `0031` | security totals/duplicates; browser standard rental |
| FR/AR/bilingual contract terms | VERIFIED | Configurable terms, language selector and printable document | `0051`, `0064` | standard browser rental; build |
| Customer and employee signatures | VERIFIED | Signature pad, append-only signature records | `0051`, `0055` | standard browser rental; security signature test |
| Vehicle preparation | VERIFIED | Checklist/readiness gate and audit | `0033`–`0034` | standard browser rental |
| Check-out with photos | VERIFIED | Mobile form, signature and six private pickup photos | `0035`, `0038` | standard browser rental 1/1 |
| Active rental, extension and swap | VERIFIED | Active updates, conflict-aware extension and swap chronology | `0036`–`0042` | security; browser cases 03, 09–10 |
| Breakdown replacement | VERIFIED | Same swap workflow with reason and status preservation | `0041`–`0042` | browser case 10 |
| Check-in review and return photos | VERIFIED | Review/finalize gate, mileage guard and six private return photos | `0043`, `0046`, `0049` | standard browser rental; security return test |
| Late, extra time, mileage, fuel and cleaning charges | VERIFIED | Server-computed return facts and immutable charge rows | `0043` | financial 9/9; standard browser rental |
| Damage and repair availability | VERIFIED | Damage status/garage/cost flow and vehicle availability sync | `0043`, `0047`, `0064` | security damage test; browser case 18 |
| Accidents/sinistres | PARTIAL | Accident entity, private photo bucket and damage link exist | `0043`, `0048` | database/security coverage; expert claim workflow remains optional |
| Historical fine matching | VERIFIED | Vehicle/time lookup with unresolved/ambiguous state | `0043` | Morocco fine test; browser case 17 |
| Deposit/caution lifecycle | VERIFIED | Independent deposit ledger, over-refund and duplicate guards | `0043`, `0045`, `0103` | Morocco 15/15; standard browser deduction/refund |
| Cheque deposit states | VERIFIED | Instrument and cheque status constraints | `0103` | `tests/deposit-cheque.test.mjs` 2/2 |
| Mixed payments, advances and remaining balance | VERIFIED | Payment ledger and contract financial calculator | `0070`–`0071` | standard browser rental; financial 9/9 |
| Payment/refund/expense to caisse | VERIFIED | Atomic RPCs create linked cash movements | `0070`–`0071` | atomic suite 4/4; Morocco settlement/caisse |
| Invoice/receipt totals and tax | VERIFIED | TTC source of truth; receipt equals paid cash, invoice equals payable total; void/version correction | code in `financial-documents.ts`, invoice actions | financial 9/9 and 3950 MAD regression |
| Atomic/idempotent financial actions | VERIFIED | Transactional RPCs and deterministic idempotency keys | `0070`–`0071`, `0106` | atomic suite 4/4; security 8/8 |
| Early return, cancellation and no-show outcomes | VERIFIED | Policy decisions update price/refund/status atomically | `0064`, `0099`, `0106` | Morocco/atomic tests; browser cancellation/no-show |
| Caisse | VERIFIED | Branch session, movements, expected/actual reconciliation | `0043`, `0064` | Morocco caisse isolation; build |
| Maintenance and document alerts | VERIFIED | Date/mileage service records and operational alerts | existing maintenance migrations | security/build and seeded dashboard |
| Delivery/collection missions | PARTIAL | Mission CRUD and driver status view | `0043` | build and route checks; GPS routing remains optional |
| Inter-branch transfers | VERIFIED | In-transit booking guard and completion branch update | `0043`–`0044` | Morocco transfer test; browser case 13 |
| One-way return branch | VERIFIED | Separate pickup/return branch fields, explicit pickup-branch validation, destination check-in and atomic closure branch update | `0064`, `0073` | `tests/e2e/one-way-rental.spec.ts` browser + staging DB: Casablanca pickup, Marrakech return, six photos each side, caution settlement, CLOSED contract, vehicle AVAILABLE in Marrakech |
| Excel import/export | VERIFIED | Validated customer/vehicle import and exports | existing import migrations | source/build review |
| DPL/NARSA readiness | PARTIAL | Configurable exports/data fields, no claimed official API | — | implementation review; official integration intentionally absent |
| Today/dashboard and rental dossier | VERIFIED | Operational cards, next actions and linked rental sections | existing dashboard migrations | build and browser standard rental |
| Simple employee navigation | UX NEEDS IMPROVEMENT | Core routes are grouped, advanced tools remain available | — | no participant usability study; hosted UX evidence unavailable |
| Hosted staging validation | BLOCKED | Release runner is fail-closed until HTTPS app URL is configured | — | `npm run test:e2e:release` requires `FLEETHUB_HOSTED_URL` |
