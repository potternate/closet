import { FetchError } from './_lib/fetchSafe.js'
import { rpc, SERVICE_KEY } from './_lib/supabase.js'

// GET /api/health -> 200 { ok: true, ... } when the item API can reach the database, else 503.
// No auth needed: it sends a dummy token, and a prompt "Unauthorized" proves the database answered.
export async function GET() {
  const started = Date.now()
  let database: 'up' | 'down' | 'timeout' = 'up'
  let error: string | undefined
  try {
    await rpc('muse_whoami', { tok: 'health-check' })
  } catch (caught) {
    if (!(caught instanceof FetchError && caught.status === 401)) {
      database = caught instanceof FetchError && caught.status === 504 ? 'timeout' : 'down'
      error = caught instanceof Error ? caught.message : String(caught)
    }
  }
  const ok = database === 'up'
  return Response.json(
    { ok, database, latencyMs: Date.now() - started, photoUploads: Boolean(SERVICE_KEY), ...(error && { error }), checkedAt: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  )
}
