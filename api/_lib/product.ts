export interface ProductInfo {
  url: string
  name?: string
  brand?: string
  price?: number
  currency?: string
  color?: string
  description?: string
  siteName?: string
  images: string[]
}

type Json = Record<string, unknown>

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(value) ? String.fromCodePoint(value) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

function clean(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return undefined
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim()
  return text || undefined
}

function attributes(tag: string) {
  const attrs: Record<string, string> = {}
  for (const match of tag.matchAll(/([a-zA-Z_:][-\w:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? ''
  }
  return attrs
}

function metaTags(html: string) {
  const meta: Record<string, string> = {}
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0])
    const key = (attrs.property ?? attrs.name ?? attrs.itemprop)?.toLowerCase()
    if (key && attrs.content && !(key in meta)) meta[key] = attrs.content
  }
  return meta
}

function asArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]
}

function hasType(node: Json, type: string) {
  return asArray(node['@type'] as string | string[]).some((t) => typeof t === 'string' && t.toLowerCase() === type.toLowerCase())
}

function walk(value: unknown, visit: (node: Json) => void) {
  if (Array.isArray(value)) value.forEach((item) => walk(item, visit))
  else if (value && typeof value === 'object') {
    const node = value as Json
    visit(node)
    if (node['@graph']) walk(node['@graph'], visit)
  }
}

function jsonLdProducts(html: string) {
  const products: Json[] = []
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(match[1].trim()), (node) => {
        if (hasType(node, 'Product') || hasType(node, 'ProductGroup')) products.push(node)
      })
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return products
}

function imageUrls(value: unknown): string[] {
  return asArray(value as unknown).flatMap((item) => {
    if (typeof item === 'string') return [item]
    if (item && typeof item === 'object') {
      const node = item as Json
      return [node.url, node.contentUrl].filter((url): url is string => typeof url === 'string')
    }
    return []
  })
}

function brandName(value: unknown) {
  const brand = asArray(value as unknown)[0]
  if (brand && typeof brand === 'object') return clean((brand as Json).name)
  return clean(brand)
}

function offerPrice(value: unknown): { price?: number; currency?: string } {
  for (const offer of asArray(value as unknown)) {
    if (!offer || typeof offer !== 'object') continue
    const node = offer as Json
    const nested = node.priceSpecification ? offerPrice(node.priceSpecification) : {}
    const raw = node.price ?? node.lowPrice ?? nested.price
    const price = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/[^\d.]/g, ''))
    if (Number.isFinite(price) && price > 0) return { price, currency: clean(node.priceCurrency) ?? nested.currency }
    if (node.offers) return offerPrice(node.offers)
  }
  return {}
}

function absolute(url: string, base: string) {
  try {
    const resolved = new URL(decodeEntities(url.trim()), base)
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.href : undefined
  } catch {
    return undefined
  }
}

function tidyName(name: string | undefined, siteName: string | undefined) {
  if (!name) return undefined
  let result = name.replace(/^Amazon\.com\s*:\s*/i, '').replace(/\s*:\s*[^:]+&?[^:]*$/, (tail) => (/amazon/i.test(name) ? '' : tail))
  if (siteName) {
    const escaped = siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(`\\s*[|\\-–—:]\\s*${escaped}\\s*$`, 'i'), '').replace(new RegExp(`^${escaped}\\s*[|\\-–—:]\\s*`, 'i'), '')
  }
  const parts = result.split(/\s+[|–—]\s+/)
  if (parts.length > 1 && siteName && parts.at(-1)!.toLowerCase().includes(siteName.toLowerCase())) parts.pop()
  return parts.join(' | ').trim() || name
}

function tidyColor(color: string | undefined, name: string | undefined) {
  if (!color) return undefined
  const prefix = name && color.toLowerCase().startsWith(name.toLowerCase()) ? color.slice(name.length).replace(/^\s*[-–—:|]\s*/, '') : color
  return prefix.trim() || color
}

function pageImages(html: string) {
  const urls: string[] = []
  for (const match of html.matchAll(/<(?:link|img)\b[^>]*>/gi)) {
    const attrs = attributes(match[0])
    if (attrs.rel === 'image_src' && attrs.href) urls.push(attrs.href)
    if (attrs.id === 'landingImage' || attrs.itemprop === 'image') {
      const hiRes = attrs['data-old-hires']
      if (hiRes) urls.push(hiRes)
      const dynamic = attrs['data-a-dynamic-image']
      if (dynamic) {
        try {
          urls.push(...Object.keys(JSON.parse(decodeEntities(dynamic)) as Json))
        } catch {
          // Ignore malformed image maps.
        }
      }
      if (attrs.src && !attrs.src.startsWith('data:')) urls.push(attrs.src)
    }
  }
  return urls
}

export function parseProduct(html: string, pageUrl: string): ProductInfo {
  const meta = metaTags(html)
  const products = jsonLdProducts(html)
  const product = products[0] ?? {}
  const variant = asArray(product.hasVariant as Json | Json[])[0] ?? {}
  const siteName = clean(meta['og:site_name']) ?? clean(meta['application-name'])
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  const name = tidyName(clean(product.name) ?? clean(meta['og:title']) ?? clean(meta['twitter:title']) ?? title, siteName)
  const offer = offerPrice(product.offers ?? variant.offers)
  const metaPrice = parseFloat((meta['product:price:amount'] ?? meta['og:price:amount'] ?? '').replace(/[^\d.]/g, ''))

  const images = [
    ...imageUrls(product.image),
    ...imageUrls(variant.image),
    meta['og:image:secure_url'],
    meta['og:image'],
    meta['twitter:image'],
    meta['twitter:image:src'],
    ...pageImages(html),
  ]
    .filter((url): url is string => Boolean(url))
    .map((url) => absolute(url, pageUrl))
    .filter((url): url is string => Boolean(url))

  return {
    url: pageUrl,
    name,
    brand: brandName(product.brand) ?? clean(meta['product:brand']) ?? clean(meta['og:brand']),
    price: offer.price ?? (Number.isFinite(metaPrice) && metaPrice > 0 ? metaPrice : undefined),
    currency: offer.currency ?? clean(meta['product:price:currency']) ?? clean(meta['og:price:currency']),
    color: tidyColor(clean(product.color) ?? clean(variant.color) ?? clean(meta['product:color']), name),
    description: clean(product.description) ?? clean(meta['og:description']) ?? clean(meta.description),
    siteName,
    images: [...new Set(images)].slice(0, 12),
  }
}
