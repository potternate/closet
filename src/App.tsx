import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './lib/auth'
import { useCloset } from './lib/store'
import { CATEGORIES, COLORS, formatPrice, SEASONS, type Category, type ColorName, type Item, type Season } from './lib/types'
import { AccountSheet } from './components/AccountSheet'
import { AddSheet } from './components/AddSheet'
import { Chip, Swatch } from './components/Chips'
import { ItemImage } from './components/ItemImage'
import { StatsView } from './components/StatsView'
import { ItemSheet } from './components/ItemSheet'
import { ChartIcon, HangerIcon, HeartIcon, LayersIcon, PlusIcon, SearchIcon, SlidersIcon, UserIcon } from './components/icons'
import { OutfitEditor } from './components/OutfitEditor'
import { OutfitSheet } from './components/OutfitSheet'
import { OutfitsView } from './components/OutfitsView'
import { Sheet } from './components/Sheet'
import { shuffleOutfit, type Outfit } from './lib/outfits'
import { dayKey, groupItems, SORTS, sortItemsBy, wearCount, wornLabel, type SortKey } from './lib/wear'

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
  const [tab, setTab] = useState<'closet' | 'outfits' | 'wishlist' | 'stats'>(shared?.wishlist ? 'wishlist' : 'closet')
  const [openOutfitId, setOpenOutfitId] = useState<string>()
  const [outfitEditor, setOutfitEditor] = useState<{ existing?: Outfit; initialIds?: string[] }>()

  useEffect(() => {
    if (shared) history.replaceState(null, '', location.pathname)
  }, [shared])

  const owned = useMemo(() => closet.items.filter((item) => !item.wishlist), [closet.items])
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
      if (color && item.color !== color) return false
      if (season && !item.seasons.includes(season)) return false
      const haystack = [item.name, item.brand, item.category, item.color, item.notes, item.size].join(' ').toLowerCase()
      return words.every((word) => haystack.includes(word))
    })
    return sortItemsBy(matches, sort)
  }, [category, owned, color, query, season, sort])

  const openItem = closet.items.find((item) => item.id === openId)
  const usedColors = COLORS.filter((candidate) => owned.some((item) => item.color === candidate.name))
  const filtersActive = Boolean(color || season) || sort !== 'newest'

  const byId = new Map(closet.items.map((item) => [item.id, item]))
  const openOutfit = closet.outfits.find((outfit) => outfit.id === openOutfitId)

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+10rem)]">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">{{ closet: 'Closet', outfits: 'Outfits', wishlist: 'Wishlist', stats: 'Stats' }[tab]}</h1>
          <p className="text-sm text-stone-500">
            {tab === 'closet' || tab === 'stats'
              ? `${owned.length} ${owned.length === 1 ? 'item' : 'items'}`
              : tab === 'outfits'
                ? `${closet.outfits.length} ${closet.outfits.length === 1 ? 'outfit' : 'outfits'}`
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

      {tab === 'closet' && owned.length > 0 && (
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
      ) : tab === 'outfits' ? (
        <OutfitsView
          outfits={closet.outfits}
          byId={byId}
          canShuffle={owned.length > 0}
          onOpen={(outfit) => setOpenOutfitId(outfit.id)}
          onShuffle={() => setOutfitEditor({ initialIds: shuffleOutfit(owned).map((item) => item.id) })}
        />
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
                <ItemCard key={item.id} item={item} detail={sort.endsWith('worn') ? wearDetail(item) : undefined} onOpen={() => setOpenId(item.id)} />
              ))}
            </div>
          </section>
        ))
      )}

      {tab !== 'stats' && (tab !== 'outfits' || owned.length > 0) && (
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
              ['wishlist', 'Wishlist', HeartIcon],
              ['stats', 'Stats', ChartIcon],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
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
          onSave={(draft, image) => closet.saveItem(tab === 'wishlist' ? { ...draft, wishlist: true } : draft, image)}
        />
      )}
      {openItem && (
        <ItemSheet
          item={openItem}
          onClose={() => setOpenId(undefined)}
          onSave={closet.saveItem}
          onDelete={closet.deleteItem}
          onToggleWorn={(worn) => closet.setWorn([openItem.id], dayKey(), worn)}
          onBought={() => closet.patchItem(openItem.id, { wishlist: false })}
        />
      )}
      {outfitEditor && (
        <Sheet onClose={() => setOutfitEditor(undefined)}>
          <OutfitEditor
            items={owned}
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

function ItemCard({ item, detail, onOpen }: { item: Item; detail?: string; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group overflow-hidden rounded-2xl bg-surface text-left shadow-sm ring-1 ring-stone-200/70 active:scale-[0.98]">
      <div className="aspect-[4/5] bg-stone-100/70">
        <ItemImage item={item} className="h-full w-full p-3" />
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
