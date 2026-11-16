const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' } as const

export const HangerIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M12 7.5a2 2 0 1 0-2-2" />
    <path d="M12 7.5v1.2L3.4 15a1.6 1.6 0 0 0 .9 2.9h15.4a1.6 1.6 0 0 0 .9-2.9L12 8.7" />
  </svg>
)
export const PlusIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} strokeWidth={2.2} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const LinkIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
)
export const CameraIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)
export const PhotosIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="9.5" r="1.5" />
    <path d="m21 16-5-5-9 9" />
  </svg>
)
export const SearchIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
)
export const UserIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
)
export const SparkleIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9 12 3.5Z" />
  </svg>
)
export const SlidersIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
)
export const ShuffleIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5" />
  </svg>
)
export const LayersIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
)
export const HeartIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />
  </svg>
)
export const ChartIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />
  </svg>
)
export const CalendarIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
)
