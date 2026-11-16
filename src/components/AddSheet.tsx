import { useEffect, useRef, useState } from 'react'
import { extractLinks } from '../lib/links'
import { fetchProductImage, importProduct, type ProductInfo } from '../lib/productImport'
import { emptyDraft, guessBrand, guessCategory, matchColor, type Draft } from '../lib/types'
import { prepareImage, type PreparedImage } from '../lib/images'
import { ItemEditor, type EditorSource } from './ItemEditor'
import { Sheet } from './Sheet'
import { CameraIcon, LinkIcon, PhotosIcon } from './icons'

interface Props {
  onSave: (draft: Draft, image: PreparedImage | undefined) => Promise<unknown>
  onClose: () => void
  initialLink?: string
  title?: string
}

const productDraft = (product: ProductInfo): Draft => {
  const text = [product.name, product.description].filter(Boolean).join(' ')
  return {
    ...emptyDraft(),
    name: product.name ?? '',
    brand: product.brand ?? guessBrand(product.name),
    price: product.price,
    currency: product.currency,
    color: matchColor(product.color) ?? matchColor(product.name) ?? matchColor(product.description),
    category: guessCategory(product.name ?? '') ?? guessCategory(text) ?? 'Other',
    url: product.url,
  }
}

async function firstImage(urls: string[]) {
  for (const url of urls.slice(0, 3)) {
    try {
      return await prepareImage(await fetchProductImage(url))
    } catch {
      // try the next image
    }
  }
  return undefined
}

export function AddSheet({ onSave, onClose, initialLink, title = 'Add to closet' }: Props) {
  const [link, setLink] = useState(initialLink ?? '')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string>()
  const [source, setSource] = useState<EditorSource>()
  const [bulk, setBulk] = useState<{ done: number; total: number; failed: string[] }>()
  const links = extractLinks(link)
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  const runImport = async (value = link) => {
    if (!value.trim()) return
    const found = extractLinks(value)
    if (found.length > 1) return runBulk(found)
    setImporting(true)
    setError(undefined)
    try {
      const product = await importProduct(value.trim())
      setSource({
        draft: productDraft(product),
        imageUrls: product.images,
        autoCutOut: false,
      })
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Couldn’t read that link')
    } finally {
      setImporting(false)
    }
  }

  const runBulk = async (found: string[]) => {
    setImporting(true)
    setError(undefined)
    const failed: string[] = []
    setBulk({ done: 0, total: found.length, failed })
    for (const [index, url] of found.entries()) {
      try {
        const product = await importProduct(url)
        await onSave(productDraft(product), await firstImage(product.images))
      } catch {
        failed.push(url)
      }
      setBulk({ done: index + 1, total: found.length, failed: [...failed] })
    }
    setImporting(false)
    if (failed.length) setLink(failed.join('\n'))
    else onClose()
  }

  const autoImported = useRef(false)
  useEffect(() => {
    if (!initialLink || autoImported.current) return
    autoImported.current = true
    void runImport(initialLink)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
            <textarea
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              rows={links.length > 1 ? 4 : 1}
              value={link}
              onChange={(event) => setLink(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && links.length <= 1) {
                  event.preventDefault()
                  void runImport()
                }
              }}
              placeholder="Paste a link from any store, or several at once"
              className="mt-3 w-full resize-none rounded-xl bg-surface px-3.5 py-3 text-base text-stone-900 ring-1 ring-stone-200 outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-stone-900"
            />
            <div className="mt-3 flex gap-2">
              {'clipboard' in navigator && 'readText' in navigator.clipboard && (
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => void pasteAndImport()}
                  className="flex-1 rounded-xl bg-surface py-3 text-sm font-semibold text-stone-700 ring-1 ring-stone-200 active:bg-stone-100 disabled:opacity-50"
                >
                  Paste
                </button>
              )}
              <button
                type="submit"
                disabled={importing || !link.trim()}
                className="flex-[2] rounded-xl bg-stone-900 py-3 text-sm font-semibold text-stone-50 disabled:opacity-40"
              >
                {bulk && importing
                  ? `Adding ${bulk.done + 1} of ${bulk.total}…`
                  : importing
                    ? 'Reading product…'
                    : links.length > 1
                      ? `Import ${links.length} links`
                      : 'Import'}
              </button>
            </div>
            {bulk && !importing && bulk.failed.length > 0 && (
              <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">
                Added {bulk.total - bulk.failed.length} of {bulk.total}. The {bulk.failed.length === 1 ? 'link left in the box' : `${bulk.failed.length} links left in the box`} couldn’t be read.
              </p>
            )}
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
