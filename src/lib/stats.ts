import type { Outfit } from './outfits.ts'
import { CATEGORIES, COLORS, type Item } from './types.ts'
import { costPerWear, wearCount } from './wear.ts'

export interface Tally<K extends string = string> {
  key: K
  count: number
}

const tally = <K extends string>(keys: (K | undefined)[]): Tally<K>[] => {
  const counts = new Map<K, number>()
  for (const key of keys) if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  return [...counts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

export function closetStats(items: Item[], outfits: Outfit[]) {
  const priced = items.filter((item) => item.price !== undefined)
  const currency = tally(priced.map((item) => (item.currency ?? 'USD').toUpperCase()))[0]?.key ?? 'USD'
  const sameCurrency = priced.filter((item) => (item.currency ?? 'USD').toUpperCase() === currency)
  const worn = items.filter((item) => wearCount(item) > 0)
  return {
    count: items.length,
    outfits: outfits.length,
    wears: items.reduce((sum, item) => sum + wearCount(item), 0),
    value: { amount: sameCurrency.reduce((sum, item) => sum + (item.price ?? 0), 0), currency, priced: sameCurrency.length },
    categories: tally(items.map((item) => item.category)).sort((a, b) => CATEGORIES.indexOf(a.key) - CATEGORIES.indexOf(b.key)),
    colors: tally(items.map((item) => item.color)),
    brands: tally(items.map((item) => item.brand?.trim() || undefined)).slice(0, 6),
    neverWorn: items.length - worn.length,
    mostWorn: [...worn].sort((a, b) => wearCount(b) - wearCount(a)).slice(0, 3),
    bestValue: worn
      .filter((item) => costPerWear(item) !== undefined && (item.currency ?? 'USD').toUpperCase() === currency)
      .sort((a, b) => costPerWear(a)! - costPerWear(b)!)
      .slice(0, 3),
  }
}

export const colorHex = (name: string) => COLORS.find((color) => color.name === name)?.hex
