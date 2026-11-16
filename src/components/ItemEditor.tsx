import { useEffect, useRef, useState } from 'react'
import { cutOut, dominantColor, prepareImage, type PreparedImage } from '../lib/images'
import { fetchProductImage, proxiedImage } from '../lib/productImport'
import { CATEGORIES, SEASONS, type Draft, type Item } from '../lib/types'
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
  onSave: (draft: Draft, image: PreparedImage | undefined, existing?: Item) => Promise<unknown>
  onCancel: () => void
}

type CutState = { status: 'idle' } | { status: 'working'; progress: number } | { status: 'error'; message: string }

const inputClass =
  'mt-1.5 w-full rounded-xl bg-stone-50 px-3.5 py-2.5 text-base text-stone-900 ring-1 ring-stone-200 outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-stone-900'

export function ItemEditor({ source, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Draft>(source.draft)
  const [original, setOriginal] = useState<PreparedImage>()
  const [image, setImage] = useState<PreparedImage>()
  const [preview, setPreview] = useState<string>()
  const [loadingImage, setLoadingImage] = useState(Boolean(source.file || source.imageUrls?.length))
  const [imageError, setImageError] = useState<string>()
  const [cut, setCut] = useState<CutState>({ status: 'idle' })
  const [pickedUrl, setPickedUrl] = useState(source.imageUrls?.[0])
  const [saving, setSaving] = useState(false)
  const [priceText, setPriceText] = useState(source.draft.price?.toString() ?? '')
  const colorTouched = useRef(Boolean(source.draft.color))
  const replaceInput = useRef<HTMLInputElement>(null)
  const runId = useRef(0)

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))

  useEffect(() => {
    if (!image) {
      setPreview(undefined)
      return
    }
    const url = URL.createObjectURL(image.blob)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  const runCutOut = async (input: PreparedImage) => {
    const id = ++runId.current
    setCut({ status: 'working', progress: 0 })
    try {
      const result = await cutOut(input.blob, (progress) => id === runId.current && setCut({ status: 'working', progress }))
      if (id !== runId.current) return
      setImage(result)
      setCut({ status: 'idle' })
      if (!colorTouched.current) {
        const color = await dominantColor(result.blob)
        if (!colorTouched.current && color) update({ color })
      }
    } catch (error) {
      if (id !== runId.current) return
      setCut({ status: 'error', message: error instanceof Error ? error.message : 'Couldn’t remove the background' })
    }
  }

  const loadBlob = async (blob: Blob, autoCut: boolean) => {
    runId.current++
    setLoadingImage(true)
    setImageError(undefined)
    setCut({ status: 'idle' })
    try {
      const prepared = await prepareImage(blob)
      setOriginal(prepared)
      setImage(prepared)
      if (!colorTouched.current) {
        const color = await dominantColor(prepared.blob)
        if (!colorTouched.current && color) update({ color })
      }
      if (autoCut) void runCutOut(prepared)
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Couldn’t load that image')
    } finally {
      setLoadingImage(false)
    }
  }

  const loadUrl = async (url: string) => {
    setPickedUrl(url)
    setLoadingImage(true)
    setImageError(undefined)
    try {
      await loadBlob(await fetchProductImage(url), false)
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Couldn’t load that image')
      setLoadingImage(false)
    }
  }

  useEffect(() => {
    if (source.file) void loadBlob(source.file, source.autoCutOut ?? true)
    else if (source.imageUrls?.[0]) void loadUrl(source.imageUrls[0])
    // Runs once for the initial source.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isCutOut = image?.type === 'image/png'
  const working = cut.status === 'working'
  const canSave = !saving && !loadingImage && !working && (Boolean(image) || Boolean(source.existing?.image) || Boolean(draft.name.trim()))

  const save = async () => {
    setSaving(true)
    try {
      await onSave(draft, image, source.existing)
    } finally {
      setSaving(false)
    }
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
        <button type="submit" disabled={!canSave} className="rounded-full bg-stone-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="relative mt-4 grid aspect-square w-full place-items-center overflow-hidden rounded-3xl bg-stone-100">
        {preview ? (
          <img
            src={preview}
            alt=""
            className={`absolute inset-0 h-full w-full object-contain p-4 transition ${isCutOut ? 'drop-shadow-[0_10px_16px_rgba(0,0,0,0.15)]' : 'mix-blend-multiply'} ${working ? 'opacity-50 blur-[1px]' : ''}`}
          />
        ) : source.existing && !loadingImage ? (
          <ItemImage item={source.existing} className="absolute inset-0 h-full w-full p-4" />
        ) : loadingImage ? (
          <div className="text-sm font-medium text-stone-400">Loading photo…</div>
        ) : (
          <button type="button" onClick={() => replaceInput.current?.click()} className="flex flex-col items-center gap-2 text-stone-400">
            <PhotosIcon className="h-8 w-8" />
            <span className="text-sm font-semibold">Add a photo</span>
          </button>
        )}
        {working && (
          <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-white/90 p-3 text-center shadow-lg backdrop-blur">
            <div className="text-sm font-semibold text-stone-800">Removing background…</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-stone-900 transition-all"
                style={{ width: `${Math.max(8, Math.round(cut.progress * 100))}%` }}
              />
            </div>
            {cut.progress < 1 && <div className="mt-1.5 text-xs text-stone-500">First time takes a bit longer</div>}
          </div>
        )}
      </div>

      {source.imageUrls && source.imageUrls.length > 1 && (
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
          {source.imageUrls.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => void loadUrl(url)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100 ring-2 ${pickedUrl === url ? 'ring-stone-900' : 'ring-transparent'}`}
            >
              <img src={proxiedImage(url)} alt="" className="h-full w-full object-cover mix-blend-multiply" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {imageError && <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{imageError}</p>}
      {cut.status === 'error' && <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{cut.message}</p>}

      <div className="mt-3 flex gap-2">
        {original && (
          <button
            type="button"
            disabled={working}
            onClick={() => {
              if (isCutOut) {
                runId.current++
                setImage(original)
              } else void runCutOut(original)
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-100 py-2.5 text-sm font-semibold text-stone-700 active:bg-stone-200 disabled:opacity-50"
          >
            <SparkleIcon className="h-4 w-4" />
            {isCutOut ? 'Restore background' : 'Remove background'}
          </button>
        )}
        <button
          type="button"
          onClick={() => replaceInput.current?.click()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-100 py-2.5 text-sm font-semibold text-stone-700 active:bg-stone-200"
        >
          <PhotosIcon className="h-4 w-4" />
          {image || source.existing?.image ? 'Change photo' : 'Add photo'}
        </button>
        <input
          ref={replaceInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void loadBlob(file, true)
          }}
        />
      </div>

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

      <div className="mt-5 text-sm font-semibold text-stone-700">Color</div>
      <div className="mt-2">
        <ColorPicker
          value={draft.color}
          onChange={(color) => {
            colorTouched.current = true
            update({ color })
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

      <button type="submit" disabled={!canSave} className="mt-6 w-full rounded-xl bg-stone-900 py-3.5 font-semibold text-white disabled:opacity-40">
        {saving ? 'Saving…' : working ? 'Removing background…' : source.existing ? 'Save changes' : 'Add to closet'}
      </button>
    </form>
  )
}
