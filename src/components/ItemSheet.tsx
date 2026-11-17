import { useState } from 'react'
import { imageBlob, type PhotoInput } from '../lib/store'
import { ARCHIVE_REASONS, formatPrice, itemColors, itemPhotos, type ArchiveReason, type Draft, type Item } from '../lib/types'
import { costPerWear, dayKey, dayLabel, wearCount, wornLabel } from '../lib/wear'
import { Swatch } from './Chips'
import { ItemEditor } from './ItemEditor'
import { ItemImage } from './ItemImage'
import { Sheet } from './Sheet'

interface Props {
  item: Item
  onSave: (draft: Draft, photos: PhotoInput[] | undefined, existing?: Item) => Promise<unknown>
  onDelete: (item: Item) => void
  onToggleWorn: (worn: boolean) => void
  onLogDay?: (day: string) => void
  onBought: () => void
  onArchive: (reason: ArchiveReason) => void
  onRestore: () => void
  onClose: () => void
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function ItemSheet({ item, onSave, onDelete, onToggleWorn, onLogDay, onBought, onArchive, onRestore, onClose }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [archiving, setArchiving] = useState(false)

  if (editing) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, image: _image, photos: _photos, ...draft } = item
    return (
      <Sheet onClose={onClose}>
        <ItemEditor
          source={{ draft, existing: item }}
          onCancel={() => setEditing(false)}
          onSave={async (next, photos, existing) => {
            await onSave(next, photos, existing)
            setEditing(false)
          }}
        />
      </Sheet>
    )
  }

  const details = [
    ['Brand', item.brand],
    ['Size', item.size],
    ['Price', formatPrice(item.price, item.currency)],
    ['Cost per wear', formatPrice(costPerWear(item), item.currency)],
    ['Seasons', item.seasons.length ? item.seasons.join(', ') : undefined],
    ['Type', item.subtype],
    ['Material', item.material],
    ['Pattern', item.pattern],
    ['Fit', item.fit],
    ['Formality', item.formality],
    ['Style', item.styles?.length ? item.styles.join(', ') : undefined],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))

  return (
    <Sheet onClose={onClose}>
      <PhotoGallery item={item} />
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-wide text-stone-400 uppercase">{item.category}</div>
          <h2 className="mt-0.5 text-xl leading-snug font-bold text-stone-900">{item.name}</h2>
        </div>
        {itemColors(item).length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-stone-50 py-1 pr-3 pl-1 text-sm font-medium text-stone-600 ring-1 ring-stone-100">
            <span className="flex -space-x-1.5">
              {itemColors(item).map((name) => (
                <Swatch key={name} name={name} size="h-5 w-5" />
              ))}
            </span>
            {itemColors(item).join(' / ')}
          </div>
        )}
      </div>

      {item.archived ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-stone-50 py-2.5 pr-2.5 pl-3.5 ring-1 ring-stone-100">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-stone-800">Archived{item.archiveReason ? ` · ${item.archiveReason}` : ''}</div>
            <div className="text-xs text-stone-500">
              {dayLabel(item.archived)} · {wearCount(item) ? `worn ${wearCount(item) === 1 ? 'once' : `${wearCount(item)} times`}` : 'never worn'}
            </div>
          </div>
          <button onClick={onRestore} className="shrink-0 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-stone-50">
            Restore
          </button>
        </div>
      ) : item.wishlist ? (
        <button onClick={onBought} className="mt-4 w-full rounded-2xl bg-emerald-600 py-3 font-semibold text-white active:bg-emerald-700">
          Bought it · move to closet
        </button>
      ) : (
        <WearRow item={item} onToggle={onToggleWorn} onLogDay={onLogDay} />
      )}

      {details.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {details.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-stone-50 px-3.5 py-2.5">
              <dt className="text-xs font-medium text-stone-400">{label}</dt>
              <dd className="truncate text-sm font-semibold text-stone-800">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.notes && <p className="mt-3 rounded-xl bg-stone-50 px-3.5 py-2.5 text-sm whitespace-pre-wrap text-stone-700">{item.notes}</p>}
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block truncate rounded-xl bg-stone-50 px-3.5 py-3 text-sm font-semibold text-stone-800 ring-1 ring-stone-100"
        >
          View on {hostOf(item.url)} ↗
        </a>
      )}

      <button
        disabled={duplicating}
        onClick={async () => {
          setDuplicating(true)
          try {
            const { id: _id, createdAt: _created, updatedAt: _updated, image: _image, photos: _photos, wears: _wears, archived: _archived, archiveReason: _reason, ...draft } = item
            const copies = await Promise.all(
              itemPhotos(item).map(async (photo) => {
                const blob = await imageBlob(photo)
                return blob ? [{ blob, type: photo.type }] : []
              }),
            )
            await onSave(draft, copies.flat())
            onClose()
          } finally {
            setDuplicating(false)
          }
        }}
        className="mt-4 w-full rounded-xl bg-stone-100 py-3 text-sm font-semibold text-stone-800 disabled:opacity-50"
      >
        {duplicating ? 'Duplicating…' : 'Duplicate item'}
      </button>

      {archiving && (
        <div className="mt-4 rounded-2xl bg-stone-50 p-3.5 ring-1 ring-stone-100">
          <div className="text-sm font-semibold text-stone-800">Why is it leaving the closet?</div>
          <p className="text-xs text-stone-500">It keeps its photos and wear history, and stops counting as something you own.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {ARCHIVE_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => {
                  onArchive(reason)
                  setArchiving(false)
                }}
                className="rounded-full bg-surface px-3.5 py-1.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-200 active:bg-stone-100"
              >
                {reason}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={() => setEditing(true)} className="rounded-xl bg-stone-900 py-3 font-semibold text-stone-50">
          Edit
        </button>
        {!item.wishlist && !item.archived && !confirmDelete ? (
          <button onClick={() => setArchiving(!archiving)} aria-expanded={archiving} className="rounded-xl bg-stone-100 py-3 font-semibold text-stone-800">
            Archive
          </button>
        ) : confirmDelete ? (
          <button
            onClick={() => {
              onDelete(item)
              onClose()
            }}
            className="rounded-xl bg-rose-600 py-3 font-semibold text-white"
          >
            Delete for good
          </button>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="rounded-xl bg-stone-100 py-3 font-semibold text-rose-600">
            Delete
          </button>
        )}
      </div>
      {!item.wishlist && !item.archived && !confirmDelete && (
        <button onClick={() => setConfirmDelete(true)} className="mt-3 w-full py-1 text-sm font-semibold text-rose-600">
          Delete instead
        </button>
      )}
    </Sheet>
  )
}

function PhotoGallery({ item }: { item: Item }) {
  const photos = itemPhotos(item)
  const [index, setIndex] = useState(0)
  if (photos.length < 2) {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-stone-100">
        <ItemImage item={item} className="absolute inset-0 h-full w-full p-5" />
      </div>
    )
  }
  return (
    <div className="relative">
      <div
        className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto rounded-3xl bg-stone-100 [scrollbar-width:none]"
        onScroll={(event) => setIndex(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}
      >
        {photos.map((photo) => (
          <div key={photo.id} className="relative h-full w-full shrink-0 snap-center">
            <ItemImage item={item} photo={photo} className="absolute inset-0 h-full w-full p-5" />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {photos.map((photo, dot) => (
          <span key={photo.id} className={`h-1.5 w-1.5 rounded-full ${dot === index ? 'bg-stone-800' : 'bg-stone-300'}`} />
        ))}
      </div>
    </div>
  )
}

export function WearRow({ item, onToggle, onLogDay }: { item: Pick<Item, 'wears'>; onToggle: (worn: boolean) => void; onLogDay?: (day: string) => void }) {
  const today = dayKey()
  const wornToday = Boolean(item.wears?.includes(today))
  const count = wearCount(item)
  return (
    <div className="mt-4 rounded-2xl bg-stone-50 py-2.5 pr-2.5 pl-3.5 ring-1 ring-stone-100">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-stone-800">{count ? `Worn ${count === 1 ? 'once' : `${count} times`}` : 'Never worn'}</div>
          <div className="text-xs text-stone-500">{count ? `Last ${wornLabel(item.wears, today).replace(/^Worn /, '')}` : 'Tap when you wear it'}</div>
        </div>
        <button
          onClick={() => onToggle(!wornToday)}
          aria-pressed={wornToday}
          className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold ${wornToday ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-900 text-stone-50'}`}
        >
          {wornToday ? '✓ Worn today' : 'Wore today'}
        </button>
      </div>
      {onLogDay && (
        <label className="mt-2 flex items-center gap-2 text-xs font-medium text-stone-500">
          Wore another day?
          <input
            type="date"
            max={today}
            aria-label="Log a past wear"
            className="rounded-lg bg-surface px-2 py-1 text-stone-800 ring-1 ring-stone-200"
            onChange={(event) => {
              if (event.target.value && event.target.value <= today) onLogDay(event.target.value)
              event.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}
