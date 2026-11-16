import type { ProductInfo } from './product.ts'

export const isBlockedTitle = (title: string) =>
  /access denied|just a moment|attention required|captcha|are you a (robot|human)|security check|forbidden|pardon our interruption/i.test(title)

const titleCase = (text: string) => text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())

export function nameFromShareText(raw: string) {
  const before = raw.slice(0, raw.search(/https?:\/\//i)).trim()
  if (!before) return undefined
  const match = before.match(/^(?:check out|look at|i found)\s+(?:the\s+|this\s+)?(.+?)(?:\s+(?:available\s+)?(?:on|at|from)\s+[\w.' ]+)?[\s:!.-]*$/i)
  return (match?.[1] ?? before).trim() || undefined
}

export function nameFromUrl(url: URL) {
  const segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment))
  const slug = segments
    .map((segment) => segment.replace(/\.(html?|php|aspx?)$/i, ''))
    .reverse()
    .find((segment) => /[a-z]{3,}.*[-_][a-z]{3,}/i.test(segment))
  if (!slug) return undefined
  const words = slug
    .replace(/^[0-9a-f]{6,}_/i, '')
    .split(/[-_+]+/)
    .filter((word) => word && !/^\d{4,}$/.test(word) && !/^[a-z]?\d+[a-z]?$/i.test(word))
  return words.length ? titleCase(words.join(' ')) : undefined
}

export function siteFromUrl(url: URL) {
  const host = url.hostname.replace(/^(www|m|shop|us)\./, '')
  return host.split('.')[0]
}

interface Microlink {
  status: string
  data?: { title?: string; description?: string; publisher?: string; image?: { url?: string } | null }
}

export async function microlink(url: URL): Promise<Partial<ProductInfo>> {
  try {
    const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url.href)}`, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) return {}
    const body = (await response.json()) as Microlink
    if (body.status !== 'success' || !body.data) return {}
    const { title, description, image } = body.data
    const usefulTitle = title && !/^\S+\.(html?|php|aspx?)(\?\S*)?$/i.test(title) && !isBlockedTitle(title) ? title : undefined
    return { name: usefulTitle, description: description ?? undefined, images: image?.url ? [image.url] : [] }
  } catch {
    return {}
  }
}

export function splitTitle(product: ProductInfo): ProductInfo {
  if (!product.name || product.brand) return product
  const parts = product.name.split(/\s+-\s+/)
  if (parts.length === 3 && parts[2].toLowerCase().endsWith(parts[0].toLowerCase())) {
    const color = parts[2].slice(0, parts[2].length - parts[0].length).trim()
    return { ...product, brand: parts[0], name: parts[1], color: product.color ?? (color || undefined) }
  }
  return product
}
