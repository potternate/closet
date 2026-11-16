import { errorResponse, FetchError, fetchPublic, parseUrl } from './_lib/fetchSafe.js'

// Agent-facing item API. Auth: `Authorization: Bearer <muse token>` — the token
// lives in Supabase (`muse_config`) and is checked by the muse_* RPC functions,
// so this endpoint needs no secrets of its own: the anon key below is public.
// GET    /api/items           -> { items: [{ id, ...fields }] }
// POST   /api/items           -> create. Body: item fields (name required) + optional `imageUrl`.
// PATCH  /api/items           -> update. Body: { id, ...fields } merged into the item.
// DELETE /api/items?id=...    -> tombstone so the item deletes on every synced device.
// Image upload additionally needs SUPABASE_SERVICE_ROLE_KEY set on Vercel.

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://ilrpvkxagutjmbmesqkd.supabase.co'
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlscnB2a3hhZ3V0am1ibWVzcWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MDk4NjcsImV4cCI6MjExMDI4NTg2N30.NNN4Z-I10WScI5T-Eg2CXRWedxt5PyPNllmB0i_iYI8'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const BUCKET = 'closet-photos'

const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Bags', 'Accessories', 'Activewear', 'Other']
const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter']

function token(request: Request) {
  const tok = request.headers.get('authorization')?.replace(/^Bearer /i, '') ?? ''
  if (!tok) throw new FetchError('Missing Authorization: Bearer <token>', 401)
  return tok
}

async function rpc(fn: string, payload: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.text()
  if (!response.ok) {
    const message = /unauthorized/.test(body)
      ? 'Unauthorized'
      : /item not found/.test(body)
        ? 'Item not found'
        : `Supabase: ${body}`
    const status = message === 'Unauthorized' ? 401 : message === 'Item not found' ? 404 : 502
    throw new FetchError(message, status)
  }
  return JSON.parse(body)
}

function checkId(id: unknown): string {
  if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) throw new FetchError('Missing or invalid item id', 400)
  return id
}

function isStringList(value: unknown, allowed?: readonly string[]) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && (!allowed || allowed.includes(entry)))
}

function checkDraft(body: Record<string, unknown>) {
  const draft: Record<string, unknown> = {}
  const strings = ['name', 'color', 'brand', 'size', 'currency', 'url', 'notes'] as const
  for (const key of strings) {
    if (body[key] === undefined) continue
    if (typeof body[key] !== 'string') throw new FetchError(`${key} must be a string`, 400)
    draft[key] = body[key]
  }
  if (body.category !== undefined) {
    if (typeof body.category !== 'string' || !CATEGORIES.includes(body.category)) {
      throw new FetchError(`category must be one of: ${CATEGORIES.join(', ')}`, 400)
    }
    draft.category = body.category
  }
  if (body.seasons !== undefined) {
    if (!isStringList(body.seasons, SEASONS)) throw new FetchError(`seasons must be a list of: ${SEASONS.join(', ')}`, 400)
    draft.seasons = body.seasons
  }
  if (body.wears !== undefined) {
    if (!isStringList(body.wears)) throw new FetchError('wears must be a list of date strings', 400)
    draft.wears = body.wears
  }
  if (body.wishlist !== undefined) {
    if (typeof body.wishlist !== 'boolean') throw new FetchError('wishlist must be a boolean', 400)
    draft.wishlist = body.wishlist
  }
  if (body.price !== undefined) {
    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 0) throw new FetchError('price must be a non-negative number', 400)
    draft.price = price
  }
  return draft
}

async function uploadImage(imageId: string, rawUrl: string, userId: string) {
  if (!SERVICE_KEY) throw new FetchError('imageUrl needs SUPABASE_SERVICE_ROLE_KEY configured; omit it for now', 422)
  const url = parseUrl(rawUrl)
  const { body, contentType } = await fetchPublic(url, 'image/png,image/jpeg', 8 * 1024 * 1024)
  const type = contentType.includes('png') ? 'image/png' : 'image/jpeg'
  const path = `${userId}/${imageId}.${type === 'image/png' ? 'png' : 'jpg'}`
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': type, 'x-upsert': 'true' },
    body,
  })
  if (!response.ok) throw new FetchError(`Photo upload: ${await response.text()}`, 502)
  return { id: imageId, type, path, storagePath: path }
}

async function deleteImage(storagePath: string) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
  }).catch(() => undefined)
}

export async function GET(request: Request) {
  try {
    const items = await rpc('muse_list', { tok: token(request) })
    return Response.json({ items })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const tok = token(request)
    const body = (await request.json()) as Record<string, unknown>
    const draft = checkDraft(body)
    if (typeof draft.name !== 'string' || !draft.name.trim()) throw new FetchError('name is required', 400)
    draft.category ??= 'Tops'
    draft.seasons ??= []
    const id = crypto.randomUUID()
    const now = Date.now()
    let uploaded: string | undefined
    let image: Record<string, unknown> | undefined
    if (typeof body.imageUrl === 'string' && body.imageUrl) {
      const uploaded_image = await uploadImage(crypto.randomUUID(), body.imageUrl, await rpc('muse_whoami', { tok }))
      image = { id: uploaded_image.id, type: uploaded_image.type, path: uploaded_image.path }
      uploaded = uploaded_image.storagePath
    }
    const data = { ...draft, id, image, createdAt: now, updatedAt: now }
    try {
      return Response.json({ item: await rpc('muse_create', { tok, item: data }) }, { status: 201 })
    } catch (error) {
      // Only clean up on a definitive rejection — a lost response can still mean the write committed.
      if (uploaded && error instanceof FetchError && error.status < 500) await deleteImage(uploaded)
      throw error
    }
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const tok = token(request)
    const body = (await request.json()) as Record<string, unknown>
    const id = checkId(body.id)
    const patch = checkDraft(body)
    let uploaded: string | undefined
    if (typeof body.imageUrl === 'string' && body.imageUrl) {
      const image = await uploadImage(crypto.randomUUID(), body.imageUrl, await rpc('muse_whoami', { tok }))
      patch.image = { id: image.id, type: image.type, path: image.path }
      uploaded = image.storagePath
    }
    try {
      return Response.json({ item: await rpc('muse_update', { tok, item_id: id, patch }) })
    } catch (error) {
      if (uploaded && error instanceof FetchError && error.status < 500) await deleteImage(uploaded)
      throw error
    }
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const tok = token(request)
    const id = checkId(new URL(request.url).searchParams.get('id'))
    return Response.json(await rpc('muse_delete', { tok, item_id: id }))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  // Log wears: PUT { ids: ["...", ...], day: "YYYY-MM-DD" } — idempotent per day.
  try {
    const tok = token(request)
    const body = (await request.json()) as Record<string, unknown>
    if (!Array.isArray(body.ids) || !body.ids.every((id) => typeof id === 'string')) {
      throw new FetchError('ids must be an array of item ids', 400)
    }
    const day = typeof body.day === 'string' && body.day ? body.day : new Date().toISOString().slice(0, 10)
    return Response.json({ worn: await rpc('muse_wear', { tok, item_ids: body.ids, day }) })
  } catch (error) {
    return errorResponse(error)
  }
}
