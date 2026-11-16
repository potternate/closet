import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'accept-language': 'en-US,en;q=0.9',
}

export class FetchError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase()
    if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7))
    return lower === '::1' || lower === '::' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)
  }
  const [a, b] = address.split('.').map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  )
}

export function parseUrl(raw: string | null) {
  const text = (raw?.match(/https?:\/\/\S+/i)?.[0] ?? raw)?.trim()
  if (!text) throw new FetchError('Paste a product link first')
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    throw new FetchError('That doesn’t look like a link')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new FetchError('Only web links are supported')
  return url
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new FetchError('That link isn’t reachable')
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (!addresses.length) throw new FetchError('Couldn’t find that website')
  if (addresses.some(({ address }) => isPrivateAddress(address))) throw new FetchError('That link isn’t reachable')
}

export async function fetchPublic(url: URL, accept: string, maxBytes: number, timeoutMs = 10000) {
  let current = url
  const signal = AbortSignal.timeout(timeoutMs)
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(current)
    const response = await fetch(current, {
      headers: { ...BROWSER_HEADERS, accept },
      redirect: 'manual',
      signal,
    }).catch((error: unknown) => {
      throw new FetchError(
        error instanceof Error && error.name === 'TimeoutError' ? 'That website took too long to respond' : 'Couldn’t reach that website',
        502,
      )
    })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current)
      continue
    }
    if (!response.ok) throw new FetchError(`The website said no (error ${response.status})`, 502)
    const declared = Number(response.headers.get('content-length') ?? 0)
    if (declared > maxBytes) throw new FetchError('That file is too large', 413)
    const reader = response.body?.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new FetchError('That file is too large', 413)
      }
      chunks.push(value)
    }
    const body = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { body, url: current, contentType: response.headers.get('content-type') ?? '' }
  }
  throw new FetchError('Too many redirects', 502)
}

export function errorResponse(error: unknown) {
  const status = error instanceof FetchError ? error.status : 500
  const message = error instanceof FetchError ? error.message : 'Something went wrong'
  return Response.json({ error: message }, { status })
}
