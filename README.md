# Closet

A phone-first digital closet. Add clothes by pasting a product link from any store or by taking/choosing a photo, and browse everything in a grid with category, color, season, and search filters. Install it from Safari with **Share → Add to Home Screen**.

## How it works

- **Product links**: `api/product.ts` (a Vercel function) reads the page's JSON-LD / Open Graph data for the name, brand, price, color, and photos. If the store blocks the request, it falls back to [Microlink](https://microlink.io) (free tier, no key) and then to the link text / URL slug. `api/image.ts` proxies product photos so the browser can process them. Both reject private and internal addresses.
- **Photos**: images are resized in the browser, and backgrounds are removed on-device with [BRIA RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) via [Transformers.js](https://github.com/huggingface/transformers.js) (the ~88 MB model loads from Hugging Face the first time, then stays cached; RMBG-1.4 is licensed for non-commercial use). The main color is detected automatically.
- **Storage**: the app works signed out (items in `localStorage`, photos in IndexedDB). Signing in with an emailed 6-digit code syncs items to Supabase table `closet_items` and photos to the private `closet-photos` bucket (`{userId}/...`). Anything added before signing in moves into the account.

## Add from the Share sheet

Opening `/?add=<link or share text>` opens Add item and imports it straight away. Add `&to=wishlist` to send it to the Wishlist. Several links import together. On Android the installed app shows up in the Share sheet by itself. On iPhone, make a Shortcut:

1. Shortcuts app, then **+**. Tap the info button and turn on **Show in Share Sheet**. Set it to receive **URLs** and **Text**.
2. Add **URL Encode** with **Shortcut Input**.
3. Add **Open URLs** with `https://closet-zeta-lemon.vercel.app/?add=` followed by the **URL Encoded Text** variable.

Duplicate it and add `&to=wishlist` to the end for a "Add to Wishlist" version.

## Item API (for agents)

`api/items.ts` exposes a token-authenticated endpoint so an agent (e.g. a "muse") can manage items in your account. Auth is `Authorization: Bearer $MUSE_TOKEN`.

- `GET /api/items` — list items (`{ items: [...] }`). Optional filters: `q` (words matched against name/brand/category/color/size/notes), `category`, `color` (matches any of the item's colors, case-insensitive), `brand` (substring), `wishlist=true|false`. Example: `/api/items?category=Shoes&color=black&wishlist=false`.
- `POST /api/items` — create. Body: item fields (`name` required) plus optional `imageUrl` (downloaded and stored in the private photo bucket). Colors: `colors` is a list from Black, White, Gray, Beige, Brown, Red, Burgundy, Pink, Orange, Yellow, Green, Olive, Blue, Navy, Purple, Multi (first = main color); `color` alone sets a single color.
- `PATCH /api/items` — update. Body: `{ id, ...fields }`; fields replace those in the item.
- `DELETE /api/items?id=...` — writes a tombstone so the item deletes on every synced device.
- `PUT /api/items` — log wears. Body: `{ "ids": ["...", ...], "day": "YYYY-MM-DD" }` (`day` optional, defaults to today; idempotent per item per day).

Auth is `Authorization: Bearer <muse token>`; the token lives in Supabase (the `muse_config` table, checked by the `muse_*` security-definer RPCs), so no Vercel environment variables are required. Writes go to `public.closet_items` under your user id and the newest `updated_at` wins merges. `imageUrl` additionally needs `SUPABASE_SERVICE_ROLE_KEY` set on Vercel to write into the private photo bucket.

## Development

```bash
npm install
npm run dev      # app + /api routes on http://localhost:5173
npm test         # product-page parser tests
npm run build
```

Supabase defaults to project `ilrpvkxagutjmbmesqkd`; override with `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`). Schema lives in `supabase/migrations/`.

## Deploying

Import the repo in Vercel (framework preset **Vite**). The `api/` folder deploys as serverless functions automatically. No environment variables are required.
