# Vault: scope for the coding agent

Written from the side that will actually use it: Muse (Louie), the assistant
that does Nate's shopping. Nate is building this vault for the assistant, so
this doc says what the assistant needs from the closet app to shop well —
not what the app should look like.

## The job

Before Nate buys anything, the assistant checks the vault (his closet) and
answers: **Buy / Skip / Think**, with reasons. The vault is the source of
truth. This is the opposite of the Whering model, where the wardrobe app
holds your data and sells you its recommendations.

## What the assistant needs

### 1. A vault it can read, reliably

`GET /api/items` is the assistant's only read path. On Nov 16 it was down
~7 hours (roughly 02:00–09:15 PT, site root fine, API hanging) and every
check that day was unverifiable. Requirement: the API stays up, and a
failure is visible (health/status) instead of a silent hang. How to fix it
is the coding agent's call — uptime is the requirement, not the mechanism.

### 2. Complete structured data per item

The check reasons over fields. Every item should carry: name, brand, model,
category, colors (from the existing enum), size, price + currency, seasons,
wishlist flag, source URL, notes. Gaps found Nov 16 that break real checks:

- Price missing on many items — no price context, no cost-per-wear.
- Size missing on many items — can't flag a wrong-size listing.
- Model unidentified on ~10 items (e.g. "Nike White Sneakers", "White Low
  Sneakers", both adidas trainers, Akila sunglasses, Kapital bucket hat) —
  can't tell a duplicate from a new model.
- Nate's default sizes for the check: Large top, 32x34 pants, size 12 shoes.

Requirement: backfill what can be backfilled, and make size/price part of
the add flow so new items don't land incomplete.

### 3. Photos that are correct and clean

The vault is only as good as its photos. Nov 16 found: a wrong-item photo
live on an item, on-model shots where a flat shot was needed, mannequin
heads, and dirty backgrounds. Standing rule: the cover photo must be the
right item, background-removed, clean stock-style.

Good news: the in-app Remove background button works (verified in the cloud
browser Nov 16 evening — module loads, cuts cleanly on upload). It only
appears in an item's Edit form when the photo still has a background. The
assistant treats a clean cover photo as a data-quality gate: an item with a
wrong or dirty photo is flagged, not silently trusted.

### 4. Photo writes via the API (unblock or document)

`PATCH /api/items` with `imageUrl` is blocked: the server returns
"imageUrl needs SUPABASE_SERVICE_ROLE_KEY configured". Photos can only be
set through the signed-in UI today. For an agent-driven vault, photo
management through the API matters. Either set the env var on Vercel or
document the supported alternative — don't leave it erroring silently.

### 5. Search that answers "do I own something like this?"

The API already has `q` / `category` / `color` / `brand` / `wishlist`
filters. The check needs one more thing: similarity. Given a candidate
(name, brand, category, color), return the closest owned items — same
brand + model first, then same category + color, then text-similar names.
Implementation is the coding agent's choice (text match, trigram, or
embeddings later); the requirement is a ranked similar-items answer, not
just exact filters.

### 6. The buy-check itself

Input: a product link (parsed through the existing `api/product.ts`
JSON-LD / Open Graph pipeline) or a manual name/brand/category/color/price.

Checks, in order:

1. **Duplicate** — exact or near-duplicate owned. Verdict leans Skip.
2. **Wishlist** — the item (or its duplicate) is already wishlisted. Say so
   instead of treating it as new.
3. **Gap** — fills a missing slot: a category / color / season with zero
   items in the vault. Verdict leans Buy.
4. **Matches** — what it goes with: owned items in the same or
   complementary colors and seasons. Listed, not scored.
5. **Price context** — price vs. similar owned items; cost-per-wear when
   wear history exists (the `PUT /api/items` wear log exists but is barely
   used — the check should use it when present).
6. **Size** — flag when the listing's size doesn't match Nate's defaults
   or the sizes of similar owned items.

Output: one verdict (**Buy / Skip / Think**), one-line reasons per check,
and the matching owned items named. Short by default; detail on request.

### 7. A decision log

Record checks and verdicts so the assistant doesn't re-litigate the same
item every time, and so skipped items stay skipped for a reason. Shape is
the coding agent's call (new table vs. item notes); the requirement is that
a past verdict is retrievable by product URL or name.

## Phases

- **Phase 0 — now, no app code.** The assistant runs the check with the
  existing API. Possible today except for the gaps in §2–§4.
- **Phase 1 — make the vault trustworthy.** Data backfill (§2), API
  reliability (§1), unblock or document photo writes (§4).
- **Phase 2 — the check as a feature.** A `?check=<link>` entry point next
  to the existing `?add=` flow, showing the verdict before the item is
  added; similarity search (§5); decision log (§7).
- **Phase 3 — beyond the check.** Gap dashboard (what the vault is missing),
  outfit matches, price tracking. Separate features, not part of the check.

## Non-goals

No auto-purchase, no deal alerts, no outfit generation in this scope.

## Acceptance tests (how it gets verified)

Run the check against five known links and confirm the verdicts:

1. An exact duplicate of an owned item → Skip, names the owned item.
2. An item filling an empty category/color/season slot → Buy (or Think
   with the gap named).
3. A listing in the wrong size → flagged, whatever the verdict.
4. An item already on the wishlist → surfaced as wishlisted, not new.
5. An item with no close match and no gap → Think, with the nearest owned
   items listed.

Plus: the API answers every time during the test, and every item in the
vault has a correct, clean cover photo.

## Open questions for Nate

- Where the check lives in the UI (`?check=` share-sheet flow vs. a button
  on the wishlist).
- Whether verdicts get stored, and if so where.
- Whether the decision log should also feed a "don't show me this again"
  rule for skipped items.
