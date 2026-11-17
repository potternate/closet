import { errorResponse, FetchError, fetchPublic, parseUrl } from './_lib/fetchSafe.js'
import { BUCKET, rpc, SERVICE_KEY, SUPABASE_URL, token } from './_lib/supabase.js'
import { lookupProduct } from './product.js'

// Fills price, currency and brand from the product page when the caller left them out. Gives up after 8s.
async function fillFromLink(draft: Record<string, unknown>) {
  if (typeof draft.url !== 'string' || (draft.price !== undefined && draft.brand)) return
  const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 8000))
  const product = await Promise.race([lookupProduct(draft.url).catch(() => undefined), timeout])
  if (!product) return
  if (draft.price === undefined && product.price !== undefined) {
    draft.price = product.price
    // The page's currency is the one that price is in, whatever the caller assumed.
    if (product.currency) draft.currency = product.currency
  }
  if (!draft.brand && product.brand) draft.brand = product.brand
}

// Fields an owned item should have so shopping can rely on it; the muse should ask Nate for these.
const missingFields = (item: Record<string, unknown>) =>
  item.wishlist ? [] : (['size', 'price', 'brand'] as const).filter((key) => item[key] === undefined || item[key] === null || item[key] === '')

// Agent-facing item API. Auth: `Authorization: Bearer <muse token>` — the token
// lives in Supabase (`muse_config`) and is checked by the muse_* RPC functions,
// so this endpoint needs no secrets of its own: the anon key below is public.
// GET    /api/items           -> { items: [{ id, ...fields }] } (archived items only with ?archived=true|all)
// POST   /api/items           -> create. Body: item fields (name required) + optional `imageUrl` (cover) and
//                                 `imageUrls` (more shots; the first becomes the cover when `imageUrl` is absent).
// PATCH  /api/items           -> update. Body: { id, ...fields } merged into the item. `imageUrl` replaces the
//                                 cover; `imageUrls` appends extra shots.
// DELETE /api/items?id=...    -> tombstone so the item deletes on every synced device.
// Image upload additionally needs SUPABASE_SERVICE_ROLE_KEY set on Vercel. Deletes also remove the item's stored photos.

const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Bags', 'Accessories', 'Activewear', 'Other']
const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter']
const PATTERNS = ['Solid', 'Striped', 'Plaid', 'Check', 'Graphic', 'Print', 'Floral', 'Camo', 'Colorblock', 'Textured', 'Other']
const FORMALITIES = ['Casual', 'Smart casual', 'Business', 'Formal']
const FITS = ['Slim', 'Regular', 'Relaxed', 'Oversized']
const STYLES = ['Streetwear', 'Minimal', 'Classic', 'Outdoor', 'Workwear', 'Athletic', 'Techwear', 'Preppy', 'Vintage', 'Statement']
const ARCHIVE_REASONS = ['Sold', 'Donated', 'Gave away', 'Lost', 'Worn out', 'Returned', 'Other']
const COLORS = ['Black', 'White', 'Gray', 'Beige', 'Brown', 'Red', 'Burgundy', 'Pink', 'Orange', 'Yellow', 'Green', 'Olive', 'Blue', 'Navy', 'Purple', 'Multi']

const colorName = (value: unknown) => COLORS.find((name) => typeof value === 'string' && name.toLowerCase() === value.trim().toLowerCase())
const colorsOf = (item: Record<string, unknown>) =>
  (Array.isArray(item.colors) && item.colors[0] === (item.color ?? undefined) ? item.colors : item.color ? [item.color] : []) as unknown[]

function checkId(id: unknown): string {
  if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) throw new FetchError('Missing or invalid item id', 400)
  return id
}

const isDay = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).getUTCDate() === Number(value.slice(8))

const pick = (allowed: readonly string[], value: unknown) =>
  allowed.find((name) => typeof value === 'string' && name.toLowerCase() === value.trim().toLowerCase())

function isStringList(value: unknown, allowed?: readonly string[]) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && (!allowed || allowed.includes(entry)))
}

function checkDraft(body: Record<string, unknown>) {
  const draft: Record<string, unknown> = {}
  const strings = ['name', 'brand', 'size', 'currency', 'url', 'notes'] as const
  for (const key of strings) {
    if (body[key] === undefined) continue
    if (typeof body[key] !== 'string') throw new FetchError(`${key} must be a string`, 400)
    draft[key] = body[key]
  }
  for (const key of ['subtype', 'material'] as const) {
    if (body[key] === undefined) continue
    if (body[key] !== null && typeof body[key] !== 'string') throw new FetchError(`${key} must be a string or null`, 400)
    draft[key] = (body[key] as string | null)?.trim() || null
  }
  for (const [key, allowed] of [['pattern', PATTERNS], ['formality', FORMALITIES], ['fit', FITS]] as const) {
    if (body[key] === undefined) continue
    const value = body[key] === null ? null : pick(allowed, body[key])
    if (value === undefined) throw new FetchError(`${key} must be null or one of: ${allowed.join(', ')}`, 400)
    draft[key] = value
  }
  if (body.styles !== undefined) {
    const styles = body.styles === null ? [] : Array.isArray(body.styles) ? body.styles.map((style) => pick(STYLES, style)) : [undefined]
    if (styles.includes(undefined)) throw new FetchError(`styles must be null or a list of: ${STYLES.join(', ')}`, 400)
    draft.styles = [...new Set(styles)]
  }
  // `colors` is the full list (first = primary); `color` alone sets a single color.
  const colors = body.colors !== undefined ? body.colors : body.color !== undefined ? [body.color] : undefined
  if (colors !== undefined) {
    const names = Array.isArray(colors) ? colors.map(colorName) : [undefined]
    if (names.includes(undefined)) throw new FetchError(`colors must be from: ${COLORS.join(', ')}`, 400)
    draft.colors = [...new Set(names)]
    draft.color = names[0] ?? null
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
  // `archived: true` archives as of today, a YYYY-MM-DD date archives as of that day, false/null restores.
  if (body.archived !== undefined) {
    const day = body.archived === true ? new Date().toISOString().slice(0, 10) : body.archived
    if (day !== false && day !== null && !isDay(day)) {
      throw new FetchError('archived must be true, false, null or YYYY-MM-DD', 400)
    }
    draft.archived = day || null
    if (!day) draft.archiveReason = null
  }
  if (body.archiveReason !== undefined && draft.archived !== null) {
    if (body.archiveReason !== null && (typeof body.archiveReason !== 'string' || !ARCHIVE_REASONS.includes(body.archiveReason))) {
      throw new FetchError(`archiveReason must be one of: ${ARCHIVE_REASONS.join(', ')}`, 400)
    }
    draft.archiveReason = body.archiveReason
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

const MAX_PHOTOS = 8

function imageUrlsOf(body: Record<string, unknown>) {
  if (body.imageUrl !== undefined && typeof body.imageUrl !== 'string') throw new FetchError('imageUrl must be a string', 400)
  if (body.imageUrls !== undefined && !isStringList(body.imageUrls)) throw new FetchError('imageUrls must be a list of URLs', 400)
  const extra = ((body.imageUrls as string[] | undefined) ?? []).filter(Boolean)
  const cover = (body.imageUrl as string | undefined) || undefined
  if (extra.length + (cover ? 1 : 0) > MAX_PHOTOS) throw new FetchError(`An item holds at most ${MAX_PHOTOS} photos`, 400)
  return { cover, extra }
}

type Photo = { id: string; type: string; path: string }

// Uploads every URL or none: a failed download removes the photos already stored for this request.
async function uploadImages(urls: string[], userId: string) {
  const photos: Photo[] = []
  try {
    for (const url of urls) {
      const { storagePath: _path, ...photo } = await uploadImage(crypto.randomUUID(), url, userId)
      photos.push(photo)
    }
  } catch (error) {
    await deleteImages(photos, userId)
    throw error
  }
  return photos
}

// Only files under the caller's own folder are deleted, whatever path an item claims to hold.
async function deleteImages(photos: Photo[], userId: string) {
  if (!SERVICE_KEY) return
  const own = (path: string) => path.startsWith(`${userId}/`) && !path.includes('..')
  await Promise.all(photos.filter((photo) => photo?.path && own(photo.path)).map((photo) => deleteImage(photo.path)))
}

const storedPhotos = (item: Record<string, unknown>) =>
  [item.image, ...(Array.isArray(item.photos) ? item.photos : [])].filter((photo): photo is Photo => Boolean((photo as Photo | undefined)?.path))

async function findItem(tok: string, id: string) {
  const items = ((await rpc('muse_list', { tok })) ?? []) as Record<string, unknown>[]
  return items.find((item) => typeof item.id === 'string' && item.id.toLowerCase() === id.toLowerCase())
}

async function deleteImage(storagePath: string) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
  }).catch(() => undefined)
}

// GET filters: ?q=words&category=Shoes&color=Black&brand=nike&wishlist=true|false&archived=false|true|all&missing=size|price|brand
function filterItems(items: Record<string, unknown>[], params: URLSearchParams) {
  const text = (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : '')
  const loose = (value: unknown) => text(value).replace(/['’`.]/g, '')
  const term = (value: string) => loose(value) || value
  const words = text(params.get('q')).split(/\s+/).filter(Boolean).map(term)
  const category = text(params.get('category'))
  const color = text(params.get('color'))
  const brand = term(text(params.get('brand')))
  const wishlist = params.get('wishlist')?.toLowerCase()
  if (wishlist !== undefined && wishlist !== 'true' && wishlist !== 'false') {
    throw new FetchError('wishlist must be true or false', 400)
  }
  const archived = params.get('archived')?.toLowerCase() ?? 'false'
  if (!['true', 'false', 'all'].includes(archived)) throw new FetchError('archived must be true, false or all', 400)
  const missing = params.get('missing')?.toLowerCase()
  if (missing && !['size', 'price', 'brand'].includes(missing)) throw new FetchError('missing must be size, price or brand', 400)
  return items.filter((item) => {
    if (category && text(item.category) !== category) return false
    if (color && !colorsOf(item).some((name) => text(name) === color)) return false
    if (brand && !loose(item.brand).includes(brand)) return false
    if (wishlist === 'true' && item.wishlist !== true) return false
    if (wishlist === 'false' && item.wishlist === true) return false
    if (archived !== 'all' && Boolean(item.archived) !== (archived === 'true')) return false
    if (missing && !missingFields(item).includes(missing as 'size')) return false
    const haystack = [...['name', 'brand', 'category', 'subtype', 'material', 'pattern', 'formality', 'fit', 'size', 'notes'].map((key) => item[key]), ...colorsOf(item), ...(Array.isArray(item.styles) ? item.styles : [])].map(loose).join(' ')
    return words.every((word) => haystack.includes(word))
  })
}

export async function GET(request: Request) {
  try {
    const items = (await rpc('muse_list', { tok: token(request) })) as Record<string, unknown>[] | null
    const withLastWorn = (items ?? []).map((item) => {
      const wears = Array.isArray(item.wears) ? (item.wears as string[]) : []
      return wears.length ? { ...item, lastWorn: [...wears].sort().at(-1) } : item
    })
    return Response.json({ items: filterItems(withLastWorn, new URL(request.url).searchParams) })
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
    await fillFromLink(draft)
    const id = crypto.randomUUID()
    const now = Date.now()
    const { cover, extra } = imageUrlsOf(body)
    const urls = cover ? [cover, ...extra] : extra
    const userId = urls.length ? ((await rpc('muse_whoami', { tok })) as string) : ''
    const uploaded = userId ? await uploadImages(urls, userId) : []
    const data = { ...draft, id, image: uploaded[0], photos: uploaded.length > 1 ? uploaded.slice(1) : undefined, createdAt: now, updatedAt: now }
    try {
      const item = (await rpc('muse_create', { tok, item: data })) as Record<string, unknown>
      return Response.json({ item, missing: missingFields(item) }, { status: 201 })
    } catch (error) {
      // Only clean up on a definitive rejection — a lost response can still mean the write committed.
      if (error instanceof FetchError && error.status < 500) await deleteImages(uploaded, userId)
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
    const { cover, extra } = imageUrlsOf(body)
    const current = cover || extra.length ? await findItem(tok, id) : undefined
    if ((cover || extra.length) && !current) throw new FetchError('Item not found', 404)
    if (current && extra.length) {
      const kept = (Array.isArray(current.photos) ? current.photos.length : 0) + (cover || current.image ? 1 : 0)
      if (kept + extra.length > MAX_PHOTOS) throw new FetchError(`An item holds at most ${MAX_PHOTOS} photos`, 400)
    }
    const userId = cover || extra.length ? ((await rpc('muse_whoami', { tok })) as string) : ''
    const uploaded = userId ? await uploadImages(cover ? [cover, ...extra] : extra, userId) : []
    if (cover) patch.image = uploaded[0]
    if (current && extra.length) {
      // Extra shots append after the existing ones; an item with no cover gets the first one as its cover.
      // Only touch `image` when it was empty, so a concurrent cover replacement isn't written back over.
      const added = [...(Array.isArray(current.photos) ? current.photos : []), ...uploaded.slice(patch.image ? 1 : 0)]
      if (!patch.image && !current.image) patch.image = added.shift()
      patch.photos = added
    }
    let item: Record<string, unknown>
    try {
      item = await rpc('muse_update', { tok, item_id: id, patch })
    } catch (error) {
      if (error instanceof FetchError && error.status < 500) await deleteImages(uploaded, userId)
      throw error
    }
    // A replaced cover is no longer referenced anywhere, so its file goes too.
    const oldCover = cover && current ? storedPhotos({ image: current.image })[0] : undefined
    if (oldCover && !storedPhotos(item).some((photo) => photo.path === oldCover.path)) await deleteImages([oldCover], userId)
    return Response.json({ item, missing: missingFields(item) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const tok = token(request)
    const id = checkId(new URL(request.url).searchParams.get('id'))
    const [current, userId] = await Promise.all([findItem(tok, id), rpc('muse_whoami', { tok }) as Promise<string>])
    const deleted = await rpc('muse_delete', { tok, item_id: id })
    if (current) await deleteImages(storedPhotos(current), userId)
    return Response.json(deleted)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  // Log wears: PUT { ids: ["...", ...], day: "YYYY-MM-DD", occasion?, note? } — idempotent per day.
  try {
    const tok = token(request)
    const body = (await request.json()) as Record<string, unknown>
    if (!Array.isArray(body.ids) || !body.ids.every((id) => typeof id === 'string')) {
      throw new FetchError('ids must be an array of item ids', 400)
    }
    const day = body.day === undefined ? new Date().toISOString().slice(0, 10) : body.day
    if (typeof day !== 'string') throw new FetchError('day must be YYYY-MM-DD', 400)
    const text = (field: 'occasion' | 'note', max: number) => {
      const value = body[field]
      if (value === undefined || value === null) return null
      if (typeof value !== 'string' || value.length > max) throw new FetchError(`${field} must be text up to ${max} characters`, 400)
      return value
    }
    const occasion = text('occasion', 40)
    const note = text('note', 200)
    return Response.json({ worn: await rpc('muse_wear', { tok, item_ids: body.ids, day, ...(occasion && { occasion }), ...(note && { note }) }) })
  } catch (error) {
    return errorResponse(error)
  }
}
