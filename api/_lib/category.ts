// Category guessed from a product name; shared by the app's import and the API's similarity check.
export const CATEGORY_KEYWORDS = [
  ['Activewear', /\b(legging|sports? bra|running|gym|yoga|athletic|workout|track ?pant|jogger)/i],
  ['Shoes', /\b((shoe|sneaker|boot|sandal|loafer|heel|pump|slipper|mule|clog|trainer|runner|oxford|flat|slide)s?|air (force|max)|dunk (low|high)|jordan \d+|yeezy|samba|gazelle|chuck taylor|old skool)\b/i],
  ['Bags', /\b(bag|tote|backpack|purse|clutch|wallet|crossbody|satchel|duffel)s?\b/i],
  ['Dresses', /\b(dress|gown|jumpsuit|romper)(es|s)?\b/i],
  ['Outerwear', /\b(jacket|coat|parka|blazer|vest|puffer|anorak|trench|windbreaker|fleece|gilet|shacket|overshirt)s?\b/i],
  ['Bottoms', /\b(pant|jean|short|skirt|trouser|chino|slack|cargo|sweatpant|denim)s?\b/i],
  ['Accessories', /\b(hat|cap|beanie|scarf|belt|sunglass|glasses|watch|necklace|bracelet|ring|earring|tie|glove|sock|jewelry)s?\b/i],
  ['Tops', /\b(shirt|tee|t-shirt|top|blouse|sweater|hoodie|sweatshirt|polo|tank|cardigan|pullover|crewneck|henley|jersey|knit|button[- ]down|camisole|turtleneck)s?\b/i],
] as const

export function guessCategory(text: string) {
  return CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0]
}
