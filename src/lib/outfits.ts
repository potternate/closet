import type { Category, Item } from './types'

export interface Outfit {
  id: string
  name: string
  itemIds: string[]
  notes?: string
  wears?: string[]
  createdAt: number
  updatedAt: number
}

export type OutfitDraft = Pick<Outfit, 'name' | 'itemIds' | 'notes'>

const ORDER: Category[] = ['Accessories', 'Outerwear', 'Tops', 'Dresses', 'Activewear', 'Bottoms', 'Bags', 'Shoes', 'Other']
const SIDE: Category[] = ['Accessories', 'Bags', 'Shoes']

export const sortForOutfit = (items: Item[]) => [...items].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category))

export function collageColumns(items: Item[]) {
  const sorted = sortForOutfit(items)
  const main = sorted.filter((item) => !SIDE.includes(item.category))
  const side = sorted.filter((item) => SIDE.includes(item.category))
  return [main, side].filter((column) => column.length)
}

export function shuffleOutfit(items: Item[], random = Math.random): Item[] {
  const pick = (category: Category) => {
    const pool = items.filter((item) => item.category === category)
    return pool.length ? pool[Math.floor(random() * pool.length)] : undefined
  }
  const has = (category: Category) => items.some((item) => item.category === category)
  const dress = has('Dresses') && (!has('Tops') || random() < 0.3)
  const picks = dress ? [pick('Dresses')] : [pick('Tops'), pick('Bottoms')]
  picks.push(pick('Shoes'))
  if (random() < 0.5) picks.push(pick('Outerwear'))
  if (random() < 0.4) picks.push(pick('Accessories'))
  return sortForOutfit(picks.filter((item): item is Item => Boolean(item)))
}
