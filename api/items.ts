import { errorResponse, FetchError, fetchPublic, parseUrl } from './_lib/fetchSafe.js'

// Agent-facing item API. Auth: `Authorization: Bearer $MUSE_TOKEN`.
// GET    /api/items           -> { items: [{ id, ...data }] }
// POST   /api/items           -> create. Body: item fields (name required) + optional `imageUrl`.
// PATCH  /api/items           -> update. Body: { id, ...fields } (fields replace those in data).
// DELETE /api/items?id=...    -> tombstone the item so it deletes on every synced device.
//
// All writes go straight into public.closet_items for CLOSET_USER_ID via the service
// role, so RLS on the user-facing app is untouched and updated_at wins merges.

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://ilrpvkxagutjmbmesqkd.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const USER_ID = process.env.CLOSET_USER_ID ?? ''
const TOKEN = process.env.MUSE_TOKEN ?? ''
const BUCKET = 'closet-photos'

const headers = () => ({
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
  prefer: 'return=representation',
})

function authorize(request: Request) {
  if (!TOKEN || !SERVICE_KEY || !USER_ID) throw new FetchError('Items API is not configured', 503)
  if (request.headers.get('authorization') !== `Bearer ${TOKEN}`) throw new FetchError('Unauthorized', 401)
}

async function postgrest(path: string, init?: RequestInit) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) } })
  if (!response.ok) throw new FetchError(`Supabase: ${await response.text()}`, 502)
  const text = await response.text()
  return text ? JSON.parse(text) : undefined
}

function checkId(id: unknown): string {
  if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) throw new FetchError('Missing or invalid item id', 400)
  return id
}

function checkDraft(body: Record<string, unknown>) {
  const allowed = ['name', 'category', 'color', 'brand', 'size', 'price', 'currency', 'seasons', 'url', 'notes', 'wears', 'wishlist'] as const
  const draft: Record<string, unknown> = {}
  for (const key of allowed) if (body[key] !== undefined) draft[key] = body[key]
  if (body.price !== undefined) draft.price = Number(body.price)
  return draft
}

async function uploadImage(imageId: string, rawUrl: string) {
  const url = parseUrl(rawUrl)
  const { body, contentType } = await fetchPublic(url, 'image/png,image/jpeg', 8 * 1024 * 1024)
  const type = contentType.includes('png') ? 'image/png' : 'image/jpeg'
  const path = `${USER_ID}/${imageId}.${type === 'image/png' ? 'png' : 'jpg'}`
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': type, 'x-upsert': 'true' },
    body,
  })
  if (!response.ok) throw new FetchError(`Photo upload: ${await response.text()}`, 502)
  return { id: imageId, type, path }
}

async function getRow(id: string) {
  const rows = (await postgrest(`closet_items?user_id=eq.${USER_ID}&id=eq.${id}&select=data`)) as { data: Record<string, unknown> }[]
  return rows[0]?.data
}

async function upsert(id: string, data: Record<string, unknown>, deleted: boolean) {
  const now = new Date().toISOString()
  const rows = (await postgrest('closet_items', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: USER_ID, id, data, deleted, updated_at: now }),
  })) as { data: Record<string, unknown> }[]
  return rows[0]?.data ?? data
}

export async function GET(request: Request) {
  try {
    authorize(request)
    const rows = (await postgrest(`closet_items?user_id=eq.${USER_ID}&deleted=eq.false&select=id,data`)) as {
      id: string
      data: Record<string, unknown>
    }[]
    return Response.json({ items: rows.map((row) => ({ id: row.id, ...row.data })) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    authorize(request)
    const body = (await request.json()) as Record<string, unknown>
    const draft = checkDraft(body)
    if (typeof draft.name !== 'string' || !draft.name.trim()) throw new FetchError('name is required', 400)
    const id = crypto.randomUUID()
    const now = Date.now()
    const image = typeof body.imageUrl === 'string' && body.imageUrl ? await uploadImage(crypto.randomUUID(), body.imageUrl) : undefined
    const data = { ...draft, id, image, createdAt: now, updatedAt: now }
    return Response.json({ item: await upsert(id, data, false) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    authorize(request)
    const body = (await request.json()) as Record<string, unknown>
    const id = checkId(body.id)
    const existing = await getRow(id)
    if (!existing) throw new FetchError('Item not found', 404)
    const patch = checkDraft(body)
    const image = typeof body.imageUrl === 'string' && body.imageUrl ? await uploadImage(crypto.randomUUID(), body.imageUrl) : undefined
    const data = { ...existing, ...patch, ...(image ? { image } : {}), id, updatedAt: Date.now() }
    return Response.json({ item: await upsert(id, data, false) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    authorize(request)
    const id = checkId(new URL(request.url).searchParams.get('id'))
    const existing = (await getRow(id)) ?? { id }
    await postgrest('closet_items', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ user_id: USER_ID, id, data: existing, deleted: true, updated_at: new Date().toISOString() }),
    })
    return Response.json({ deleted: id })
  } catch (error) {
    return errorResponse(error)
  }
}
