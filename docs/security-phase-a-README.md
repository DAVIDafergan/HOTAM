# Security Phase A — reviews / messages / chats / admins / reports

Based on the production policy audit of 2026-09-27 (43 rows). RLS policies only,
no app code changes. All SQL files are pure ASCII with no comments, so they can be
pasted into the Supabase SQL Editor safely.

| File | Purpose |
|---|---|
| `security-phase-a-migration.sql` | The migration (idempotent, safe to run twice) |
| `security-phase-a-verify.sql` | Read-only: lists the policies on the 6 tables |
| `security-phase-a-rollback.sql` | Restores the exact pre-migration production policies |

## What it fixes

| # | Table | Before (production) | After |
|---|---|---|---|
| 1 | reviews | `DELETE USING (buyer_id IS NOT NULL)` — anyone, even anonymous, could delete every review | only the review's author |
| 2 | reviews | an "order review" could reference any order | `order_id` must be the reviewer's own **completed** order with that seller (these reviews count toward the scribe rating) |
| 3 | supermarket_reviews | `INSERT WITH CHECK (true)` — rate a scribe in anyone's name | own name only, and not yourself |
| 4 | messages | `SELECT USING (true)` — every private message was public | conversation participants + admin |
| 5 | messages | insert only checked sender = self | sender must be a participant of that conversation |
| 6 | chats | `SELECT USING (true)` | participants + admin |
| 7 | admins | `SELECT USING (true)` — admin list + emails public | a user sees only their own row (admin detection) + admin sees all |
| 8 | reports | `SELECT USING (true)` | the reporter (own reports) + admin |

## How it was verified (local Supabase with the exact production policies)

- 11 attacks (anonymous and logged-in, straight against the REST API): all succeed
  before, all blocked after.
- 10 legitimate operations still work after: participants read/send messages, a new
  user opens a chat, rating a scribe, order review after completion, product review,
  filing a report, deleting own review/rating, admin reads everything, admin detection.
- Real browser: open a new chat + send, seller sees it, post + delete own product
  review, rate a scribe, rate a completed order, admin chats panel, non-admin kept
  out of /admin.
- Rollback restores the exact 20 production policies (attacks work again), and
  re-applying blocks them again.

## Not covered here (Phase B — needs code changes)

- `sellers` / `customers` public read exposes bank details, phone, email, address.
- The seller can read the order's delivery `verification_code`.
- `chats_participant_update` lets a participant clear `is_suspicious`.
- Production has no UPDATE policy on `messages`, so "mark as read" is a no-op
  (existing bug; a fix needs a column guard so text can't be edited).
- Realtime (live chat updates) could not be exercised locally; Realtime applies the
  same SELECT policies, and participants keep read access.
