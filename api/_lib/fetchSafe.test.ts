import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPrivateAddress } from './fetchSafe.ts'

test('blocks private and IPv4-mapped IPv6 addresses', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::7f00:1', 'fd00::1', 'fe80::1', 'ff02::1']) {
    assert.equal(isPrivateAddress(address), true, address)
  }
})

test('allows public addresses', () => {
  for (const address of ['93.184.216.34', '::ffff:5db8:d822', '2606:4700::6810:84e5']) {
    assert.equal(isPrivateAddress(address), false, address)
  }
})
