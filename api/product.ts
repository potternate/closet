import { isBlockedTitle, microlink, nameFromShareText, nameFromUrl, siteFromUrl, splitTitle } from './_lib/fallback.js'
import { errorResponse, FetchError, fetchPublic, parseUrl } from './_lib/fetchSafe.js'
import { parseProduct, type ProductInfo } from './_lib/product.js'

async function direct(url: URL): Promise<ProductInfo | undefined> {
  try {
    const page = await fetchPublic(url, 'text/html,application/xhtml+xml', 4 * 1024 * 1024)
    if (!/html|xml/i.test(page.contentType)) return undefined
    return parseProduct(new TextDecoder().decode(page.body), page.url.href)
  } catch (error) {
    if (error instanceof FetchError && error.status === 400) throw error
    return undefined
  }
}

// Product page -> name/brand/price/images, via JSON-LD/Open Graph with a microlink fallback.
export async function lookupProduct(raw: string): Promise<ProductInfo> {
  const url = parseUrl(raw)
  let product: ProductInfo = (await direct(url)) ?? { url: url.href, images: [] }
  if (product.name && isBlockedTitle(product.name)) product = { ...product, name: undefined, description: undefined }
  if (!product.images.length || !product.name) {
    const extra = await microlink(url)
    product = {
      ...product,
      name: product.name ?? extra.name,
      description: product.description ?? extra.description,
      images: product.images.length ? product.images : (extra.images ?? []),
    }
  }
  product = splitTitle({
    ...product,
    name: product.name ?? nameFromShareText(raw) ?? nameFromUrl(url),
    siteName: product.siteName ?? siteFromUrl(url),
  })
  if (!product.name && !product.images.length) throw new FetchError('Couldn’t find a product on that page', 422)
  return product
}

export async function GET(request: Request) {
  try {
    const product = await lookupProduct(new URL(request.url).searchParams.get('url') ?? '')
    return Response.json(product, { headers: { 'cache-control': 'public, max-age=600' } })
  } catch (error) {
    return errorResponse(error)
  }
}
