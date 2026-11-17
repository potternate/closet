import { useEffect, useState } from 'react'
import { imageUrl } from '../lib/store'
import { itemPhotos, type Item, type ItemPhoto } from '../lib/types'
import { HangerIcon } from './icons'

export function useImageUrl(image: ItemPhoto | undefined) {
  const [url, setUrl] = useState<string>()
  const key = image ? `${image.id}:${image.path ?? ''}` : ''
  useEffect(() => {
    if (!image) {
      setUrl(undefined)
      return
    }
    let active = true
    let objectUrl: string | undefined
    void imageUrl(image).then((next) => {
      if (next?.startsWith('blob:')) objectUrl = next
      if (active) setUrl(next)
      else if (objectUrl) URL.revokeObjectURL(objectUrl)
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [key])
  return url
}

export function ItemImage({ item, photo = item.image, className = '' }: { item: Item; photo?: ItemPhoto; className?: string }) {
  const url = useImageUrl(photo)
  if (!photo) {
    return (
      <div className={`grid place-items-center text-stone-300 ${className}`}>
        <HangerIcon className="h-10 w-10" />
      </div>
    )
  }
  if (!url) return <div className={`animate-pulse bg-stone-100 ${className}`} />
  return (
    <img
      src={url}
      alt={item.name}
      className={`object-contain ${photo.type === 'image/jpeg' ? 'mix-blend-multiply' : 'drop-shadow-[0_6px_10px_rgba(0,0,0,0.12)]'} ${className}`}
      draggable={false}
    />
  )
}

/** An item's photos, swipeable with dots when there's more than one; the cover alone otherwise. */
export function PhotoSwiper({ item, className = '', imageClassName = '', small = false }: { item: Item; className?: string; imageClassName?: string; small?: boolean }) {
  const photos = itemPhotos(item)
  const [index, setIndex] = useState(0)
  const [reached, setReached] = useState(0)
  if (photos.length < 2) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <ItemImage item={item} className={`absolute inset-0 h-full w-full ${imageClassName}`} />
      </div>
    )
  }
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(event) => {
          const next = Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth)
          setIndex(next)
          setReached((prev) => Math.max(prev, next))
        }}
      >
        {photos.map((photo, i) => (
          <div key={photo.id} className="relative h-full w-full shrink-0 snap-center">
            {/* Load photos only up to one past the furthest swiped to. */}
            {i <= reached + 1 && <ItemImage item={item} photo={photo} className={`absolute inset-0 h-full w-full ${imageClassName}`} />}
          </div>
        ))}
      </div>
      <div className={`pointer-events-none absolute inset-x-0 flex justify-center ${small ? 'bottom-1.5 gap-1' : 'bottom-3 gap-1.5'}`}>
        {photos.map((photo, dot) => (
          <span key={photo.id} className={`rounded-full ${small ? 'h-1 w-1' : 'h-1.5 w-1.5'} ${dot === index ? 'bg-stone-800' : 'bg-stone-300'}`} />
        ))}
      </div>
    </div>
  )
}
