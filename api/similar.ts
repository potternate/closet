import { guessCategory } from './_lib/category.js'
import { errorResponse, FetchError } from './_lib/fetchSafe.js'
import { colorNames, rankSimilar, sizesIn, type Candidate } from './_lib/similar.js'
import { rpc, token } from './_lib/supabase.js'
import { lookupProduct } from './product.js'

// GET /api/similar?url=<product link>  or  ?name=&brand=&category=&color=&subtype=  (&limit=5, &archived=true to include archived)
// -> { candidate, matches: [{ id, name, ..., status, score, match: duplicate|similar|related, reasons }], sizes }
// Owned and wishlist items are compared; `status` says which. Auth: same muse bearer token as /api/items.
export async function GET(request: Request) {
  try {
    const tok = token(request)
    const params = new URL(request.url).searchParams
    const field = (key: string) => params.get(key)?.trim() || undefined
    const url = field('url')
    let candidate: Candidate & { price?: number; currency?: string } = {
      name: field('name'),
      brand: field('brand'),
      category: field('category'),
      subtype: field('subtype'),
      colors: colorNames(field('color')),
      url,
    }
    if (url && !candidate.name) {
      const product = await lookupProduct(url).catch(() => undefined)
      if (product) {
        candidate = {
          ...candidate,
          name: product.name,
          brand: candidate.brand ?? product.brand,
          colors: candidate.colors?.length ? candidate.colors : colorNames(`${product.color ?? ''} ${product.name ?? ''}`),
          price: product.price,
          currency: product.currency,
        }
      }
    }
    candidate.category ??= candidate.name ? guessCategory(candidate.name) : undefined
    if (!candidate.name && !candidate.brand && !candidate.url) throw new FetchError('Send url, or name/brand/category/color', 400)
    const limit = Math.min(Math.max(Number(params.get('limit')) || 5, 1), 20)
    const withArchived = params.get('archived') === 'true'
    const items = ((await rpc('muse_list', { tok })) ?? []) as Record<string, unknown>[]
    const pool = items.filter((item) => withArchived || !item.archived)
    const matches = rankSimilar(candidate, pool, limit).map(({ item, score, match, reasons }) => {
      const wears = Array.isArray(item.wears) ? (item.wears as string[]) : []
      return {
        id: item.id,
        name: item.name,
        brand: item.brand,
        category: item.category,
        colors: Array.isArray(item.colors) && item.colors.length ? item.colors : item.color ? [item.color] : [],
        size: item.size,
        price: item.price,
        currency: item.currency,
        url: item.url,
        status: item.archived ? 'archived' : item.wishlist ? 'wishlist' : 'owned',
        wears: wears.length,
        ...(wears.length && { lastWorn: [...wears].sort().at(-1) }),
        score,
        match,
        reasons,
      }
    })
    const owned = items.filter((item) => !item.archived && !item.wishlist)
    return Response.json({ candidate, matches, sizes: sizesIn(candidate.category, owned) })
  } catch (error) {
    return errorResponse(error)
  }
}
