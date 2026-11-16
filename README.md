# Closet

A phone-first digital closet. Add clothes by pasting a product link from any store or by taking/choosing a photo, and browse everything in a grid with category, color, season, and search filters. Install it from Safari with **Share → Add to Home Screen**.

## How it works

- **Product links**: `api/product.ts` (a Vercel function) reads the page's JSON-LD / Open Graph data for the name, brand, price, color, and photos. If the store blocks the request, it falls back to [Microlink](https://microlink.io) (free tier, no key) and then to the link text / URL slug. `api/image.ts` proxies product photos so the browser can process them. Both reject private and internal addresses.
- **Photos**: images are resized in the browser, and backgrounds are removed on-device with [`@imgly/background-removal`](https://github.com/imgly/background-removal-js) (AGPL-3.0; model files load from IMG.LY's CDN the first time). The main color is detected automatically.
- **Storage**: the app works signed out (items in `localStorage`, photos in IndexedDB). Signing in with an emailed 6-digit code syncs items to Supabase table `closet_items` and photos to the private `closet-photos` bucket (`{userId}/...`). Anything added before signing in moves into the account.

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
