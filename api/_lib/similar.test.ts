import assert from 'node:assert/strict'
import { test } from 'node:test'
import { colorNames, rankSimilar, sizesIn } from './similar.ts'

const closet = [
  { id: 'af1', name: 'Nike Air Force 1 Skeleton', brand: 'Nike', category: 'Shoes', colors: ['White'], url: 'https://www.nike.com/t/af1-skeleton/abc' },
  { id: 'samba', name: 'Adidas Samba OG Kith Classics Sneakers', brand: 'Adidas', category: 'Shoes', colors: ['White', 'Black'], size: '12' },
  { id: 'boots', name: 'Timberland Black Boots', brand: 'Timberland', category: 'Shoes', colors: ['Black'], size: '12' },
  { id: 'puffer', name: 'Arc’teryx Black Puffer Jacket', brand: 'Arc’teryx', category: 'Outerwear', colors: ['Black'] },
  { id: 'tee', name: 'Mooji Mooji Navy Tee', brand: 'Mooji Mooji', category: 'Tops', colors: ['Navy'], size: 'L' },
  { id: 'tee2', name: 'Supreme Box Tee', brand: 'Supreme', category: 'Tops', colors: ['Red'], size: 'L' },
  { id: 'tee3', name: 'Gap Tee', brand: 'Gap', category: 'Tops', colors: ['Gray'], size: 'XL' },
]

test('same product link is a duplicate even with a different name', () => {
  const [top] = rankSimilar({ name: 'AF1 Low', url: 'https://nike.com/t/af1-skeleton/abc/' }, closet)
  assert.equal(top.item.id, 'af1')
  assert.equal(top.match, 'duplicate')
})

test('same brand and model words beat same category', () => {
  const ranked = rankSimilar({ name: 'adidas Samba OG Cloud White', brand: 'adidas', category: 'Shoes', colors: ['White'] }, closet)
  assert.equal(ranked[0].item.id, 'samba')
  assert.equal(ranked[0].match, 'duplicate')
  assert.ok(ranked.some((match) => match.item.id === 'af1' && match.match === 'similar'))
})

test('brand matching ignores apostrophes and accents', () => {
  const [top] = rankSimilar({ name: 'Arcteryx Cerium Down Jacket', brand: "Arc'teryx", category: 'Outerwear', colors: ['Black'] }, closet)
  assert.equal(top.item.id, 'puffer')
  assert.equal(top.match, 'similar')
})

test('nothing close returns nothing', () => {
  assert.deepEqual(rankSimilar({ name: 'Silk scarf', brand: 'Hermès', category: 'Accessories', colors: ['Orange'] }, closet), [])
})

test('free-text colors map to closet colors', () => {
  assert.deepEqual(colorNames('Natural Grey / Off White'), ['Gray', 'White'])
  assert.deepEqual(colorNames('Sail'), [])
})

test('sizes owned in a category, most common first', () => {
  assert.deepEqual(sizesIn('Tops', closet), [{ size: 'L', count: 2 }, { size: 'XL', count: 1 }])
  assert.deepEqual(sizesIn(undefined, closet), [])
})
