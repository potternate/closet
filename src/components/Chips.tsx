import { COLORS, type ColorName } from '../lib/types'

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
        active ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 active:bg-stone-100'
      }`}
    >
      {children}
    </button>
  )
}

export function Swatch({ name, size = 'h-8 w-8' }: { name: ColorName; size?: string }) {
  const color = COLORS.find((candidate) => candidate.name === name)!
  return <span className={`block rounded-full ring-1 ring-black/10 ${size}`} style={{ background: color.hex }} />
}

export function ColorPicker({ value, onChange }: { value?: ColorName; onChange: (value?: ColorName) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {COLORS.map((color) => (
        <button
          key={color.name}
          type="button"
          aria-label={color.name}
          title={color.name}
          onClick={() => onChange(value === color.name ? undefined : color.name)}
          className={`rounded-full p-0.5 ring-2 transition ${value === color.name ? 'ring-stone-900' : 'ring-transparent'}`}
        >
          <Swatch name={color.name} />
        </button>
      ))}
    </div>
  )
}
