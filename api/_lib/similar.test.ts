import assert from 'node:assert/strict'
import { test } from 'node:test'
import { colorNames, itemColors, rankSimilar, sizesIn } from './similar.ts'
import { guessCategory } from './category.ts'

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

test('a legacy color edit wins over a stale colors list', () => {
  assert.deepEqual(itemColors({ id: 'x', name: 'Tee', colors: ['Black', 'White'], color: 'Navy' }), ['Navy'])
  assert.deepEqual(itemColors({ id: 'y', name: 'Tee', colors: ['Black', 'White'], color: 'Black' }), ['Black', 'White'])
})

test('variant query params keep links apart, tracking params do not', () => {
  const shop = [{ id: 'v1', name: 'Wool Runner', url: 'https://shop.example.com/products/wool-runner?variant=1&utm_source=x' }]
  assert.equal(rankSimilar({ name: 'Wool Runner', url: 'https://shop.example.com/products/wool-runner?variant=2' }, shop)[0]?.match, 'similar')
  assert.equal(rankSimilar({ name: 'Wool Runner', url: 'https://www.shop.example.com/products/wool-runner/?variant=1' }, shop)[0]?.match, 'duplicate')
})


test('a running shoe is guessed as Shoes, running shorts as Activewear', () => {
  assert.equal(guessCategory('Nike Pegasus 41 Running Shoe'), 'Shoes')
  assert.equal(guessCategory('Running Shorts'), 'Activewear')
})

test('a brand named only in the candidate name still counts as the same brand', () => {
  const shoes = [{ id: 'w', name: 'Clarks Wallabees', brand: 'Clarks', category: 'Shoes', colors: ['Beige'] }]
  const [top] = rankSimilar({ name: 'Clarks Originals Wallabee Boot', category: 'Shoes' }, shoes)
  assert.equal(top?.match, 'similar')
  assert.ok(top?.reasons.includes('same brand'))
  assert.equal(rankSimilar({ name: 'Clarks Originals Wallabee Boot', category: 'Shoes', colors: ['Beige'] }, shoes)[0]?.match, 'duplicate')
})

test('an inferred brand must lead the name: collaborators and color-named brands', () => {
  const kith = [{ id: 'k', name: 'Kith Classics Tee', brand: 'Kith', category: 'Tops', colors: ['White'] }]
  const samba = rankSimilar({ name: 'Adidas Samba OG Kith Classics', category: 'Shoes', colors: ['White'] }, kith)[0]
  assert.ok(!samba?.reasons.includes('same brand'))
  assert.notEqual(samba?.match, 'duplicate')
  const offWhite = [{ id: 'o', name: 'Off-White Arrow Hoodie', brand: 'Off-White', category: 'Tops', colors: ['Black'] }]
  assert.equal(rankSimilar({ name: 'Off-White Arrow Hoodie', category: 'Tops', colors: ['Black'] }, offWhite)[0]?.match, 'duplicate')
})
