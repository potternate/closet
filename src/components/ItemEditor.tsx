import { useEffect, useRef, useState } from 'react'
import { cutOut, dominantColor, prepareImage, type PreparedImage } from '../lib/images'
import { fetchProductImage, proxiedImage } from '../lib/productImport'
import { imageBlob, type PhotoInput } from '../lib/store'
import { CATEGORIES, itemColors, itemPhotos, SEASONS, withColors, type Draft, type Item, type ItemPhoto } from '../lib/types'
import { ColorPicker, Chip } from './Chips'
import { ItemImage } from './ItemImage'
import { PhotosIcon, SparkleIcon } from './icons'

export interface EditorSource {
  draft: Draft
  file?: Blob
  imageUrls?: string[]
  autoCutOut?: boolean
  existing?: Item
}

interface Props {
  source: EditorSource
  onSave: (draft: Draft, photos: PhotoInput[] | undefined, existing?: Item) => Promise<unknown>
  saveLabel?: string
  onCancel: () => void
}

// One photo in the editor: either already saved on the item, or freshly prepared here.
interface Slot {
  key: string
  saved?: ItemPhoto
  image?: PreparedImage
  original?: PreparedImage
  url?: string
  loading?: boolean
}

const inputClass =
  'mt-1.5 w-full rounded-xl bg-stone-50 px-3.5 py-2.5 text-base text-stone-900 ring-1 ring-stone-200 outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-stone-900'

const toolClass =
  'flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-100 py-2.5 text-sm font-semibold text-stone-700 active:bg-stone-200 disabled:opacity-50'

const MAX_PHOTOS = 8

function useBlobUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

function SlotImage({ slot, item, className, dim }: { slot: Slot; item?: Item; className: string; dim?: boolean }) {
  const url = useBlobUrl(slot.image?.blob)
  if (slot.image) {
    if (!url) return null
    const cut = slot.image.type === 'image/png'
    return (
      <img
        src={url}
        alt=""
        className={`object-contain transition ${cut ? 'drop-shadow-[0_6px_10px_rgba(0,0,0,0.12)]' : 'mix-blend-multiply'} ${dim ? 'opacity-50 blur-[1px]' : ''} ${className}`}
      />
    )
  }
  if (slot.saved && item) return <ItemImage item={item} photo={slot.saved} className={className} />
  return null
}

export function ItemEditor({ source, onSave, onCancel, saveLabel = 'Add to closet' }: Props) {
  const [draft, setDraft] = useState<Draft>(source.draft)
  const [slots, setSlots] = useState<Slot[]>(() => {
    if (source.file || source.imageUrls?.length) return [{ key: crypto.randomUUID(), loading: true }]
    return source.existing ? itemPhotos(source.existing).map((saved) => ({ key: saved.id, saved })) : []
  })
  const [activeKey, setActiveKey] = useState(slots[0]?.key)
  const [imageError, setImageError] = useState<string>()
  const [cuts, setCuts] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [priceText, setPriceText] = useState(source.draft.price?.toString() ?? '')
  const colorTouched = useRef(itemColors(source.draft).length > 0)
  const fileInput = useRef<HTMLInputElement>(null)
  const fileMode = useRef<'replace' | 'add'>('add')
  const runIds = useRef(new Map<string, number>())
  const cutQueue = useRef<Promise<unknown>>(Promise.resolve())
  const slotsRef = useRef(slots)

  useEffect(() => {
    slotsRef.current = slots
  }, [slots])

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))
  const patchSlot = (key: string, patch: Partial<Slot>) =>
    setSlots((current) => current.map((slot) => (slot.key === key ? { ...slot, ...patch } : slot)))
  const dropSlot = (key: string) => {
    runIds.current.delete(key)
    const current = slotsRef.current
    const next = current.filter((slot) => slot.key !== key)
    const fallback = next[Math.max(0, current.findIndex((slot) => slot.key === key) - 1)]?.key
    setSlots((all) => all.filter((slot) => slot.key !== key))
    setActiveKey((activeKey) => (activeKey === key ? fallback : activeKey))
  }
  const isCover = (key: string) => slotsRef.current[0]?.key === key

  const autoColor = async (key: string, blob: Blob) => {
    if (colorTouched.current || !isCover(key)) return
    const color = await dominantColor(blob)
    if (!colorTouched.current && color) update(withColors([color]))
  }

  // Cut-outs run one at a time so several new photos don't load the model in parallel.
  const runCutOut = (key: string, input: PreparedImage) => {
    const id = (runIds.current.get(key) ?? 0) + 1
    runIds.current.set(key, id)
    const current = () => runIds.current.get(key) === id
    setCuts((all) => ({ ...all, [key]: 0 }))
    const done = () =>
      setCuts((all) => {
        const { [key]: _done, ...rest } = all
        return rest
      })
    cutQueue.current = cutQueue.current.then(async () => {
      if (!current()) return done()
      try {
        const result = await cutOut(input.blob, (progress) => current() && setCuts((all) => ({ ...all, [key]: progress })))
        if (!current()) return
        patchSlot(key, { image: result, saved: undefined })
        await autoColor(key, result.blob)
      } catch (error) {
        if (current()) setImageError(error instanceof Error ? error.message : 'Couldn’t remove the background')
      } finally {
        done()
      }
    })
  }

  const loadBlob = async (key: string, blob: Blob, autoCut: boolean) => {
    runIds.current.set(key, (runIds.current.get(key) ?? 0) + 1)
    patchSlot(key, { loading: true })
    setImageError(undefined)
    try {
      const prepared = await prepareImage(blob)
      patchSlot(key, { image: prepared, original: prepared, saved: undefined, loading: false })
      await autoColor(key, prepared.blob)
      if (autoCut) runCutOut(key, prepared)
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Couldn’t load that image')
      dropSlot(key)
    }
  }

  const loadUrl = async (key: string, url: string) => {
    patchSlot(key, { loading: true, url })
    setImageError(undefined)
    try {
      await loadBlob(key, await fetchProductImage(url), false)
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Couldn’t load that image')
      dropSlot(key)
    }
  }

  const addSlot = (patch: Partial<Slot> = {}) => {
    const key = crypto.randomUUID()
    setSlots((current) => [...current, { key, loading: true, ...patch }])
    setActiveKey(key)
    return key
  }

  useEffect(() => {
    const key = slots[0]?.key
    if (!key) return
    if (source.file) void loadBlob(key, source.file, source.autoCutOut ?? true)
    else if (source.imageUrls?.[0]) void loadUrl(key, source.imageUrls[0])
    // Runs once for the initial source.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = slots.find((slot) => slot.key === activeKey)
  const activeType = active?.image?.type ?? active?.saved?.type
  const isCutOut = activeType === 'image/png'
  const activeProgress = active ? cuts[active.key] : undefined
  const working = activeProgress !== undefined
  const busy = slots.some((slot) => slot.loading) || Object.keys(cuts).length > 0
  const photos = slots.flatMap((slot): PhotoInput[] => (slot.image ? [slot.image] : slot.saved ? [slot.saved] : []))
  const canSave = !saving && !busy && (photos.length > 0 || Boolean(draft.name.trim()))
  const full = slots.length >= MAX_PHOTOS

  const toggleBackground = async (slot: Slot) => {
    if (isCutOut && slot.original) {
      runIds.current.set(slot.key, (runIds.current.get(slot.key) ?? 0) + 1)
      patchSlot(slot.key, { image: slot.original, saved: undefined })
      return
    }
    let original = slot.original
    if (!original && slot.saved) {
      const blob = await imageBlob(slot.saved)
      if (!blob) return setImageError('Couldn’t load that photo')
      original = { blob, type: slot.saved.type }
      patchSlot(slot.key, { original })
    }
    if (original) runCutOut(slot.key, original)
  }

  const save = async () => {
    setSaving(true)
    try {
      await onSave(draft, photos, source.existing)
    } finally {
      setSaving(false)
    }
  }

  const pickFile = (mode: 'replace' | 'add') => {
    fileMode.current = mode
    fileInput.current?.click()
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave) void save()
      }}
    >
      <div className="flex items-center justify-between">
        <button type="button" onClick={onCancel} className="py-1 text-sm font-semibold text-stone-500">
          Cancel
        </button>
        <h2 className="text-base font-bold text-stone-900">{source.existing ? 'Edit item' : 'New item'}</h2>
        <button type="submit" disabled={!canSave} className="rounded-full bg-stone-900 px-4 py-1.5 text-sm font-semibold text-stone-50 disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="relative mt-4 grid aspect-square w-full place-items-center overflow-hidden rounded-3xl bg-stone-100">
        {active?.loading ? (
          <div className="text-sm font-medium text-stone-400">Loading photo…</div>
        ) : active ? (
          <SlotImage slot={active} item={source.existing} dim={working} className="absolute inset-0 h-full w-full p-4" />
        ) : (
          <button type="button" onClick={() => pickFile('add')} className="flex flex-col items-center gap-2 text-stone-400">
            <PhotosIcon className="h-8 w-8" />
            <span className="text-sm font-semibold">Add a photo</span>
          </button>
        )}
        {working && (
          <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-surface/90 p-3 text-center shadow-lg backdrop-blur">
            <div className="text-sm font-semibold text-stone-800">Removing background…</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full rounded-full bg-stone-900 transition-all" style={{ width: `${Math.max(8, Math.round(activeProgress * 100))}%` }} />
            </div>
            {activeProgress < 1 && <div className="mt-1.5 text-xs text-stone-500">First time takes a bit longer</div>}
          </div>
        )}
      </div>

      {slots.length > 0 && (
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
          {slots.map((slot, index) => (
            <button
              key={slot.key}
              type="button"
              onClick={() => setActiveKey(slot.key)}
              aria-label={index === 0 ? 'Cover photo' : `Photo ${index + 1}`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100 ring-2 ${slot.key === activeKey ? 'ring-stone-900' : 'ring-transparent'}`}
            >
              {slot.loading ? <div className="h-full w-full animate-pulse" /> : <SlotImage slot={slot} item={source.existing} className="h-full w-full p-1" />}
              {index === 0 && slots.length > 1 && (
                <span className="absolute inset-x-0 bottom-0 bg-stone-900/70 text-[10px] font-semibold text-stone-50">Cover</span>
              )}
              {cuts[slot.key] !== undefined && <span className="absolute inset-0 animate-pulse bg-surface/50" />}
            </button>
          ))}
          {!full && (
            <button
              type="button"
              onClick={() => pickFile('add')}
              aria-label="Add another photo"
              className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-stone-100 text-2xl font-light text-stone-400 active:bg-stone-200"
            >
              +
            </button>
          )}
        </div>
      )}

      {source.imageUrls && source.imageUrls.length > 1 && (
        <>
          <div className="mt-4 text-xs font-semibold text-stone-500">Product shots · tap to use, + to add another</div>
          <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1">
            {source.imageUrls.map((url) => {
              const used = slots.find((slot) => slot.url === url)
              return (
                <div key={url} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => (used ? setActiveKey(used.key) : active ? void loadUrl(active.key, url) : void loadUrl(addSlot(), url))}
                    className={`h-16 w-16 overflow-hidden rounded-xl bg-stone-100 ring-2 ${used ? 'ring-stone-900' : 'ring-transparent'}`}
                  >
                    <img src={proxiedImage(url)} alt="" className="h-full w-full object-cover mix-blend-multiply" loading="lazy" />
                  </button>
                  {!used && !full && (
                    <button
                      type="button"
                      onClick={() => void loadUrl(addSlot({ url }), url)}
                      aria-label="Add as another photo"
                      className="absolute -top-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full bg-stone-900 text-sm font-semibold text-stone-50 shadow"
                    >
                      +
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {imageError && <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{imageError}</p>}

      <div className="mt-3 flex gap-2">
        {active && !active.loading && (active.original || !isCutOut) && (
          <button type="button" disabled={working} onClick={() => void toggleBackground(active)} className={toolClass}>
            <SparkleIcon className="h-4 w-4" />
            {isCutOut ? 'Restore background' : 'Remove background'}
          </button>
        )}
        <button type="button" onClick={() => pickFile(active ? 'replace' : 'add')} className={toolClass}>
          <PhotosIcon className="h-4 w-4" />
          {active ? 'Replace photo' : 'Add photo'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])]
            event.target.value = ''
            if (!files.length) return
            if (fileMode.current === 'replace' && active) {
              void loadBlob(active.key, files[0], true)
              files.shift()
            }
            for (const file of files.slice(0, MAX_PHOTOS - slotsRef.current.length)) void loadBlob(addSlot(), file, true)
          }}
        />
      </div>
      {active && slots.length > 1 && (
        <div className="mt-2 flex gap-2">
          {slots[0].key !== active.key && (
            <button
              type="button"
              onClick={() => setSlots((current) => [active, ...current.filter((slot) => slot.key !== active.key)])}
              className={toolClass}
            >
              Make cover
            </button>
          )}
          <button type="button" disabled={working} onClick={() => dropSlot(active.key)} className={`${toolClass} text-rose-600`}>
            Remove photo
          </button>
        </div>
      )}

      <label className="mt-5 block text-sm font-semibold text-stone-700">
        Name
        <input className={inputClass} value={draft.name} onChange={(event) => update({ name: event.target.value })} placeholder="e.g. White linen shirt" />
      </label>

      <div className="mt-5 text-sm font-semibold text-stone-700">Category</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <Chip key={category} active={draft.category === category} onClick={() => update({ category })}>
            {category}
          </Chip>
        ))}
      </div>

      <div className="mt-5 text-sm font-semibold text-stone-700">
        Colors <span className="font-normal text-stone-400">· tap all that apply</span>
      </div>
      <div className="mt-2">
        <ColorPicker
          value={itemColors(draft)}
          onChange={(colors) => {
            colorTouched.current = true
            update(withColors(colors))
          }}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-stone-700">
          Brand
          <input className={inputClass} value={draft.brand ?? ''} onChange={(event) => update({ brand: event.target.value || undefined })} />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Size
          <input className={inputClass} value={draft.size ?? ''} onChange={(event) => update({ size: event.target.value || undefined })} />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Price
          <input
            className={inputClass}
            inputMode="decimal"
            value={priceText}
            onChange={(event) => {
              const value = event.target.value.replace(/[^\d.]/g, '')
              setPriceText(value)
              const price = parseFloat(value)
              update({ price: Number.isFinite(price) ? price : undefined })
            }}
          />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Link
          <input
            className={inputClass}
            type="url"
            inputMode="url"
            value={draft.url ?? ''}
            onChange={(event) => update({ url: event.target.value || undefined })}
            placeholder="https://"
          />
        </label>
      </div>

      <div className="mt-5 text-sm font-semibold text-stone-700">Seasons</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {SEASONS.map((season) => (
          <Chip
            key={season}
            active={draft.seasons.includes(season)}
            onClick={() =>
              update({ seasons: draft.seasons.includes(season) ? draft.seasons.filter((s) => s !== season) : [...draft.seasons, season] })
            }
          >
            {season}
          </Chip>
        ))}
      </div>

      <label className="mt-5 block text-sm font-semibold text-stone-700">
        Notes
        <textarea rows={2} className={inputClass} value={draft.notes ?? ''} onChange={(event) => update({ notes: event.target.value || undefined })} />
      </label>

      <button type="submit" disabled={!canSave} className="mt-6 w-full rounded-xl bg-stone-900 py-3.5 font-semibold text-stone-50 disabled:opacity-40">
        {saving ? 'Saving…' : working ? 'Removing background…' : source.existing ? 'Save changes' : saveLabel}
      </button>
    </form>
  )
}
