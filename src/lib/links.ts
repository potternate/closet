export function extractLinks(text: string) {
  const links = (text.match(/https?:\/\/[^\s<>"']+/gi) ?? []).map((link) => link.replace(/[).,;!?]+$/, ''))
  return [...new Set(links)]
}
