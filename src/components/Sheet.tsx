import type { ReactNode } from 'react'

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-stone-900/40" onClick={onClose} />
      <div className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-stone-200" />
        {children}
      </div>
    </div>
  )
}
