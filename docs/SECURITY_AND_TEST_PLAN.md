# EventBridge Hub — Security, Pilot Validation & Next Sprint

## Tests that must be run with four **separate** test accounts

| # | Action | Expected result |
|---|---|---|
| 1 | Unauthenticated visitor lists approved businesses | Approved listings only; no pending/suspended listing |
| 2 | Vendor A signs in and tries to read Vendor B's business/application | No row unless B's listing is publicly approved |
| 3 | Vendor A requests Vendor B's private quotes via API | No rows returned |
| 4 | Customer A requests Customer B's events via API | No rows returned |
| 5 | Planner A accesses an event assigned to Planner B | Denied; route returns not found |
| 6 | Customer A attempts to read a draft proposal | No rows returned |
| 7 | Vendor tries to update business status to `approved` via direct API | Blocked by database row policy |
| 8 | Any signup sets `role=admin` in auth user metadata | Account is created only as `customer` |
| 9 | Planner tries to include a quote from a different event in a proposal | Rejected atomically; no partial proposal |
| 10 | Planner shares proposal containing zero items | Rejected by trigger |
| 11 | Customer/planner/vendor tries to update another user's profile role | Rejected due to column grants |
| 12 | Vendor submits duplicate quote | Unique-key violation, no revision or duplicate |

## Closed-pilot acceptance criteria

- Two independent vendors receive distinct requests for the same customer event.
- Each vendor submits its own quote without seeing competitors' prices.
- Planner builds one proposal, with vendor amounts reconciled to the submitted quote records.
- Customer sees the proposal only after it is shared.
- Admin can approve/suspend listing and assign an event to an existing planner.
- Auth confirmation links work at local and production redirect URLs.
- All form errors and empty states remain understandable on mobile.
- Run security review before collecting real customer addresses or phone numbers.

## Sprint after deploying this build

**First priority: reliability and user notification**

1. Add email notifications with a validated sender domain (vendor quote request, quote reply, customer proposal ready).
2. Add rate limiting, CAPTCHA and abuse reporting.
3. Add server-side error monitoring, append-only audit logs for approvals/quotes/sharing, and backups.
4. Add better vendor availability questions without assuming an actual reservation.
5. Add an admin planner-verification process before public onboarding.

**Then, after pilot demand is validated:** calendar/conflict checks, proposal acceptance, contracts, payments, document uploads, vendor subscriptions, and advanced marketplace discovery.

## Risks and decisions to resolve before taking customer deposits

- Who is the merchant of record, responsible for taxes, disputes and refunds?
- Is the planner contracting with the customer, or are suppliers contracting directly?
- How are last-minute weather cancellations handled for inflatables?
- How is liability insurance/COI verification documented?
- What happens when a quote expires during proposal review?
- What personal event information is essential for supplier quoting?
- What is the permitted radius for on-site service across Raleigh–Durham?

Nothing in this implementation creates legally binding reservations or payment obligations.
