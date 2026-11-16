import assert from 'node:assert/strict'
import test from 'node:test'
import type { Item } from './types.ts'
import { costPerWear, dayKey, sortItemsBy, toggleDay, wornLabel } from './wear.ts'

const item = (id: string, wears: string[] | undefined, createdAt = 0, price?: number): Item => ({
  id,
  name: id,
  category: 'Tops',
  seasons: [],
  wears,
  price,
  createdAt,
  updatedAt: createdAt,
})

test('dayKey uses the local calendar date', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 30)), '2026-01-05')
})

test('toggleDay adds once, keeps order and removes', () => {
  assert.deepEqual(toggleDay(['2026-03-02'], '2026-03-01', true), ['2026-03-01', '2026-03-02'])
  assert.deepEqual(toggleDay(['2026-03-01'], '2026-03-01', true), ['2026-03-01'])
  assert.deepEqual(toggleDay(['2026-03-01', '2026-03-02'], '2026-03-01', false), ['2026-03-02'])
  assert.deepEqual(toggleDay(undefined, '2026-03-01', false), [])
})

test('wornLabel describes the last wear', () => {
  assert.equal(wornLabel(undefined, '2026-03-10'), 'Never worn')
  assert.equal(wornLabel(['2026-03-10'], '2026-03-10'), 'Worn today')
  assert.equal(wornLabel(['2026-03-09'], '2026-03-10'), 'Worn yesterday')
  assert.equal(wornLabel(['2026-02-28', '2026-01-01'], '2026-03-10'), 'Worn 10 days ago')
})

test('costPerWear divides price by wears', () => {
  assert.equal(costPerWear(item('a', ['2026-01-01', '2026-01-02'], 0, 100)), 50)
  assert.equal(costPerWear(item('a', [], 0, 100)), undefined)
  assert.equal(costPerWear(item('a', ['2026-01-01'])), undefined)
  assert.equal(costPerWear(item('a', ['2026-01-01'], 0, 0)), 0)
})

test('sorts by wear, falling back to newest', () => {
  const items = [item('never-old', undefined, 1), item('twice', ['2026-01-01', '2026-02-01'], 2), item('once-recent', ['2026-03-01'], 3), item('never-new', [], 4)]
  const ids = (key: Parameters<typeof sortItemsBy>[1]) => sortItemsBy(items, key).map((candidate) => candidate.id)
  assert.deepEqual(ids('newest'), ['never-new', 'once-recent', 'twice', 'never-old'])
  assert.deepEqual(ids('least-worn'), ['never-new', 'never-old', 'once-recent', 'twice'])
  assert.deepEqual(ids('most-worn'), ['twice', 'once-recent', 'never-new', 'never-old'])
  assert.deepEqual(ids('recently-worn'), ['once-recent', 'twice', 'never-new', 'never-old'])
})

test('brand and color sorts group items', async () => {
  const { groupItems } = await import('./wear.ts')
  const items = [
    { ...item('a', [], 3), brand: 'nike' },
    { ...item('b', [], 2), brand: undefined },
    { ...item('c', [], 1), brand: 'Arc’teryx' },
    { ...item('d', [], 0), brand: 'Nike' },
  ]
  const groups = groupItems(sortItemsBy(items, 'brand'), 'brand')
  assert.deepEqual(groups.map((g) => [g.label, g.items.map((i) => i.id)]), [
    ['Arc’teryx', ['c']],
    ['nike', ['a', 'd']],
    ['No brand', ['b']],
  ])
  assert.deepEqual(groupItems(items, 'newest').map((g) => g.label), [''])
})
