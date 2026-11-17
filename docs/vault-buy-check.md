# Vault: shopping sense-check ("buy-check") — spec v0.1

## Idea

The closet is the source of truth for shopping. Before Nate buys anything,
check the vault first: what he already owns decides whether a purchase makes
sense. This is the opposite of the Whering model, where the wardrobe app holds
your data and sells you its recommendations. Here the vault is his, and the
recommendations come from his own agent.

## v0: agent-side check (no app code)

Muse runs the check using the existing item API (`GET /api/items`). No new
tables, no new endpoints. Input is a product link (parsed through the same
`api/product.ts` pipeline the app already uses for imports) or a manual
name/brand/category/color/price.

## The checks

1. **Duplicate** — exact or near-duplicate already owned (same brand + model,
   or same category + color with a similar name). Verdict leans Skip.
2. **Gap** — fills a missing slot: a category / color / season with zero
   items in the vault. Verdict leans Buy.
3. **Matches** — what it goes with: owned items in the same or complementary
   colors and seasons that complete outfits with it. Listed, not scored.
4. **Price context** — price vs. similar owned items; cost-per-wear when wear
   history exists (`PUT /api/items` wear log).
5. **Wishlist** — if the item (or a duplicate of it) is already wishlisted,
   say so instead of treating it as new.

## Verdict

One of **Buy / Skip / Think**, with one-line reasons per check and the
matching owned items named. Short by default; detail on request.

## v1: in-app (later)

- A `?check=<link>` entry point next to the existing `?add=` flow, showing the
  verdict before the item is added.
- Optional: log checked items and verdicts so repeat checks are instant and
  the vault learns what was skipped and why.

## Non-goals for v1

No auto-purchase, no price tracking / deal alerts, no outfit generation.
Those are separate features, not part of the check.

## Open questions

- Where the check lives in the UI (share-sheet `?check=` vs. a button on the
  wishlist).
- Whether verdicts get stored, and if so where (new table vs. item notes).
