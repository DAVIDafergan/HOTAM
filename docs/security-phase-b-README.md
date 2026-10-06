# Security Phase B: private seller/customer data, delivery codes, chats, messages

## What was open (checked on production with the public anon key, zero rows fetched)

- `sellers` "Allow public read": anyone could read all 36 sellers, including bank name/branch/
  account number, business id, phone, email and street address.
- `customers` "Allow public read": anyone could read all 52 customers' email, phone and address.
- The public search page rendered every approved seller with `select('*')`, so the same private
  fields were embedded in its HTML (fixed separately by `hotfix/public-seller-data-leak`).
- `orders_parties_read`: the seller could read the buyer's delivery `verification_code` and mark
  the order delivered without the buyer.
- `chats_participant_update`: a participant could clear `is_suspicious` or rewrite `participants`.
- No UPDATE policy on `messages`: "mark as read" silently did nothing.

## Files (clean ASCII, no comments, safe to paste into the SQL Editor)

| File | What it does | Breaks old code? |
|---|---|---|
| `security-phase-b-1-additive.sql` | Views `sellers_public` / `customers_public` (safe columns), `my_order_codes()`, chat and message guard triggers, message mark-as-read policy | No |
| `security-phase-b-2-lockdown.sql` | Removes public read on `sellers` / `customers` (owner + admin only), removes `verification_code` from browser-readable columns | Yes, before the new code is live |
| `security-phase-b-rollback.sql` | Restores the previous state | |
| `security-phase-b-verify.sql` | Read-only checks after running | |

## Order (important)

1. Run `security-phase-b-1-additive.sql`.
2. Merge `security/phase-b` and wait for the Vercel production deploy.
   (The code also works before step 1: every view read falls back to the table.)
3. Run `security-phase-b-2-lockdown.sql`.
4. Run `security-phase-b-verify.sql` and send the result.

## Behaviour after the lockdown

- Public pages, search, chat headers: read `sellers_public` / `customers_public` (name, photo,
  city, the scribe's halachic details; certificates and writing samples only for real scribes).
  Never phone, email, address, age, business or bank details.
- Each seller/customer still reads and edits their own full row; admins read everything.
- The seller dashboard's read-only business/bank section now actually shows the owner's details
  (it read a column list without them before, so it was always empty).
- The buyer's delivery codes come from `my_order_codes()` (only their own orders); delivery is
  confirmed on the server (`/api/orders/verify-delivery`), unchanged.
- Chat email notices go through `/api/chat/notify`: the server looks up the recipient and their
  preference; no one's email reaches the other participant's browser. (The old client call had
  no auth token and was rejected with 401, so chat emails were not being sent at all.)
- Participants can raise the "suspicious" flag but not clear it, and can't change `participants`.
- The recipient can mark messages as read; nobody but an admin can edit a message's content.

## Not covered

- Realtime (live chat/order updates) could not run locally. Realtime applies the same row
  policies; the site only uses Realtime events as a "refetch" trigger, not their payload.
- Any column added to `orders` later must be added to the GRANT in part 2 to be readable by the
  browser (the server is unaffected).
