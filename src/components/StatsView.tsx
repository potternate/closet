import type { ReactNode } from 'react'
import type { Outfit } from '../lib/outfits'
import { closetStats, colorHex, type Tally } from '../lib/stats'
import { formatPrice, type Item } from '../lib/types'
import { costPerWear, wearCount } from '../lib/wear'
import { ItemImage } from './ItemImage'

interface Props {
  items: Item[]
  outfits: Outfit[]
  onOpen: (item: Item) => void
}

export function StatsView({ items, outfits, onOpen }: Props) {
  const stats = closetStats(items, outfits)
  if (!items.length) return <p className="mt-16 text-center text-stone-400">Add some clothes to see your stats.</p>
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Items" value={String(stats.count)} />
        <Tile label="Outfits" value={String(stats.outfits)} />
        <Tile
          label={stats.value.priced === stats.count || !stats.value.priced ? 'Closet value' : `Value of ${stats.value.priced} priced`}
          value={stats.value.priced ? (formatPrice(stats.value.amount, stats.value.currency) ?? '—') : '—'}
        />
        <Tile label="Wears logged" value={String(stats.wears)} />
      </div>
      <Card title="By category">
        <Bars rows={stats.categories} total={Math.max(...stats.categories.map((row) => row.count))} />
      </Card>
      {stats.colors.length > 0 && (
        <Card title="Colors">
          <div className="flex h-4 overflow-hidden rounded-full ring-1 ring-stone-200">
            {stats.colors.map(({ key, count }) => (
              <div key={key} title={key} style={{ flex: count, background: colorHex(key) }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            {stats.colors.map(({ key, count }) => (
              <span key={key} className="flex items-center gap-1.5 text-sm text-stone-600">
                <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: colorHex(key) }} />
                {key} <span className="text-stone-400">{count}</span>
              </span>
            ))}
          </div>
        </Card>
      )}
      {stats.seasons.some((row) => row.count) && (
        <Card title="By season">
          <Bars rows={stats.seasons} total={Math.max(...stats.seasons.map((row) => row.count))} />
          {stats.noSeason > 0 && <p className="mt-3 text-xs text-stone-400">{stats.noSeason} {stats.noSeason === 1 ? 'item has' : 'items have'} no season set.</p>}
        </Card>
      )}
      {stats.brands.length > 0 && (
        <Card title="Top brands">
          <Bars rows={stats.brands} total={stats.brands[0].count} />
        </Card>
      )}
      <Card title="Wear">
        <p className="text-sm text-stone-500">
          {stats.neverWorn === stats.count ? 'Tap “Wore today” on an item to start tracking.' : `${stats.neverWorn} of ${stats.count} items never worn.`}
        </p>
        {stats.mostWorn.length > 0 && <ItemList title="Most worn" items={stats.mostWorn} detail={(item) => `${wearCount(item)}×`} onOpen={onOpen} />}
        {stats.bestValue.length > 0 && (
          <ItemList
            title="Best cost per wear"
            items={stats.bestValue}
            detail={(item) => formatPrice(costPerWear(item), item.currency) ?? ''}
            onOpen={onOpen}
          />
        )}
      </Card>
    </div>
  )
}

const Tile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-stone-200/70">
    <div className="text-2xl font-bold text-stone-900">{value}</div>
    <div className="text-xs font-medium text-stone-500">{label}</div>
  </div>
)

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-stone-200/70">
    <h2 className="mb-3 text-xs font-semibold tracking-wide text-stone-400 uppercase">{title}</h2>
    {children}
  </section>
)

const Bars = ({ rows, total }: { rows: Tally[]; total: number }) => (
  <div className="space-y-2">
    {rows.map(({ key, count }) => (
      <div key={key} className="flex items-center gap-3 text-sm">
        <span className="w-24 shrink-0 truncate text-stone-700">{key}</span>
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
          <span className="block h-full rounded-full bg-stone-900" style={{ width: `${(count / total) * 100}%` }} />
        </span>
        <span className="w-6 text-right text-stone-500 tabular-nums">{count}</span>
      </div>
    ))}
  </div>
)

const ItemList = ({ title, items, detail, onOpen }: { title: string; items: Item[]; detail: (item: Item) => string; onOpen: (item: Item) => void }) => (
  <div className="mt-4">
    <div className="text-sm font-semibold text-stone-800">{title}</div>
    <div className="mt-2 space-y-2">
      {items.map((item) => (
        <button key={item.id} onClick={() => onOpen(item)} className="flex w-full items-center gap-3 text-left">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-stone-100/70">
            <ItemImage item={item} className="h-full w-full p-1" />
          </div>
          <span className="min-w-0 flex-1 truncate text-sm text-stone-700">{item.name}</span>
          <span className="text-sm font-semibold text-stone-900 tabular-nums">{detail(item)}</span>
        </button>
      ))}
    </div>
  </div>
)
