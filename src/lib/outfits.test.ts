import assert from 'node:assert/strict'
import test from 'node:test'
import { collageColumns, shuffleOutfit } from './outfits.ts'
import type { Category, Item } from './types.ts'

const item = (id: string, category: Category): Item => ({ id, name: id, category, seasons: [], createdAt: 0, updatedAt: 0 })
const closet = [item('tee', 'Tops'), item('jeans', 'Bottoms'), item('af1', 'Shoes'), item('puffer', 'Outerwear'), item('cap', 'Accessories')]

test('shuffle picks a top, bottoms and shoes in head-to-toe order', () => {
  assert.deepEqual(shuffleOutfit(closet, () => 0.99).map((piece) => piece.id), ['tee', 'jeans', 'af1'])
  assert.deepEqual(shuffleOutfit(closet, () => 0).map((piece) => piece.id), ['cap', 'puffer', 'tee', 'jeans', 'af1'])
})

test('shuffle skips categories the closet does not have', () => {
  assert.deepEqual(shuffleOutfit([item('af1', 'Shoes')], () => 0.99).map((piece) => piece.id), ['af1'])
  assert.deepEqual(shuffleOutfit([], () => 0), [])
})

test('collage puts shoes and accessories beside the clothes', () => {
  const columns = collageColumns(closet).map((column) => column.map((piece) => piece.id))
  assert.deepEqual(columns, [['puffer', 'tee', 'jeans'], ['cap', 'af1']])
  assert.deepEqual(collageColumns([item('tee', 'Tops')]).map((column) => column.length), [1])
})
