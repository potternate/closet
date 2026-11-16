import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseProduct } from './product.ts'

test('reads JSON-LD product data', () => {
  const html = `<html><head><title>Ignored</title>
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite"},{"@type":"Product","name":"Wool Runner &amp; Co","brand":{"@type":"Brand","name":"Allbirds"},"color":"Natural Grey","image":["/img/a.jpg",{"url":"https://cdn.example.com/b.jpg"}],"offers":{"@type":"Offer","price":"98.00","priceCurrency":"USD"}}]}</script>
    </head></html>`
  const product = parseProduct(html, 'https://shop.example.com/products/wool-runner')
  assert.equal(product.name, 'Wool Runner & Co')
  assert.equal(product.brand, 'Allbirds')
  assert.equal(product.color, 'Natural Grey')
  assert.equal(product.price, 98)
  assert.equal(product.currency, 'USD')
  assert.deepEqual(product.images, ['https://shop.example.com/img/a.jpg', 'https://cdn.example.com/b.jpg'])
})

test('falls back to Open Graph tags and strips the site name', () => {
  const html = `<meta property="og:site_name" content="Everlane"><meta content="The Cashmere Crew | Everlane" property="og:title">
    <meta property="og:image" content="//cdn.example.com/crew.jpg"><meta property="product:price:amount" content="$145.00">
    <meta property="product:price:currency" content="USD">`
  const product = parseProduct(html, 'https://www.everlane.com/products/crew')
  assert.equal(product.name, 'The Cashmere Crew')
  assert.equal(product.siteName, 'Everlane')
  assert.equal(product.price, 145)
  assert.deepEqual(product.images, ['https://cdn.example.com/crew.jpg'])
})

test('reads ProductGroup variants', () => {
  const html = `<script type="application/ld+json">[{"@type":"ProductGroup","name":"Tee","hasVariant":[{"@type":"Product","color":"Black","image":"https://x.com/t.jpg","offers":[{"price":25,"priceCurrency":"EUR"}]}]}]</script>`
  const product = parseProduct(html, 'https://x.com/tee')
  assert.equal(product.color, 'Black')
  assert.equal(product.price, 25)
  assert.equal(product.currency, 'EUR')
  assert.deepEqual(product.images, ['https://x.com/t.jpg'])
})

test('names products from share text and URL slugs when the page is blocked', async () => {
  const { nameFromShareText, nameFromUrl, splitTitle } = await import('./fallback.ts')
  assert.equal(
    nameFromShareText('Check out the Nike Air Force 1 Low Supreme Comme des Garcons Shirt available on StockX https://stockx.com/x'),
    'Nike Air Force 1 Low Supreme Comme des Garcons Shirt',
  )
  assert.equal(nameFromUrl(new URL('https://www.mountainhardwear.com/p/mens-stretchdown-light-shacket-2003981.html?x=1')), 'Mens Stretchdown Light Shacket')
  const split = splitTitle({ url: '', images: [], name: 'Arc’teryx - Thorium AR Quilted Nylon Down Jacket - Burgundy Arc’teryx' })
  assert.equal(split.brand, 'Arc’teryx')
  assert.equal(split.name, 'Thorium AR Quilted Nylon Down Jacket')
  assert.equal(split.color, 'Burgundy')
})

test('guesses shoes from sneaker model names and maps burgundy', async () => {
  const { guessCategory, matchColor } = await import('../../src/lib/types.ts')
  assert.equal(guessCategory('Nike Air Force 1 Low Supreme Comme des Garcons Shirt'), 'Shoes')
  assert.equal(guessCategory('Supreme Box Logo Shirt'), 'Tops')
  assert.equal(matchColor('Burgundy'), 'Burgundy')
})
