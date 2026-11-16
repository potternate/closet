import assert from 'node:assert/strict'
import { test } from 'node:test'
import { itemPhotos, withPhotos, type ItemPhoto } from './types.ts'

const a: ItemPhoto = { id: 'a', type: 'image/png', path: 'u/a.png' }
const b: ItemPhoto = { id: 'b', type: 'image/jpeg' }
const c: ItemPhoto = { id: 'c', type: 'image/png' }

test('itemPhotos puts the cover first and handles legacy single-image items', () => {
  assert.deepEqual(itemPhotos({}), [])
  assert.deepEqual(itemPhotos({ image: a }), [a])
  assert.deepEqual(itemPhotos({ image: a, photos: [b, c] }), [a, b, c])
})

test('withPhotos keeps the first photo as the legacy image field', () => {
  assert.deepEqual(withPhotos([]), { image: undefined, photos: undefined })
  assert.deepEqual(withPhotos([a]), { image: a, photos: undefined })
  assert.deepEqual(withPhotos([b, a, c]), { image: b, photos: [a, c] })
  assert.deepEqual(itemPhotos(withPhotos([b, a, c])), [b, a, c])
})
