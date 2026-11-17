import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './lib/auth'
import { useCloset } from './lib/store'
import { CATEGORIES, COLORS, formatPrice, itemColors, SEASONS, type Category, type ColorName, type Item, type Season } from './lib/types'
import { AccountSheet } from './components/AccountSheet'
import { AddSheet } from './components/AddSheet'
import { Chip, Swatch } from './components/Chips'
import { ItemImage } from './components/ItemImage'
import { StatsView } from './components/StatsView'
import { ItemSheet } from './components/ItemSheet'
import { CalendarIcon, ChartIcon, HangerIcon, HeartIcon, LayersIcon, PlusIcon, SearchIcon, SlidersIcon, UserIcon } from './components/icons'
import { OutfitEditor } from './components/OutfitEditor'
import { OutfitSheet } from './components/OutfitSheet'
import { OutfitsView } from './components/OutfitsView'
import { WornDaySheet, WornView } from './components/WornView'
import { Sheet } from './components/Sheet'
import { shuffleOutfit, type Outfit } from './lib/outfits'
import { dayKey, dayLabel, groupItems, SORTS, sortItemsBy, wearCount, wornDays, wornLabel, type SortKey } from './lib/wear'

export default function App() {
  const auth = useAuth()
  const closet = useCloset(auth.user?.id, auth.loading)
  const [category, setCategory] = useState<Category | 'All'>('All')
  const [query, setQuery] = useState('')
  const [color, setColor] = useState<ColorName>()
  const [season, setSeason] = useState<Season>()
  const [showFilters, setShowFilters] = useState(false)
  const [shared, setShared] = useState(readSharedLink)
  const [adding, setAdding] = useState(Boolean(shared))
  const [openId, setOpenId] = useState<string>()
  const [showAccount, setShowAccount] = useState(false)
  const [sort, setSort] = useState<SortKey>('newest')
  const [tab, setTab] = useState<'closet' | 'outfits' | 'worn' | 'wishlist' | 'stats'>(shared?.wishlist ? 'wishlist' : 'closet')
  const [openOutfitId, setOpenOutfitId] = useState<string>()
  const [openDay, setOpenDay] = useState<string>()
  const [outfitEditor, setOutfitEditor] = useState<{ existing?: Outfit; initialIds?: string[] }>()
  const [selected, setSelected] = useState<string[]>()
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    if (shared) history.replaceState(null, '', location.pathname)
  }, [shared])

  const owned = useMemo(() => closet.items.filter((item) => !item.wishlist && !item.archived), [closet.items])
  const archived = useMemo(
    () => closet.items.filter((item) => !item.wishlist && item.archived).sort((a, b) => (b.archived ?? '').localeCompare(a.archived ?? '')),
    [closet.items],
  )
  const days = useMemo(() => wornDays(closet.items.filter((item) => !item.wishlist)), [closet.items])
  const wanted = useMemo(() => closet.items.filter((item) => item.wishlist), [closet.items])
  const wantedTotal = useMemo(() => {
    const priced = wanted.filter((item) => item.price !== undefined)
    const currencies = new Set(priced.map((item) => (item.currency ?? 'USD').toUpperCase()))
    if (currencies.size !== 1) return undefined
    return formatPrice(priced.reduce((sum, item) => sum + (item.price ?? 0), 0), [...currencies][0])
  }, [wanted])

  const counts = useMemo(() => {
    const result = new Map<string, number>()
    for (const item of owned) result.set(item.category, (result.get(item.category) ?? 0) + 1)
    return result
  }, [owned])

  const visible = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const matches = owned.filter((item) => {
      if (category !== 'All' && item.category !== category) return false
      if (color && !itemColors(item).includes(color)) return false
      if (season && !item.seasons.includes(season)) return false
      const haystack = [item.name, item.brand, item.category, ...itemColors(item), item.notes, item.size].join(' ').toLowerCase()
      return words.every((word) => haystack.includes(word))
    })
    return sortItemsBy(matches, sort)
  }, [category, owned, color, query, season, sort])

  const openItem = closet.items.find((item) => item.id === openId)
  const usedColors = COLORS.filter((candidate) => owned.some((item) => itemColors(item).includes(candidate.name)))
  const filtersActive = Boolean(color || season) || sort !== 'newest'

  const byId = new Map(closet.items.map((item) => [item.id, item]))
  const openDayItems = days.find(({ day }) => day === openDay)?.items
  const openOutfit = closet.outfits.find((outfit) => outfit.id === openOutfitId)

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+10rem)]">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">{{ closet: 'Closet', outfits: 'Outfits', worn: 'Worn', wishlist: 'Wishlist', stats: 'Stats' }[tab]}</h1>
          <p className="text-sm text-stone-500">
            {tab === 'closet' || tab === 'stats'
              ? `${owned.length} ${owned.length === 1 ? 'item' : 'items'}`
              : tab === 'outfits'
                ? `${closet.outfits.length} ${closet.outfits.length === 1 ? 'outfit' : 'outfits'}`
                : tab === 'worn'
                  ? `${days.length} ${days.length === 1 ? 'day' : 'days'} logged`
                : `${wanted.length} ${wanted.length === 1 ? 'item' : 'items'}${wantedTotal ? ` · ${wantedTotal}` : ''}`}
            {closet.syncStatus === 'error' && ' · sync paused'}
          </p>
        </div>
        <button
          onClick={() => setShowAccount(true)}
          aria-label="Account"
          className="grid h-10 w-10 place-items-center rounded-full bg-surface text-stone-700 shadow-sm ring-1 ring-stone-200"
        >
          {auth.user ? (
            <span className="font-bold">{(auth.user.email ?? 'Y').slice(0, 1).toUpperCase()}</span>
          ) : (
            <UserIcon className="h-5 w-5" />
          )}
        </button>
      </header>

      {tab === 'closet' && owned.length > 0 && !showArchived && (
        <>
          <div className="mt-4 flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl bg-surface px-3 ring-1 ring-stone-200 focus-within:ring-2 focus-within:ring-stone-900">
              <SearchIcon className="h-4 w-4 text-stone-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your closet"
                className="w-full bg-transparent py-2.5 text-base outline-none placeholder:text-stone-400"
              />
            </label>
            <button
              onClick={() => {
                setSelected(selected ? undefined : [])
                setConfirmBulkDelete(false)
              }}
              className={`rounded-xl px-3 text-sm font-semibold ring-1 ${selected ? 'bg-stone-900 text-stone-50 ring-stone-900' : 'bg-surface text-stone-600 ring-stone-200'}`}
            >
              Select
            </button>
            <button
              onClick={() => setShowFilters((value) => !value)}
              aria-label="Filters"
              className={`grid w-11 place-items-center rounded-xl ring-1 ${filtersActive || showFilters ? 'bg-stone-900 text-stone-50 ring-stone-900' : 'bg-surface text-stone-600 ring-stone-200'}`}
            >
              <SlidersIcon className="h-5 w-5" />
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 rounded-2xl bg-surface p-3.5 ring-1 ring-stone-200">
              <div className="text-xs font-semibold tracking-wide text-stone-400 uppercase">Color</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {usedColors.length ? (
                  usedColors.map((candidate) => (
                    <button
                      key={candidate.name}
                      aria-label={candidate.name}
                      onClick={() => setColor(color === candidate.name ? undefined : candidate.name)}
                      className={`rounded-full p-0.5 ring-2 ${color === candidate.name ? 'ring-stone-900' : 'ring-transparent'}`}
                    >
                      <Swatch name={candidate.name} size="h-7 w-7" />
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-stone-400">No colors yet</span>
                )}
              </div>
              <div className="mt-3 text-xs font-semibold tracking-wide text-stone-400 uppercase">Sort</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {SORTS.map(([key, label]) => (
                  <Chip key={key} active={sort === key} onClick={() => setSort(key)}>
                    {label}
                  </Chip>
                ))}
              </div>
              <div className="mt-3 text-xs font-semibold tracking-wide text-stone-400 uppercase">Season</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {SEASONS.map((candidate) => (
                  <Chip key={candidate} active={season === candidate} onClick={() => setSeason(season === candidate ? undefined : candidate)}>
                    {candidate}
                  </Chip>
                ))}
              </div>
              {filtersActive && (
                <button
                  onClick={() => {
                    setColor(undefined)
                    setSeason(undefined)
                    setSort('newest')
                  }}
                  className="mt-3 text-sm font-semibold text-stone-500"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={category === 'All'} onClick={() => setCategory('All')}>
              All
            </Chip>
            {CATEGORIES.filter((candidate) => counts.has(candidate)).map((candidate) => (
              <Chip key={candidate} active={category === candidate} onClick={() => setCategory(candidate)}>
                {candidate} <span className="opacity-50">{counts.get(candidate)}</span>
              </Chip>
            ))}
          </div>
        </>
      )}

      {tab === 'stats' ? (
        <StatsView items={owned} outfits={closet.outfits} onOpen={(item) => setOpenId(item.id)} />
      ) : tab === 'wishlist' ? (
        wanted.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {wanted.map((item) => (
              <ItemCard key={item.id} item={item} detail={formatPrice(item.price, item.currency) ?? item.brand} onOpen={() => setOpenId(item.id)} />
            ))}
          </div>
        ) : (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-surface text-stone-400 shadow-sm ring-1 ring-stone-200">
              <HeartIcon className="h-9 w-9" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-stone-900">Nothing on your wishlist</h2>
            <p className="mt-1 max-w-xs text-sm text-stone-500">Save links to things you want. Tap “Bought it” when you get one and it moves into your closet.</p>
          </div>
        )
      ) : tab === 'worn' ? (
        <WornView days={days} onOpen={setOpenDay} />
      ) : tab === 'outfits' ? (
        <OutfitsView
          outfits={closet.outfits}
          byId={byId}
          canShuffle={owned.length > 0}
          onOpen={(outfit) => setOpenOutfitId(outfit.id)}
          onShuffle={() => setOutfitEditor({ initialIds: shuffleOutfit(owned).map((item) => item.id) })}
        />
      ) : showArchived ? (
        <>
          <div className="mt-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-500">
              Archived <span className="text-stone-400">{archived.length}</span>
            </h2>
            <button onClick={() => setShowArchived(false)} className="text-sm font-semibold text-stone-800">
              Back to closet
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {archived.map((item) => (
              <ItemCard key={item.id} item={item} detail={[item.archiveReason, item.archived && dayLabel(item.archived)].filter(Boolean).join(' · ')} onOpen={() => setOpenId(item.id)} />
            ))}
          </div>
        </>
      ) : owned.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : visible.length === 0 ? (
        <p className="mt-16 text-center text-stone-400">Nothing matches.</p>
      ) : (
        groupItems(visible, sort).map((group) => (
          <section key={group.label || 'all'}>
            {group.label && (
              <h2 className="mt-5 mb-[-4px] text-sm font-semibold text-stone-500">
                {group.label} <span className="text-stone-400">{group.items.length}</span>
              </h2>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {group.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  detail={sort.endsWith('worn') ? wearDetail(item) : undefined}
                  selected={selected?.includes(item.id)}
                  onOpen={() =>
                    selected
                      ? (setSelected(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id]), setConfirmBulkDelete(false))
                      : setOpenId(item.id)
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}

      {tab === 'closet' && !showArchived && !selected && archived.length > 0 && (
        <button onClick={() => setShowArchived(true)} className="mt-6 w-full rounded-xl bg-surface py-3 text-sm font-semibold text-stone-600 ring-1 ring-stone-200">
          Archived · {archived.length} {archived.length === 1 ? 'item' : 'items'} you no longer have
        </button>
      )}

      {tab === 'closet' && selected && selected.length > 0 && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface py-2 pr-2 pl-4 shadow-xl ring-1 ring-stone-200">
          <span className="text-sm font-semibold text-stone-800">{selected.length}</span>
          <button
            onClick={() => {
              selected.forEach((id) => closet.patchItem(id, { wishlist: true }))
              setSelected(undefined)
            }}
            className="rounded-full bg-stone-100 px-3.5 py-2 text-sm font-semibold text-stone-800"
          >
            To wishlist
          </button>
          <button
            onClick={() => {
              if (!confirmBulkDelete) return setConfirmBulkDelete(true)
              selected.forEach((id) => {
                const item = closet.items.find((candidate) => candidate.id === id)
                if (item) closet.deleteItem(item)
              })
              setSelected(undefined)
              setConfirmBulkDelete(false)
            }}
            className="rounded-full bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white"
          >
            {confirmBulkDelete ? 'Sure?' : 'Delete'}
          </button>
        </div>
      )}

      {!(tab === 'closet' && (selected?.length || showArchived)) && tab !== 'stats' && tab !== 'worn' && (tab !== 'outfits' || owned.length > 0) && (
        <button
          onClick={() => (tab === 'outfits' ? setOutfitEditor({}) : setAdding(true))}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-stone-900 py-3.5 pr-6 pl-5 font-semibold text-stone-50 shadow-xl shadow-stone-900/25 active:scale-95"
        >
          <PlusIcon className="h-5 w-5" /> {tab === 'closet' ? 'Add item' : tab === 'outfits' ? 'New outfit' : 'Add to wishlist'}
        </button>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200/80 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {(
            [
              ['closet', 'Closet', HangerIcon],
              ['outfits', 'Outfits', LayersIcon],
              ['worn', 'Worn', CalendarIcon],
              ['wishlist', 'Wishlist', HeartIcon],
              ['stats', 'Stats', ChartIcon],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => (setTab(id), setShowArchived(false))}
              aria-current={tab === id ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${tab === id ? 'text-stone-900' : 'text-stone-400'}`}
            >
              <Icon className="h-6 w-6" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {adding && (
        <AddSheet
          title={tab === 'wishlist' ? 'Add to wishlist' : 'Add to closet'}
          initialLink={shared?.text}
          onClose={() => {
            setAdding(false)
            setShared(undefined)
          }}
          onSave={(draft, photos) => {
            const existing = draft.url
              ? closet.items.find((item) => item.url === draft.url && Boolean(item.wishlist) === (tab === 'wishlist'))
              : undefined
            // Re-importing a link swaps the cover but keeps any extra shots already on the item.
            const merged = !photos?.length ? undefined : existing?.photos ? [photos[0], ...existing.photos, ...photos.slice(1)] : photos
            // A link import knows nothing about archiving, so an archived item stays archived.
            const kept = existing?.archived ? { ...draft, archived: existing.archived, archiveReason: existing.archiveReason } : draft
            return closet.saveItem(tab === 'wishlist' ? { ...kept, wishlist: true } : kept, merged, existing)
          }}
        />
      )}
      {openItem && (
        <ItemSheet
          item={openItem}
          onClose={() => setOpenId(undefined)}
          onSave={closet.saveItem}
          onDelete={closet.deleteItem}
          onToggleWorn={(worn) => closet.setWorn([openItem.id], dayKey(), worn)}
          onLogDay={(day) => closet.setWorn([openItem.id], day, true)}
          onBought={() => closet.patchItem(openItem.id, { wishlist: false })}
          onArchive={(archiveReason) => closet.patchItem(openItem.id, { archived: dayKey(), archiveReason })}
          onRestore={() => closet.patchItem(openItem.id, { archived: undefined, archiveReason: undefined })}
        />
      )}
      {outfitEditor && (
        <Sheet onClose={() => setOutfitEditor(undefined)}>
          <OutfitEditor
            items={closet.items}
            existing={outfitEditor.existing}
            initialIds={outfitEditor.initialIds}
            onCancel={() => setOutfitEditor(undefined)}
            onSave={(draft, existing) => {
              const saved = closet.saveOutfit({ ...draft, name: draft.name.trim() || existing?.name || `Outfit ${closet.outfits.length + 1}` }, existing)
              setOutfitEditor(undefined)
              setOpenOutfitId(saved.id)
            }}
          />
        </Sheet>
      )}
      {openOutfit && !outfitEditor && !openItem && (
        <Sheet onClose={() => setOpenOutfitId(undefined)}>
          <OutfitSheet
            outfit={openOutfit}
            items={openOutfit.itemIds.map((id) => byId.get(id)).filter((item): item is Item => Boolean(item))}
            onEdit={() => setOutfitEditor({ existing: openOutfit })}
            onDelete={() => {
              closet.deleteOutfit(openOutfit)
              setOpenOutfitId(undefined)
            }}
            onOpenItem={(item) => setOpenId(item.id)}
            onToggleWorn={(worn) => closet.setWorn(openOutfit.itemIds, dayKey(), worn, openOutfit.id)}
          />
        </Sheet>
      )}
      {openDay && openDayItems && !outfitEditor && !openItem && (
        <Sheet onClose={() => setOpenDay(undefined)}>
          <WornDaySheet
            day={openDay}
            items={openDayItems}
            onOpenItem={(item) => setOpenId(item.id)}
            onSaveOutfit={() => {
              setOutfitEditor({ initialIds: openDayItems.map((item) => item.id) })
              setOpenDay(undefined)
            }}
          />
        </Sheet>
      )}
      {showAccount && (
        <AccountSheet
          user={auth.user}
          loading={auth.loading}
          configured={auth.cloudConfigured}
          error={auth.error}
          syncStatus={closet.syncStatus}
          onSendCode={auth.sendEmailCode}
          onVerifyCode={auth.verifyEmailCode}
          onSignOut={auth.signOut}
          onClose={() => setShowAccount(false)}
        />
      )}
    </div>
  )
}

function wearDetail(item: Item) {
  const count = wearCount(item)
  return count ? `${count}× · ${wornLabel(item.wears).replace(/^Worn /, '')}` : 'Never worn'
}

function ItemCard({ item, detail, selected, onOpen }: { item: Item; detail?: string; selected?: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-pressed={selected}
      className={`group overflow-hidden rounded-2xl bg-surface text-left shadow-sm ring-1 active:scale-[0.98] ${selected ? 'ring-2 ring-stone-900' : 'ring-stone-200/70'}`}
    >
      <div className="relative aspect-[4/5] bg-stone-100/70">
        <ItemImage item={item} className="h-full w-full p-3" />
        {selected !== undefined && (
          <span className={`absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${selected ? 'bg-stone-900 text-stone-50' : 'bg-surface text-transparent ring-1 ring-stone-300'}`}>✓</span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <div className="truncate text-sm font-semibold text-stone-900">{item.name}</div>
        <div className="truncate text-xs text-stone-500">{detail ?? item.brand ?? item.category}</div>
      </div>
    </button>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-20 flex flex-col items-center text-center">
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-surface text-stone-800 shadow-sm ring-1 ring-stone-200">
        <HangerIcon className="h-10 w-10" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-stone-900">Your closet is empty</h2>
      <p className="mt-1.5 max-w-xs text-stone-500">Paste a link from any store or snap a photo of something you own.</p>
      <button onClick={onAdd} className="mt-6 rounded-full bg-stone-900 px-6 py-3 font-semibold text-stone-50">
        Add your first item
      </button>
    </div>
  )
}

function readSharedLink() {
  const params = new URLSearchParams(location.search)
  const text = [params.get('add'), params.get('text'), params.get('url')].filter(Boolean).join(' ').trim()
  return text ? { text, wishlist: params.get('to') === 'wishlist' } : undefined
}
