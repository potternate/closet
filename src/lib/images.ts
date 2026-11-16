import { del, get, set } from 'idb-keyval'
import { COLORS, type ColorName } from './types'

const MAX_SIDE = 1200

export interface PreparedImage {
  blob: Blob
  type: 'image/png' | 'image/jpeg'
}

const imageKey = (id: string) => `closet-image:${id}`

export const saveLocalImage = (id: string, blob: Blob) => set(imageKey(id), blob)
export const loadLocalImage = (id: string) => get<Blob>(imageKey(id))
export const deleteLocalImage = (id: string) => del(imageKey(id))

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Couldn’t read that image'))), type, quality),
  )
}

async function bitmapOf(blob: Blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('That file isn’t a photo we can read')
  }
}

export async function prepareImage(blob: Blob): Promise<PreparedImage> {
  const bitmap = await bitmapOf(blob)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')!
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return { blob: await toBlob(canvas, 'image/jpeg', 0.85), type: 'image/jpeg' }
}

async function trimTransparent(blob: Blob): Promise<Blob> {
  const bitmap = await bitmapOf(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
  let top = height
  let left = width
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right < 0) throw new Error('Couldn’t find the item in that photo')
  const pad = Math.round(Math.max(right - left, bottom - top) * 0.04)
  left = Math.max(0, left - pad)
  top = Math.max(0, top - pad)
  right = Math.min(width - 1, right + pad)
  bottom = Math.min(height - 1, bottom + pad)
  const cropW = right - left + 1
  const cropH = bottom - top + 1
  const scale = Math.min(1, MAX_SIDE / Math.max(cropW, cropH))
  const out = document.createElement('canvas')
  out.width = Math.round(cropW * scale)
  out.height = Math.round(cropH * scale)
  out.getContext('2d')!.drawImage(canvas, left, top, cropW, cropH, 0, 0, out.width, out.height)
  return toBlob(out, 'image/png')
}

// RMBG-1.4 (fp16): keeps garments solid where the old ISNet model left them half-transparent.
const CUTOUT_MODEL = 'briaai/RMBG-1.4'

type Transformers = typeof import('@huggingface/transformers')
let segmenter: Promise<{ lib: Transformers; model: any; processor: any }> | undefined
let reportDownload: ((fraction: number) => void) | undefined

function loadSegmenter() {
  segmenter ??= (async () => {
    const lib = await import('@huggingface/transformers')
    const files = new Map<string, number>()
    const progress_callback = (event: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (event.status !== 'progress' || !event.file) return
      files.set(event.file, event.total ? (event.loaded ?? 0) / event.total : 0)
      const values = [...files.values()]
      reportDownload?.(values.reduce((sum, value) => sum + value, 0) / values.length)
    }
    const [model, processor] = await Promise.all([
      lib.AutoModel.from_pretrained(CUTOUT_MODEL, { dtype: 'fp16', device: 'wasm', progress_callback } as never),
      lib.AutoProcessor.from_pretrained(CUTOUT_MODEL, { progress_callback } as never),
    ])
    return { lib, model, processor }
  })().catch((error) => {
    segmenter = undefined
    throw error
  })
  return segmenter
}

export async function cutOut(blob: Blob, onProgress?: (fraction: number) => void): Promise<PreparedImage> {
  reportDownload = onProgress
  const { lib, model, processor } = await loadSegmenter()
  const image = await lib.RawImage.fromBlob(blob)
  const { pixel_values } = await processor(image)
  const { output } = await model({ input: pixel_values })
  const mask = await lib.RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height)
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image.toCanvas() as HTMLCanvasElement, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < mask.data.length; i++) pixels.data[i * 4 + 3] = mask.data[i]
  context.putImageData(pixels, 0, 0)
  return { blob: await trimTransparent(await toBlob(canvas, 'image/png')), type: 'image/png' }
}

export async function dominantColor(blob: Blob): Promise<ColorName | undefined> {
  const bitmap = await bitmapOf(blob)
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(bitmap, 0, 0, size, size)
  bitmap.close()
  const { data } = context.getImageData(0, 0, size, size)
  const counts = new Map<ColorName, number>()
  let hasTransparency = false
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] < 128) hasTransparency = true
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      if (data[i + 3] < 128) continue
      if (!hasTransparency && (x < size * 0.25 || x > size * 0.75 || y < size * 0.2 || y > size * 0.8)) continue
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
      if (!hasTransparency && r > 238 && g > 238 && b > 238) continue
      let best: ColorName = 'Black'
      let bestDistance = Infinity
      for (const color of COLORS) {
        const [cr, cg, cb] = color.rgb
        const distance = (r - cr) ** 2 * 0.3 + (g - cg) ** 2 * 0.59 + (b - cb) ** 2 * 0.11
        if (distance < bestDistance) {
          bestDistance = distance
          best = color.name
        }
      }
      counts.set(best, (counts.get(best) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}
