import { useRef, useState } from 'react'
import { importProduct } from '../lib/productImport'
import { emptyDraft, guessBrand, guessCategory, matchColor, type Draft } from '../lib/types'
import type { PreparedImage } from '../lib/images'
import { ItemEditor, type EditorSource } from './ItemEditor'
import { Sheet } from './Sheet'
import { CameraIcon, LinkIcon, PhotosIcon } from './icons'

interface Props {
  onSave: (draft: Draft, image: PreparedImage | undefined) => Promise<unknown>
  onClose: () => void
  initialLink?: string
  title?: string
}

export function AddSheet({ onSave, onClose, initialLink, title = 'Add to closet' }: Props) {
  const [link, setLink] = useState(initialLink ?? '')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string>()
  const [source, setSource] = useState<EditorSource>()
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  const runImport = async (value = link) => {
    if (!value.trim()) return
    setImporting(true)
    setError(undefined)
    try {
      const product = await importProduct(value.trim())
      const text = [product.name, product.description].filter(Boolean).join(' ')
      setSource({
        draft: {
          ...emptyDraft(),
          name: product.name ?? '',
          brand: product.brand ?? guessBrand(product.name),
          price: product.price,
          currency: product.currency,
          color: matchColor(product.color),
          category: guessCategory(product.name ?? '') ?? guessCategory(text) ?? 'Other',
          url: product.url,
        },
        imageUrls: product.images,
        autoCutOut: false,
      })
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Couldn’t read that link')
    } finally {
      setImporting(false)
    }
  }

  const pasteAndImport = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (text) {
        setLink(text)
        void runImport(text)
      }
    } catch {
      setError('Paste the link into the box instead')
    }
  }

  const onFile = (file?: File) => {
    if (file) setSource({ draft: emptyDraft(), file, autoCutOut: true })
  }

  return (
    <Sheet onClose={onClose}>
      {source ? (
        <ItemEditor source={source} saveLabel={title} onCancel={() => setSource(undefined)} onSave={async (draft, image) => {
          await onSave(draft, image)
          onClose()
        }} />
      ) : (
        <>
          <div className="flex items-start justify-between">
            <h2 className="text-2xl font-bold text-stone-900">{title}</h2>
            <button onClick={onClose} className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-semibold text-stone-500">
              Close
            </button>
          </div>

          <form
            className="mt-5 rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-100"
            onSubmit={(event) => {
              event.preventDefault()
              void runImport()
            }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
              <LinkIcon className="h-4 w-4" /> From a product link
            </div>
            <input
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="Paste a link from any store"
              className="mt-3 w-full rounded-xl bg-white px-3.5 py-3 text-base text-stone-900 ring-1 ring-stone-200 outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-stone-900"
            />
            <div className="mt-3 flex gap-2">
              {'clipboard' in navigator && 'readText' in navigator.clipboard && (
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => void pasteAndImport()}
                  className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-stone-700 ring-1 ring-stone-200 active:bg-stone-100 disabled:opacity-50"
                >
                  Paste
                </button>
              )}
              <button
                type="submit"
                disabled={importing || !link.trim()}
                className="flex-[2] rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {importing ? 'Reading product…' : 'Import'}
              </button>
            </div>
            {error && (
              <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">
                {error}. You can also screenshot the product and add it as a photo.
              </p>
            )}
          </form>

          <div className="my-4 flex items-center gap-3 text-xs font-semibold tracking-wide text-stone-400 uppercase">
            <div className="h-px flex-1 bg-stone-200" /> or <div className="h-px flex-1 bg-stone-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => cameraInput.current?.click()}
              className="flex flex-col items-center gap-2 rounded-2xl bg-stone-50 py-5 font-semibold text-stone-800 ring-1 ring-stone-100 active:bg-stone-100"
            >
              <CameraIcon className="h-7 w-7" /> Take photo
            </button>
            <button
              onClick={() => libraryInput.current?.click()}
              className="flex flex-col items-center gap-2 rounded-2xl bg-stone-50 py-5 font-semibold text-stone-800 ring-1 ring-stone-100 active:bg-stone-100"
            >
              <PhotosIcon className="h-7 w-7" /> Choose photo
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-stone-400">Backgrounds are removed automatically.</p>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
          <input ref={libraryInput} type="file" accept="image/*" className="hidden" onChange={(event) => onFile(event.target.files?.[0])} />
        </>
      )}
    </Sheet>
  )
}
