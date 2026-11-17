import { FetchError } from './fetchSafe.js'

export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://ilrpvkxagutjmbmesqkd.supabase.co'
export const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlscnB2a3hhZ3V0am1ibWVzcWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MDk4NjcsImV4cCI6MjExMDI4NTg2N30.NNN4Z-I10WScI5T-Eg2CXRWedxt5PyPNllmB0i_iYI8'
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
export const BUCKET = 'closet-photos'
const RPC_TIMEOUT_MS = 10_000

// Calls a muse_* RPC. Fails fast with a 504 instead of hanging when the database doesn't answer.
export async function rpc(fn: string, payload: Record<string, unknown>) {
  let response: Response
  let body: string
  try {
    response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    })
    body = await response.text()
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    throw new FetchError(timedOut ? 'Closet database timed out; try again shortly' : 'Couldn’t reach the closet database', timedOut ? 504 : 502)
  }
  if (!response.ok) {
    const message = /unauthorized/.test(body)
      ? 'Unauthorized'
      : /item not found/.test(body)
        ? 'Item not found'
        : /invalid day/.test(body)
          ? 'day must be YYYY-MM-DD and not in the future'
          : `Supabase: ${body}`
    const status = message === 'Unauthorized' ? 401 : message === 'Item not found' ? 404 : body.includes('invalid day') ? 400 : 502
    throw new FetchError(message, status)
  }
  return JSON.parse(body)
}
