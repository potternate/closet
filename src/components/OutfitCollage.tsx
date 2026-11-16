import { collageColumns } from '../lib/outfits'
import type { Item } from '../lib/types'
import { ItemImage } from './ItemImage'
import { LayersIcon } from './icons'

export function OutfitCollage({ items, className = '', padding = 'p-1.5' }: { items: Item[]; className?: string; padding?: string }) {
  const columns = collageColumns(items)
  if (!columns.length) {
    return (
      <div className={`grid place-items-center bg-stone-100/70 text-stone-300 ${className}`}>
        <LayersIcon className="h-10 w-10" />
      </div>
    )
  }
  return (
    <div className={`flex gap-1 bg-stone-100/70 p-2 ${className}`}>
      {columns.map((column, index) => (
        <div key={index} className={`flex min-w-0 flex-col gap-1 ${columns.length > 1 && index === 1 ? 'flex-[0.7]' : 'flex-1'}`}>
          {column.map((item) => (
            <div key={item.id} className="relative min-h-0 flex-1">
              <ItemImage item={item} className={`absolute inset-0 h-full w-full ${padding}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
