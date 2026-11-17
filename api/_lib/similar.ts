// Ranks closet items by how close they are to a shopping candidate:
// same product link, then same brand + model words, then same category + color, then text-similar names.

export interface Candidate {
  name?: string
  brand?: string
  category?: string
  colors?: string[]
  subtype?: string
  url?: string
}

type Item = Record<string, unknown>

export interface Match {
  item: Item
  score: number
  match: 'duplicate' | 'similar' | 'related'
  reasons: string[]
}

const COLOR_WORDS: Record<string, string> = {
  black: 'Black', white: 'White', cream: 'White', ivory: 'White', gray: 'Gray', grey: 'Gray', charcoal: 'Gray', silver: 'Gray',
  beige: 'Beige', tan: 'Beige', khaki: 'Beige', sand: 'Beige', brown: 'Brown', chocolate: 'Brown', mocha: 'Brown', red: 'Red',
  burgundy: 'Burgundy', maroon: 'Burgundy', wine: 'Burgundy', pink: 'Pink', orange: 'Orange', yellow: 'Yellow', green: 'Green',
  olive: 'Olive', blue: 'Blue', denim: 'Blue', navy: 'Navy', purple: 'Purple', multi: 'Multi', multicolor: 'Multi',
}
const STOP = new Set(['the', 'a', 'an', 'and', 'x', 'of', 'for', 'with', 'in', 'mens', 'men', 'womens', 'women', 'unisex', 'new', 'vintage', 'vtg'])

export const loose = (value: unknown) =>
  typeof value === 'string' ? value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’`.]/g, '') : ''

// Garment words say what kind of thing it is, which `category` already covers; they aren't the model.
const GENERIC = new Set(['jacket', 'coat', 'hat', 'cap', 'tee', 'tshirt', 't', 'shirt', 'shoe', 'sneaker', 'trainer', 'boot', 'pant', 'jean', 'trouser', 'hoodie', 'sweatshirt', 'sweater', 'top', 'short'])
const stem = (word: string) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word)
const words = (value: unknown) =>
  loose(value).split(/[^a-z0-9]+/).filter((word) => word && !STOP.has(word)).map(stem)

/** Free-text color ("Natural Grey", "Navy/White") -> closet color names. */
export function colorNames(value: unknown): string[] {
  return [...new Set(words(value).flatMap((word) => (COLOR_WORDS[word] ? [COLOR_WORDS[word]] : [])))]
}

export function itemColors(item: Item): string[] {
  if (Array.isArray(item.colors) && item.colors.length) return item.colors as string[]
  return typeof item.color === 'string' ? [item.color] : []
}

const VARIANT_PARAMS = /^(variant|color|colour|sku|style|dwvar_.*)$/i

function sameLink(a: unknown, b: unknown) {
  const key = (value: unknown) => {
    try {
      const url = new URL(String(value))
      // Tracking params are dropped; params that pick a variant (color, size, sku) keep links apart.
      const variant = [...url.searchParams].filter(([name]) => VARIANT_PARAMS.test(name)).map(([name, value]) => `${name.toLowerCase()}=${value}`).sort().join('&')
      return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}`.toLowerCase() + (variant ? `?${variant}` : '')
    } catch {
      return ''
    }
  }
  const left = key(a)
  return Boolean(left) && left === key(b)
}

function brandMatch(candidate: string, item: string) {
  const a = loose(candidate).replace(/[^a-z0-9]/g, '')
  const b = loose(item).replace(/[^a-z0-9]/g, '')
  return Boolean(a && b) && (a === b || (Math.min(a.length, b.length) >= 3 && (a.includes(b) || b.includes(a))))
}

// Model words: the name minus brand, color and stop words — "Nike Air Force 1 Low White" -> air force 1 low.
function modelWords(name: unknown, brand: unknown) {
  const skip = new Set([...words(brand), ...Object.keys(COLOR_WORDS), ...GENERIC])
  return new Set(words(name).filter((word) => !skip.has(word)))
}

export function rankSimilar(candidate: Candidate, items: Item[], limit = 5): Match[] {
  const candidateColors = candidate.colors ?? []
  const model = modelWords(candidate.name, candidate.brand)
  const matches = items.map((item): Match => {
    const reasons: string[] = []
    let score = 0
    const link = Boolean(candidate.url && sameLink(candidate.url, item.url))
    if (link) (score += 100), reasons.push('same product link')
    const brand = Boolean(candidate.brand && brandMatch(candidate.brand, String(item.brand ?? '')))
    if (brand) (score += 3), reasons.push('same brand')
    const theirs = modelWords(item.name, item.brand)
    const shared = [...model].filter((word) => theirs.has(word))
    const overlap = shared.length ? shared.length / new Set([...model, ...theirs]).size : 0
    if (shared.length) (score += overlap * 6), reasons.push(`shares “${shared.join(' ')}”`)
    const category = Boolean(candidate.category && loose(candidate.category) === loose(item.category))
    if (category) (score += 2), reasons.push(`also ${item.category}`)
    const colors = itemColors(item)
    const sharedColors = candidateColors.filter((color) => colors.includes(color))
    if (sharedColors.length) (score += sharedColors[0] === colors[0] ? 1.5 : 1), reasons.push(sharedColors.join('/').toLowerCase())
    if (candidate.subtype && loose(candidate.subtype) === loose(item.subtype)) (score += 1.5), reasons.push(`same type (${item.subtype})`)
    // Near-duplicate: same brand, most of the shorter model name shared, and a shared color (same colorway).
    const containment = shared.length ? shared.length / Math.min(model.size, theirs.size) : 0
    const duplicate = link || (brand && containment >= 0.6 && sharedColors.length > 0 && (category || !candidate.category))
    const similar = (brand && overlap > 0) || (category && sharedColors.length > 0) || overlap >= 0.5
    return { item, score: Math.round(score * 10) / 10, match: duplicate ? 'duplicate' : similar ? 'similar' : 'related', reasons }
  })
  return matches
    .filter((match) => match.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Sizes owned in a category, most common first: [{ size: "L", count: 6 }]. */
export function sizesIn(category: string | undefined, items: Item[]) {
  if (!category) return []
  const counts = new Map<string, number>()
  for (const item of items) {
    if (loose(item.category) !== loose(category) || typeof item.size !== 'string' || !item.size.trim()) continue
    counts.set(item.size.trim(), (counts.get(item.size.trim()) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([size, count]) => ({ size, count }))
}
