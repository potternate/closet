export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'closet-theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export const getThemePref = (): ThemePref => {
  const stored = localStorage.getItem(KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export function applyTheme(pref = getThemePref()) {
  const dark = pref === 'dark' || (pref === 'system' && media().matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c0a09' : '#f5f5f4')
}

export function setThemePref(pref: ThemePref) {
  if (pref === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, pref)
  applyTheme(pref)
}

export function watchSystemTheme() {
  media().addEventListener('change', () => applyTheme())
}
