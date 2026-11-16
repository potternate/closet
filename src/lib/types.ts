export const CATEGORIES = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Bags', 'Accessories', 'Activewear', 'Other'] as const
export type Category = (typeof CATEGORIES)[number]

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const
export type Season = (typeof SEASONS)[number]

export const COLORS = [
  { name: 'Black', hex: '#1c1917', rgb: [28, 25, 23] },
  { name: 'White', hex: '#fafaf9', rgb: [245, 245, 244] },
  { name: 'Gray', hex: '#a8a29e', rgb: [150, 150, 150] },
  { name: 'Beige', hex: '#e7d7b8', rgb: [222, 205, 175] },
  { name: 'Brown', hex: '#8b5e3c', rgb: [120, 80, 50] },
  { name: 'Red', hex: '#dc2626', rgb: [200, 40, 40] },
  { name: 'Burgundy', hex: '#7f1d1d', rgb: [110, 25, 35] },
  { name: 'Pink', hex: '#f9a8d4', rgb: [240, 160, 200] },
  { name: 'Orange', hex: '#f97316', rgb: [235, 120, 40] },
  { name: 'Yellow', hex: '#facc15', rgb: [240, 205, 40] },
  { name: 'Green', hex: '#16a34a', rgb: [50, 140, 70] },
  { name: 'Olive', hex: '#6b7a3a', rgb: [105, 115, 60] },
  { name: 'Blue', hex: '#2563eb', rgb: [45, 95, 210] },
  { name: 'Navy', hex: '#1e3a8a', rgb: [30, 45, 90] },
  { name: 'Purple', hex: '#9333ea', rgb: [130, 60, 190] },
  { name: 'Multi', hex: 'conic-gradient(#dc2626, #facc15, #16a34a, #2563eb, #9333ea, #dc2626)', rgb: [-999, -999, -999] },
] as const
export type ColorName = (typeof COLORS)[number]['name']

export interface Item {
  id: string
  name: string
  category: Category
  color?: ColorName
  brand?: string
  size?: string
  price?: number
  currency?: string
  seasons: Season[]
  url?: string
  notes?: string
  wears?: string[]
  wishlist?: boolean
  image?: { id: string; type: 'image/png' | 'image/jpeg'; path?: string }
  createdAt: number
  updatedAt: number
}

export type Draft = Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'image'>

export const emptyDraft = (): Draft => ({ name: '', category: 'Tops', seasons: [] })

const KEYWORDS: [Category, RegExp][] = [
  ['Activewear', /\b(legging|sports? bra|running|gym|yoga|athletic|workout|track ?pant|jogger)/i],
  ['Shoes', /\b((shoe|sneaker|boot|sandal|loafer|heel|pump|slipper|mule|clog|trainer|runner|oxford|flat|slide)s?|air (force|max)|dunk (low|high)|jordan \d+|yeezy|samba|gazelle|chuck taylor|old skool)\b/i],
  ['Bags', /\b(bag|tote|backpack|purse|clutch|wallet|crossbody|satchel|duffel)s?\b/i],
  ['Dresses', /\b(dress|gown|jumpsuit|romper)(es|s)?\b/i],
  ['Outerwear', /\b(jacket|coat|parka|blazer|vest|puffer|anorak|trench|windbreaker|fleece|gilet|shacket|overshirt)s?\b/i],
  ['Bottoms', /\b(pant|jean|short|skirt|trouser|chino|slack|cargo|sweatpant|denim)s?\b/i],
  ['Accessories', /\b(hat|cap|beanie|scarf|belt|sunglass|glasses|watch|necklace|bracelet|ring|earring|tie|glove|sock|jewelry)s?\b/i],
  ['Tops', /\b(shirt|tee|t-shirt|top|blouse|sweater|hoodie|sweatshirt|polo|tank|cardigan|pullover|crewneck|henley|jersey|knit|button[- ]down|camisole|turtleneck)s?\b/i],
]

export function guessCategory(text: string): Category | undefined {
  return KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0]
}

export function matchColor(text: string | undefined): ColorName | undefined {
  if (!text) return undefined
  const lower = text.toLowerCase()
  const aliases: [ColorName, RegExp][] = [
    ['Burgundy', /burgundy|maroon|wine|oxblood|bordeaux/],
    ['Navy', /navy|midnight/],
    ['Olive', /olive|khaki|army|sage/],
    ['Beige', /beige|cream|ivory|tan|sand|oat|camel|natural|ecru|bone|stone/],
    ['Gray', /gr[ae]y|charcoal|heather|silver/],
    ['Pink', /pink|rose|blush|magenta|fuchsia/],
    ['Purple', /purple|violet|lilac|lavender|plum/],
    ['Brown', /brown|chocolate|coffee|mocha|cognac|rust/],
    ['Multi', /multi|print|floral|stripe|plaid|camo/],
  ]
  for (const [name, pattern] of aliases) if (pattern.test(lower)) return name
  return COLORS.find((color) => lower.includes(color.name.toLowerCase()))?.name
}

export function formatPrice(price?: number, currency = 'USD') {
  if (price === undefined) return undefined
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: price % 1 ? 2 : 0 }).format(price)
  } catch {
    return `$${price}`
  }
}

const BRANDS = [
  'Nike', 'Jordan', 'Adidas', 'New Balance', 'Asics', 'Converse', 'Vans', 'Puma', 'Reebok', 'Salomon', 'Hoka', 'On', 'Birkenstock',
  'Dr. Martens', 'Timberland', 'UGG', 'Crocs', 'Supreme', 'Stussy', 'Palace', 'Off-White', 'Fear of God', 'Essentials', 'Kith',
  'Carhartt', 'Patagonia', 'The North Face', 'Arc’teryx', "Arc'teryx", 'Canada Goose', 'Moncler', 'Columbia', 'Mountain Hardwear',
  'Levi’s', "Levi's", 'Uniqlo', 'Zara', 'H&M', 'Gap', 'J.Crew', 'Madewell', 'Everlane', 'Aritzia', 'Lululemon', 'Alo', 'Vuori',
  'Ralph Lauren', 'Polo Ralph Lauren', 'Tommy Hilfiger', 'Calvin Klein', 'Gucci', 'Prada', 'Louis Vuitton', 'Balenciaga',
  'Comme des Garcons', 'Stone Island', 'Acne Studios', 'Bape', 'Champion', 'Abercrombie & Fitch', 'American Eagle', 'Allbirds',
]

export function guessBrand(name: string | undefined) {
  if (!name) return undefined
  const lower = name.toLowerCase()
  return [...BRANDS].sort((a, b) => b.length - a.length).find((brand) => lower.startsWith(`${brand.toLowerCase()} `))
}
