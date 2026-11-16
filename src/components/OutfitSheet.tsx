import { useState } from 'react'
import { sortForOutfit, type Outfit } from '../lib/outfits'
import { formatPrice, type Item } from '../lib/types'
import { wearCount } from '../lib/wear'
import { ItemImage } from './ItemImage'
import { OutfitCollage } from './OutfitCollage'
import { WearRow } from './ItemSheet'

interface Props {
  outfit: Outfit
  items: Item[]
  onEdit: () => void
  onDelete: () => void
  onOpenItem: (item: Item) => void
  onToggleWorn: (worn: boolean) => void
}

export function OutfitSheet({ outfit, items, onEdit, onDelete, onOpenItem, onToggleWorn }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pieces = sortForOutfit(items)
  const missing = outfit.itemIds.length - pieces.length
  const priced = pieces.filter((item) => item.price !== undefined)
  const currencies = new Set(priced.map((item) => (item.currency ?? 'USD').toUpperCase()))
  const total = priced.length && currencies.size === 1 ? priced.reduce((sum, item) => sum + (item.price ?? 0), 0) : undefined
  const currency = priced[0] ? (priced[0].currency ?? 'USD').toUpperCase() : 'USD'
  const wears = wearCount(outfit)

  return (
    <div>
      <OutfitCollage items={pieces} className="aspect-square w-full rounded-3xl" padding="p-2.5" />
      <h2 className="mt-4 text-xl leading-snug font-bold text-stone-900">{outfit.name}</h2>
      <p className="text-sm text-stone-500">
        {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'}
        {missing > 0 && ` · ${missing} deleted`}
        {total !== undefined && ` · ${formatPrice(total, currency)}`}
        {total !== undefined && wears > 0 && ` · ${formatPrice(total / wears, currency)}/wear`}
      </p>

      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        {pieces.map((item) => (
          <button key={item.id} onClick={() => onOpenItem(item)} className="w-20 shrink-0 text-left">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-stone-100/70">
              <ItemImage item={item} className="absolute inset-0 h-full w-full p-1.5" />
            </div>
            <div className="mt-1 truncate text-xs font-medium text-stone-600">{item.name}</div>
          </button>
        ))}
      </div>

      <WearRow item={outfit} onToggle={onToggleWorn} />

      {outfit.notes && <p className="mt-3 rounded-xl bg-stone-50 px-3.5 py-2.5 text-sm whitespace-pre-wrap text-stone-700">{outfit.notes}</p>}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button onClick={onEdit} className="rounded-xl bg-stone-900 py-3 font-semibold text-stone-50">
          Edit
        </button>
        {confirmDelete ? (
          <button onClick={onDelete} className="rounded-xl bg-rose-600 py-3 font-semibold text-white">
            Delete for good
          </button>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="rounded-xl bg-stone-100 py-3 font-semibold text-rose-600">
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
