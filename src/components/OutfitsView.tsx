import type { Outfit } from '../lib/outfits'
import type { Item } from '../lib/types'
import { OutfitCollage } from './OutfitCollage'
import { LayersIcon, ShuffleIcon } from './icons'

interface Props {
  outfits: Outfit[]
  byId: Map<string, Item>
  canShuffle: boolean
  onOpen: (outfit: Outfit) => void
  onShuffle: () => void
}

export function OutfitsView({ outfits, byId, canShuffle, onOpen, onShuffle }: Props) {
  return (
    <>
      {canShuffle && (
        <button
          onClick={onShuffle}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-surface py-3 font-semibold text-stone-800 shadow-sm ring-1 ring-stone-200 active:bg-stone-50"
        >
          <ShuffleIcon className="h-5 w-5" /> Shuffle an outfit
        </button>
      )}
      {outfits.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-surface text-stone-400 shadow-sm ring-1 ring-stone-200">
            <LayersIcon className="h-9 w-9" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-stone-900">No outfits yet</h2>
          <p className="mt-1 max-w-xs text-sm text-stone-500">
            {canShuffle ? 'Pick pieces from your closet, or shuffle to get an idea.' : 'Add a few items to your closet first.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {outfits.map((outfit) => {
            const pieces = outfit.itemIds.map((id) => byId.get(id)).filter((item): item is Item => Boolean(item))
            return (
              <button
                key={outfit.id}
                onClick={() => onOpen(outfit)}
                className="overflow-hidden rounded-2xl bg-surface text-left shadow-sm ring-1 ring-stone-200/70 active:scale-[0.98]"
              >
                <OutfitCollage items={pieces} className="aspect-square w-full" />
                <div className="px-3 py-2.5">
                  <div className="truncate text-sm font-semibold text-stone-900">{outfit.name}</div>
                  <div className="truncate text-xs text-stone-500">
                    {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
