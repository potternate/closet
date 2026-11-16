import assert from 'node:assert/strict'
import test from 'node:test'
import { extractLinks } from './links.ts'

test('extractLinks finds every link in pasted text', () => {
  const text = `Check out the Nike Dunk on StockX https://stockx.com/nike-dunk?utm_source=app
https://clothbase.com/items/abc, and (https://example.com/a).
https://stockx.com/nike-dunk?utm_source=app`
  assert.deepEqual(extractLinks(text), ['https://stockx.com/nike-dunk?utm_source=app', 'https://clothbase.com/items/abc', 'https://example.com/a'])
  assert.deepEqual(extractLinks('no links here'), [])
})
