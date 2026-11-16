import { errorResponse, FetchError, fetchPublic, parseUrl } from './_lib/fetchSafe.js'

export async function GET(request: Request) {
  try {
    const url = parseUrl(new URL(request.url).searchParams.get('url'))
    const image = await fetchPublic(url, 'image/webp,image/png,image/jpeg,image/*;q=0.8', 12 * 1024 * 1024)
    if (!/^image\/(jpeg|png|webp|gif|avif)\b/i.test(image.contentType)) throw new FetchError('That link isn’t a photo', 415)
    return new Response(image.body, {
      headers: {
        'content-type': image.contentType,
        'cache-control': 'public, max-age=86400',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
