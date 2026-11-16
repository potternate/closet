import { useEffect, useState } from 'react'
import { imageUrl } from '../lib/store'
import type { Item, ItemPhoto } from '../lib/types'
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
