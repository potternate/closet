import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { deleteLocalImage, loadLocalImage, saveLocalImage, type PreparedImage } from './images'
import type { Draft, Item } from './types'

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error'

interface State {
  items: Item[]
  deleted: Record<string, number>
  dirty: string[]
}

const BUCKET = 'closet-photos'
const GUEST_KEY = 'closet:v1'
const storageKey = (userId?: string) => (userId ? `${GUEST_KEY}:user:${userId}` : GUEST_KEY)
const emptyState = (): State => ({ items: [], deleted: {}, dirty: [] })

function load(key: string): State {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<State>
    return { items: parsed.items ?? [], deleted: parsed.deleted ?? {}, dirty: parsed.dirty ?? [] }
  } catch {
    return emptyState()
  }
}

function persist(key: string, state: State) {
  localStorage.setItem(key, JSON.stringify(state))
}

const sortItems = (items: Item[]) => [...items].sort((a, b) => b.createdAt - a.createdAt)
const markDirty = (dirty: string[], id: string) => (dirty.includes(id) ? dirty : [...dirty, id])

interface Row {
  id: string
  data: Item
  deleted: boolean
  updated_at: string
}

function merge(local: State, rows: Row[]): State {
  const items = new Map(local.items.map((item) => [item.id, item]))
  const deleted = { ...local.deleted }
  const dirty = new Set(local.dirty)
  for (const row of rows) {
    const remoteTime = row.deleted ? new Date(row.updated_at).getTime() : row.data.updatedAt
    const localTime = items.get(row.id)?.updatedAt ?? deleted[row.id] ?? -1
    if (localTime > remoteTime) {
      dirty.add(row.id)
      continue
    }
    dirty.delete(row.id)
    if (row.deleted) {
      items.delete(row.id)
      deleted[row.id] = remoteTime
    } else {
      items.set(row.id, row.data)
      delete deleted[row.id]
    }
  }
  const remoteIds = new Set(rows.map((row) => row.id))
  for (const id of [...items.keys(), ...Object.keys(deleted)]) if (!remoteIds.has(id)) dirty.add(id)
  return { items: sortItems([...items.values()]), deleted, dirty: [...dirty] }
}

async function uploadImage(userId: string, item: Item) {
  if (!supabase || !item.image || item.image.path) return item.image
  const blob = await loadLocalImage(item.image.id)
  if (!blob) return item.image
  const path = `${userId}/${item.image.id}.${item.image.type === 'image/png' ? 'png' : 'jpg'}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: item.image.type, upsert: true })
  if (error) throw error
  return { ...item.image, path }
}

export async function imageUrl(image: NonNullable<Item['image']>): Promise<string | undefined> {
  const local = await loadLocalImage(image.id)
  if (local) return URL.createObjectURL(local)
  if (!supabase || !image.path) return undefined
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(image.path, 60 * 60)
  if (!data?.signedUrl) return undefined
  void fetch(data.signedUrl)
    .then((response) => (response.ok ? response.blob() : undefined))
    .then((blob) => blob && saveLocalImage(image.id, blob))
    .catch(() => undefined)
  return data.signedUrl
}

export function useCloset(userId: string | undefined, authLoading: boolean) {
  const key = storageKey(userId)
  const [state, setState] = useState<State>(() => load(key))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local')
  const stateRef = useRef(state)
  const keyRef = useRef(key)
  const syncing = useRef(false)
  const resync = useRef(false)
  const syncAgain = useRef<() => void>(() => undefined)

  const commit = useCallback((next: State) => {
    stateRef.current = next
    persist(keyRef.current, next)
    setState(next)
  }, [])

  const sync = useCallback(async () => {
    if (!supabase || !userId) return
    if (syncing.current) {
      resync.current = true
      return
    }
    syncing.current = true
    setSyncStatus('syncing')
    try {
      const { data, error } = await supabase.from('closet_items').select('id, data, deleted, updated_at')
      if (error) throw error
      let current = merge(stateRef.current, (data ?? []) as Row[])
      commit(current)
      for (const id of current.dirty) {
        const item = current.items.find((candidate) => candidate.id === id)
        if (item) {
          const image = await uploadImage(userId, item)
          const uploaded = image === item.image ? item : { ...item, image }
          const { error: upsertError } = await supabase
            .from('closet_items')
            .upsert({ user_id: userId, id, data: uploaded, deleted: false, updated_at: new Date(uploaded.updatedAt).toISOString() })
          if (upsertError) throw upsertError
          current = stateRef.current
          commit({
            ...current,
            items: current.items.map((candidate) => (candidate.id === id && candidate.updatedAt === item.updatedAt ? uploaded : candidate)),
            dirty: current.items.find((candidate) => candidate.id === id)?.updatedAt === item.updatedAt ? current.dirty.filter((dirtyId) => dirtyId !== id) : current.dirty,
          })
        } else if (current.deleted[id]) {
          const deletedAt = current.deleted[id]
          const { error: deleteError } = await supabase
            .from('closet_items')
            .upsert({ user_id: userId, id, data: { id }, deleted: true, updated_at: new Date(deletedAt).toISOString() })
          if (deleteError) throw deleteError
          current = stateRef.current
          commit({ ...current, dirty: current.dirty.filter((dirtyId) => dirtyId !== id) })
        }
        current = stateRef.current
      }
      setSyncStatus('synced')
    } catch (error) {
      console.error(error)
      setSyncStatus('error')
    } finally {
      syncing.current = false
      if (resync.current) {
        resync.current = false
        syncAgain.current()
      }
    }
  }, [commit, userId])

  useEffect(() => {
    syncAgain.current = () => void sync()
  }, [sync])

  useEffect(() => {
    if (authLoading) return
    keyRef.current = key
    let next = load(key)
    if (userId) {
      const guest = load(GUEST_KEY)
      if (guest.items.length) {
        const known = new Set(next.items.map((item) => item.id))
        const moved = guest.items.filter((item) => !known.has(item.id))
        next = { ...next, items: sortItems([...next.items, ...moved]), dirty: [...new Set([...next.dirty, ...moved.map((item) => item.id)])] }
        localStorage.removeItem(GUEST_KEY)
      }
    }
    commit(next)
    setSyncStatus(userId ? 'syncing' : 'local')
    void sync()
  }, [authLoading, commit, key, sync, userId])

  useEffect(() => {
    if (!userId) return
    const onVisible = () => document.visibilityState === 'visible' && void sync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [sync, userId])

  const saveItem = useCallback(
    async (draft: Draft, image: PreparedImage | undefined, existing?: Item) => {
      const now = Date.now()
      let nextImage = existing?.image
      if (image) {
        const id = crypto.randomUUID()
        await saveLocalImage(id, image.blob)
        nextImage = { id, type: image.type }
        if (existing?.image) void removeImage(existing.image)
      }
      const item: Item = {
        ...draft,
        name: draft.name.trim() || draft.category,
        id: existing?.id ?? crypto.randomUUID(),
        image: nextImage,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      const current = stateRef.current
      commit({
        ...current,
        items: sortItems([item, ...current.items.filter((candidate) => candidate.id !== item.id)]),
        dirty: markDirty(current.dirty, item.id),
      })
      void sync()
      return item
    },
    [commit, sync],
  )

  const deleteItem = useCallback(
    (item: Item) => {
      const current = stateRef.current
      commit({
        items: current.items.filter((candidate) => candidate.id !== item.id),
        deleted: { ...current.deleted, [item.id]: Date.now() },
        dirty: markDirty(current.dirty, item.id),
      })
      if (item.image) void removeImage(item.image)
      void sync()
    },
    [commit, sync],
  )

  return { items: state.items, syncStatus, saveItem, deleteItem }
}

async function removeImage(image: NonNullable<Item['image']>) {
  await deleteLocalImage(image.id)
  if (supabase && image.path) await supabase.storage.from(BUCKET).remove([image.path])
}
