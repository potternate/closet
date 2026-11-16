import { COLORS, itemColors, type Item } from './types.ts'

export const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const toggleDay = (days: string[] | undefined, day: string, worn: boolean) =>
  worn ? [...new Set([...(days ?? []), day])].sort() : (days ?? []).filter((other) => other !== day)

export const wearCount = (item: Pick<Item, 'wears'>) => item.wears?.length ?? 0

export const lastWorn = (wears: string[] | undefined) => wears?.reduce<string | undefined>((latest, day) => (!latest || day > latest ? day : latest), undefined)

const toUtc = (day: string) => {
  const [year, month, date] = day.split('-').map(Number)
  return Date.UTC(year, month - 1, date)
}

export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / 86_400_000)

export function wornLabel(wears: string[] | undefined, today = dayKey()) {
  const last = lastWorn(wears)
  if (!last) return 'Never worn'
  const days = daysBetween(last, today)
  if (days <= 0) return 'Worn today'
  if (days === 1) return 'Worn yesterday'
  return `Worn ${days} days ago`
}

export const costPerWear = (item: Pick<Item, 'price' | 'wears'>) => (item.price !== undefined && wearCount(item) ? item.price / wearCount(item) : undefined)

export const SORTS = [
  ['newest', 'Newest'],
  ['least-worn', 'Least worn'],
  ['most-worn', 'Most worn'],
  ['recently-worn', 'Recently worn'],
  ['brand', 'Brand'],
  ['color', 'Color'],
] as const

export type SortKey = (typeof SORTS)[number][0]

export function sortItemsBy(items: Item[], key: SortKey) {
  const last = (item: Item) => lastWorn(item.wears) ?? ''
  const compare: Record<SortKey, (a: Item, b: Item) => number> = {
    newest: () => 0,
    'least-worn': (a, b) => wearCount(a) - wearCount(b) || last(a).localeCompare(last(b)),
    'most-worn': (a, b) => wearCount(b) - wearCount(a) || last(b).localeCompare(last(a)),
    'recently-worn': (a, b) => last(b).localeCompare(last(a)),
    brand: (a, b) => sortable(a.brand?.trim() || NO_BRAND).localeCompare(sortable(b.brand?.trim() || NO_BRAND)),
    color: (a, b) => colorRank(a) - colorRank(b),
  }
  return [...items].sort((a, b) => compare[key](a, b) || b.createdAt - a.createdAt)
}

const NO_BRAND = 'No brand'
const sortable = (label: string) => (label === NO_BRAND ? '\uffff' : label.toLowerCase())
const colorRank = (item: Item) => {
  const index = COLORS.findIndex((color) => color.name === itemColors(item)[0])
  return index === -1 ? COLORS.length : index
}

export function groupLabel(item: Item, key: SortKey) {
  if (key === 'brand') return item.brand?.trim() || NO_BRAND
  if (key === 'color') return itemColors(item)[0] ?? 'No color'
  return undefined
}

export function groupItems(items: Item[], key: SortKey) {
  const groups: { label: string; items: Item[] }[] = []
  for (const item of items) {
    const label = groupLabel(item, key) ?? ''
    const last = groups.at(-1)
    if (last?.label.toLowerCase() === label.toLowerCase()) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

export function wornDays(items: Item[]) {
  const byDay = new Map<string, Item[]>()
  for (const item of items) for (const day of new Set(item.wears ?? [])) byDay.set(day, [...(byDay.get(day) ?? []), item])
  return [...byDay].sort(([a], [b]) => b.localeCompare(a)).map(([day, worn]) => ({ day, items: worn }))
}

export function dayLabel(day: string, today = dayKey()) {
  const days = daysBetween(day, today)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  const [year, month, date] = day.split('-').map(Number)
  const value = new Date(year, month - 1, date)
  return value.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(year !== Number(today.slice(0, 4)) && { year: 'numeric' }) })
}
