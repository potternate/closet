import { sortForOutfit } from '../lib/outfits'
import type { Item } from '../lib/types'
import { dayLabel } from '../lib/wear'
import { ItemImage } from './ItemImage'
import { OutfitCollage } from './OutfitCollage'
import { CalendarIcon } from './icons'

export function WornView({ days, onOpen }: { days: { day: string; items: Item[] }[]; onOpen: (day: string) => void }) {
  if (!days.length) {
    return (
      <div className="mt-16 flex flex-col items-center text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-surface text-stone-400 shadow-sm ring-1 ring-stone-200">
          <CalendarIcon className="h-9 w-9" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-stone-900">No fits logged yet</h2>
        <p className="mt-1 max-w-xs text-sm text-stone-500">Tap “Wore today” on an item or outfit, or tell your agent what you wore. Each day shows up here.</p>
      </div>
    )
  }
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {days.map(({ day, items }) => (
        <button key={day} onClick={() => onOpen(day)} className="overflow-hidden rounded-2xl bg-surface text-left shadow-sm ring-1 ring-stone-200/70 active:scale-[0.98]">
          <OutfitCollage items={sortForOutfit(items)} className="aspect-square w-full" />
          <div className="px-3 py-2.5">
            <div className="truncate text-sm font-semibold text-stone-900">{dayLabel(day)}</div>
            <div className="truncate text-xs text-stone-500">
              {items.length} {items.length === 1 ? 'piece' : 'pieces'}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

export function WornDaySheet({ day, items, onOpenItem, onSaveOutfit }: { day: string; items: Item[]; onOpenItem: (item: Item) => void; onSaveOutfit: () => void }) {
  const pieces = sortForOutfit(items)
  return (
    <div>
      <OutfitCollage items={pieces} className="aspect-square w-full rounded-3xl" padding="p-2.5" />
      <h2 className="mt-4 text-xl leading-snug font-bold text-stone-900">{dayLabel(day)}</h2>
      <p className="text-sm text-stone-500">
        {day} · {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'}
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
      <button onClick={onSaveOutfit} className="mt-5 w-full rounded-xl bg-stone-900 py-3 font-semibold text-stone-50">
        Save as outfit
      </button>
    </div>
  )
}
