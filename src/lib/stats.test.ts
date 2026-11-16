import assert from 'node:assert/strict'
import test from 'node:test'
import { closetStats } from './stats.ts'
import type { Item } from './types.ts'

const item = (id: string, patch: Partial<Item> = {}): Item => ({ id, name: id, category: 'Tops', seasons: [], createdAt: 0, updatedAt: 0, ...patch })

test('closetStats tallies categories, colors and brands', () => {
  const stats = closetStats(
    [
      item('a', { category: 'Shoes', color: 'Black', brand: 'Nike' }),
      item('b', { category: 'Tops', color: 'Black', brand: 'nike ' }),
      item('c', { category: 'Shoes', color: 'White', brand: '' }),
    ],
    [],
  )
  assert.deepEqual(stats.categories, [
    { key: 'Tops', count: 1 },
    { key: 'Shoes', count: 2 },
  ])
  assert.deepEqual(stats.colors[0], { key: 'Black', count: 2 })
  assert.deepEqual(stats.brands, [{ key: 'Nike', count: 2 }])
})

test('multi-color items count toward each color', () => {
  const stats = closetStats([item('a', { color: 'Black', colors: ['Black', 'White'] }), item('b', { color: 'White' })], [])
  assert.deepEqual(stats.colors, [{ key: 'White', count: 2 }, { key: 'Black', count: 1 }])
  const legacyEdit = closetStats([item('a', { color: 'Red', colors: ['Black', 'White'] }), item('b', { colors: ['Black'] })], [])
  assert.deepEqual(legacyEdit.colors, [{ key: 'Red', count: 1 }])
})

test('closetStats sums value in the most common currency and ranks wear', () => {
  const stats = closetStats(
    [
      item('a', { price: 100, currency: 'usd', wears: ['2026-01-01', '2026-01-02'] }),
      item('b', { price: 30, wears: ['2026-01-01'] }),
      item('c', { price: 500, currency: 'EUR', wears: ['2026-01-01', '2026-01-02', '2026-01-03'] }),
      item('d'),
    ],
    [],
  )
  assert.deepEqual(stats.value, { amount: 130, currency: 'USD', priced: 2 })
  assert.equal(stats.wears, 6)
  assert.equal(stats.neverWorn, 1)
  assert.deepEqual(stats.mostWorn.map((i) => i.id), ['c', 'a', 'b'])
  assert.deepEqual(stats.bestValue.map((i) => i.id), ['b', 'a'])
})


test('closetStats counts items per season and items without a season', () => {
  const stats = closetStats(
    [
      item('a', { seasons: ['Summer', 'Spring'] }),
      item('b', { seasons: ['Summer'] }),
      item('c', { seasons: [] }),
    ],
    [],
  )
  assert.deepEqual(stats.seasons.find((row) => row.key === 'Summer'), { key: 'Summer', count: 2 })
  assert.deepEqual(stats.seasons.find((row) => row.key === 'Winter'), { key: 'Winter', count: 0 })
  assert.equal(stats.noSeason, 1)
})
