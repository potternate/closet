export interface ProductInfo {
  url: string
  name?: string
  brand?: string
  price?: number
  currency?: string
  color?: string
  description?: string
  siteName?: string
  images: string[]
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string }
    return body.error ?? 'Something went wrong'
  } catch {
    return 'Something went wrong'
  }
}

export async function importProduct(link: string): Promise<ProductInfo> {
  const response = await fetch(`/api/product?url=${encodeURIComponent(link)}`)
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<ProductInfo>
}

export async function fetchProductImage(url: string): Promise<Blob> {
  const response = await fetch(`/api/image?url=${encodeURIComponent(url)}`)
  if (!response.ok) throw new Error(await readError(response))
  return response.blob()
}

export const proxiedImage = (url: string) => `/api/image?url=${encodeURIComponent(url)}`
