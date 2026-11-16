import { useMemo, useState } from 'react'
import { useAuth } from './lib/auth'
import { useCloset } from './lib/store'
import { CATEGORIES, COLORS, SEASONS, type Category, type ColorName, type Item, type Season } from './lib/types'
import { AccountSheet } from './components/AccountSheet'
import { AddSheet } from './components/AddSheet'
import { Chip, Swatch } from './components/Chips'
import { ItemImage } from './components/ItemImage'
import { ItemSheet } from './components/ItemSheet'
import { HangerIcon, PlusIcon, SearchIcon, SlidersIcon, UserIcon } from './components/icons'

export default function App() {
  const auth = useAuth()
  const closet = useCloset(auth.user?.id, auth.loading)
  const [category, setCategory] = useState<Category | 'All'>('All')
  const [query, setQuery] = useState('')
  const [color, setColor] = useState<ColorName>()
  const [season, setSeason] = useState<Season>()
  const [showFilters, setShowFilters] = useState(false)
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string>()
  const [showAccount, setShowAccount] = useState(false)

  const counts = useMemo(() => {
    const result = new Map<string, number>()
    for (const item of closet.items) result.set(item.category, (result.get(item.category) ?? 0) + 1)
    return result
  }, [closet.items])

  const visible = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return closet.items.filter((item) => {
      if (category !== 'All' && item.category !== category) return false
      if (color && item.color !== color) return false
      if (season && !item.seasons.includes(season)) return false
      const haystack = [item.name, item.brand, item.category, item.color, item.notes, item.size].join(' ').toLowerCase()
      return words.every((word) => haystack.includes(word))
    })
  }, [category, closet.items, color, query, season])

  const openItem = closet.items.find((item) => item.id === openId)
  const usedColors = COLORS.filter((candidate) => closet.items.some((item) => item.color === candidate.name))
  const filtersActive = Boolean(color || season)

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Closet</h1>
          <p className="text-sm text-stone-500">
            {closet.items.length} {closet.items.length === 1 ? 'item' : 'items'}
            {closet.syncStatus === 'error' && ' · sync paused'}
          </p>
        </div>
        <button
          onClick={() => setShowAccount(true)}
          aria-label="Account"
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-stone-700 shadow-sm ring-1 ring-stone-200"
        >
          {auth.user ? (
            <span className="font-bold">{(auth.user.email ?? 'Y').slice(0, 1).toUpperCase()}</span>
          ) : (
            <UserIcon className="h-5 w-5" />
          )}
        </button>
      </header>

      {closet.items.length > 0 && (
        <>
          <div className="mt-4 flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-stone-200 focus-within:ring-2 focus-within:ring-stone-900">
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
              className={`grid w-11 place-items-center rounded-xl ring-1 ${filtersActive || showFilters ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-600 ring-stone-200'}`}
            >
              <SlidersIcon className="h-5 w-5" />
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 rounded-2xl bg-white p-3.5 ring-1 ring-stone-200">
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
                  }}
                  className="mt-3 text-sm font-semibold text-stone-500"
                >
                  Clear filters
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

      {closet.items.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : visible.length === 0 ? (
        <p className="mt-16 text-center text-stone-400">Nothing matches.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((item) => (
            <ItemCard key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
          ))}
        </div>
      )}

      <button
        onClick={() => setAdding(true)}
        aria-label="Add item"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-stone-900 py-3.5 pr-6 pl-5 font-semibold text-white shadow-xl shadow-stone-900/25 active:scale-95"
      >
        <PlusIcon className="h-5 w-5" /> Add item
      </button>

      {adding && <AddSheet onClose={() => setAdding(false)} onSave={(draft, image) => closet.saveItem(draft, image)} />}
      {openItem && (
        <ItemSheet item={openItem} onClose={() => setOpenId(undefined)} onSave={closet.saveItem} onDelete={closet.deleteItem} />
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

function ItemCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-stone-200/70 active:scale-[0.98]">
      <div className="aspect-[4/5] bg-stone-100/70">
        <ItemImage item={item} className="h-full w-full p-3" />
      </div>
      <div className="px-3 py-2.5">
        <div className="truncate text-sm font-semibold text-stone-900">{item.name}</div>
        <div className="truncate text-xs text-stone-500">{item.brand ?? item.category}</div>
      </div>
    </button>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-20 flex flex-col items-center text-center">
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white text-stone-800 shadow-sm ring-1 ring-stone-200">
        <HangerIcon className="h-10 w-10" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-stone-900">Your closet is empty</h2>
      <p className="mt-1.5 max-w-xs text-stone-500">Paste a link from any store or snap a photo of something you own.</p>
      <button onClick={onAdd} className="mt-6 rounded-full bg-stone-900 px-6 py-3 font-semibold text-white">
        Add your first item
      </button>
    </div>
  )
}
