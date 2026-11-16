import { useState } from 'react'
import type { PreparedImage } from '../lib/images'
import { formatPrice, type Draft, type Item } from '../lib/types'
import { costPerWear, dayKey, wearCount, wornLabel } from '../lib/wear'
import { Swatch } from './Chips'
import { ItemEditor } from './ItemEditor'
import { ItemImage } from './ItemImage'
import { Sheet } from './Sheet'

interface Props {
  item: Item
  onSave: (draft: Draft, image: PreparedImage | undefined, existing?: Item) => Promise<unknown>
  onDelete: (item: Item) => void
  onToggleWorn: (worn: boolean) => void
  onBought: () => void
  onClose: () => void
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function ItemSheet({ item, onSave, onDelete, onToggleWorn, onBought, onClose }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (editing) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, image: _image, ...draft } = item
    return (
      <Sheet onClose={onClose}>
        <ItemEditor
          source={{ draft, existing: item }}
          onCancel={() => setEditing(false)}
          onSave={async (next, image, existing) => {
            await onSave(next, image, existing)
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
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))

  return (
    <Sheet onClose={onClose}>
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-stone-100">
        <ItemImage item={item} className="absolute inset-0 h-full w-full p-5" />
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-wide text-stone-400 uppercase">{item.category}</div>
          <h2 className="mt-0.5 text-xl leading-snug font-bold text-stone-900">{item.name}</h2>
        </div>
        {item.color && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-stone-50 py-1 pr-3 pl-1 text-sm font-medium text-stone-600 ring-1 ring-stone-100">
            <Swatch name={item.color} size="h-5 w-5" /> {item.color}
          </div>
        )}
      </div>

      {item.wishlist ? (
        <button onClick={onBought} className="mt-4 w-full rounded-2xl bg-emerald-600 py-3 font-semibold text-white active:bg-emerald-700">
          Bought it · move to closet
        </button>
      ) : (
        <WearRow item={item} onToggle={onToggleWorn} />
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

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={() => setEditing(true)} className="rounded-xl bg-stone-900 py-3 font-semibold text-stone-50">
          Edit
        </button>
        {confirmDelete ? (
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
    </Sheet>
  )
}

export function WearRow({ item, onToggle }: { item: Pick<Item, 'wears'>; onToggle: (worn: boolean) => void }) {
  const today = dayKey()
  const wornToday = Boolean(item.wears?.includes(today))
  const count = wearCount(item)
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-stone-50 py-2.5 pr-2.5 pl-3.5 ring-1 ring-stone-100">
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
  )
}
