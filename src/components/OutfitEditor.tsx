import { useMemo, useState } from 'react'
import { shuffleOutfit, sortForOutfit, type Outfit, type OutfitDraft } from '../lib/outfits'
import { CATEGORIES, type Category, type Item } from '../lib/types'
import { Chip } from './Chips'
import { ItemImage } from './ItemImage'
import { OutfitCollage } from './OutfitCollage'
import { ShuffleIcon } from './icons'

interface Props {
  items: Item[]
  existing?: Outfit
  initialIds?: string[]
  onSave: (draft: OutfitDraft, existing?: Outfit) => void
  onCancel: () => void
}

export function OutfitEditor({ items, existing, initialIds, onSave, onCancel }: Props) {
  const [name, setName] = useState(existing?.name ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [selected, setSelected] = useState<string[]>(existing?.itemIds ?? initialIds ?? [])
  const [category, setCategory] = useState<Category | 'All'>('All')

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const pieces = sortForOutfit(selected.map((id) => byId.get(id)).filter((item): item is Item => Boolean(item)))
  const categories = CATEGORIES.filter((candidate) => items.some((item) => item.category === candidate))
  const shown = category === 'All' ? items : items.filter((item) => item.category === category)

  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((other) => other !== id) : [...current, id]))

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-stone-900">{existing ? 'Edit outfit' : 'New outfit'}</h2>
        <button
          type="button"
          onClick={() => setSelected(shuffleOutfit(items).map((item) => item.id))}
          className="flex items-center gap-1.5 rounded-full bg-stone-100 px-3.5 py-1.5 text-sm font-semibold text-stone-700 active:bg-stone-200"
        >
          <ShuffleIcon className="h-4 w-4" /> Shuffle
        </button>
      </div>

      <OutfitCollage items={pieces} className="mt-3 aspect-[4/3] w-full rounded-3xl" padding="p-2" />
      <p className="mt-2 text-center text-xs text-stone-400">
        {pieces.length ? `${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'} · tap pieces below to add or remove` : 'Tap pieces below, or shuffle'}
      </p>

      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name (e.g. Friday dinner)"
        className="mt-3 w-full rounded-xl bg-stone-50 px-3.5 py-3 text-base ring-1 ring-stone-200 outline-none focus:ring-2 focus:ring-stone-900"
      />

      <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip active={category === 'All'} onClick={() => setCategory('All')}>
          All
        </Chip>
        {categories.map((candidate) => (
          <Chip key={candidate} active={category === candidate} onClick={() => setCategory(candidate)}>
            {candidate}
          </Chip>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {shown.map((item) => {
          const active = selected.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.name}
              aria-pressed={active}
              onClick={() => toggle(item.id)}
              className={`relative aspect-square overflow-hidden rounded-xl bg-stone-100/70 ring-2 transition ${active ? 'ring-stone-900' : 'ring-transparent'}`}
            >
              <ItemImage item={item} className="absolute inset-0 h-full w-full p-1.5" />
              {active && (
                <span className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-stone-900 text-[11px] font-bold text-stone-50">✓</span>
              )}
            </button>
          )
        })}
      </div>

      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Notes"
        rows={2}
        className="mt-3 w-full rounded-xl bg-stone-50 px-3.5 py-3 text-base ring-1 ring-stone-200 outline-none focus:ring-2 focus:ring-stone-900"
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl bg-stone-100 py-3 font-semibold text-stone-700">
          Cancel
        </button>
        <button
          type="button"
          disabled={!pieces.length}
          onClick={() => onSave({ name, notes: notes.trim() || undefined, itemIds: pieces.map((item) => item.id) }, existing)}
          className="rounded-xl bg-stone-900 py-3 font-semibold text-stone-50 disabled:opacity-40"
        >
          Save outfit
        </button>
      </div>
    </div>
  )
}
