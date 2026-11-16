import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { deleteLocalImage, loadLocalImage, saveLocalImage, type PreparedImage } from './images'
import type { Outfit, OutfitDraft } from './outfits'
import type { Draft, Item } from './types'
import { toggleDay } from './wear'

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error'

interface Collection<T> {
  records: T[]
  deleted: Record<string, number>
  dirty: string[]
}

interface State {
  items: Item[]
  deleted: Record<string, number>
  dirty: string[]
  trash: string[]
  outfits: Collection<Outfit>
}

const BUCKET = 'closet-photos'
const GUEST_KEY = 'closet:v1'
const storageKey = (userId?: string) => (userId ? `${GUEST_KEY}:user:${userId}` : GUEST_KEY)
const emptyCollection = <T>(): Collection<T> => ({ records: [], deleted: {}, dirty: [] })
const emptyState = (): State => ({ items: [], deleted: {}, dirty: [], trash: [], outfits: emptyCollection() })

function load(key: string): State {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<State>
    return {
      items: parsed.items ?? [],
      deleted: parsed.deleted ?? {},
      dirty: parsed.dirty ?? [],
      trash: parsed.trash ?? [],
      outfits: { ...emptyCollection<Outfit>(), ...parsed.outfits },
    }
  } catch {
    return emptyState()
  }
}

function persist(key: string, state: State) {
  localStorage.setItem(key, JSON.stringify(state))
}

class StaleSync extends Error {}

const sortItems = <T extends { createdAt: number }>(items: T[]) => [...items].sort((a, b) => b.createdAt - a.createdAt)
const markDirty = (dirty: string[], id: string) => (dirty.includes(id) ? dirty : [...dirty, id])

interface Row<T> {
  id: string
  data: T
  deleted: boolean
  updated_at: string
}

type Synced = { id: string; createdAt: number; updatedAt: number }

function mergeRecords<T extends Synced>(local: Collection<T>, rows: Row<T>[]): Collection<T> {
  const records = new Map(local.records.map((record) => [record.id, record]))
  const deleted = { ...local.deleted }
  const dirty = new Set(local.dirty)
  for (const row of rows) {
    const remoteTime = row.deleted ? new Date(row.updated_at).getTime() : row.data.updatedAt
    const localTime = records.get(row.id)?.updatedAt ?? deleted[row.id] ?? -1
    if (localTime > remoteTime) {
      dirty.add(row.id)
      continue
    }
    dirty.delete(row.id)
    if (row.deleted) {
      records.delete(row.id)
      deleted[row.id] = remoteTime
    } else {
      records.set(row.id, row.data)
      delete deleted[row.id]
    }
  }
  const remoteIds = new Set(rows.map((row) => row.id))
  for (const id of [...records.keys(), ...Object.keys(deleted)]) if (!remoteIds.has(id)) dirty.add(id)
  return { records: sortItems([...records.values()]), deleted, dirty: [...dirty] }
}

function merge(local: State, rows: Row<Item>[]): State {
  const merged = mergeRecords({ records: local.items, deleted: local.deleted, dirty: local.dirty }, rows)
  return { ...local, items: merged.records, deleted: merged.deleted, dirty: merged.dirty }
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
    const accountKey = storageKey(userId)
    const ensureSameAccount = () => {
      if (keyRef.current !== accountKey) throw new StaleSync()
    }
    try {
      const { data, error } = await supabase.from('closet_items').select('id, data, deleted, updated_at')
      if (error) throw error
      ensureSameAccount()
      let current = merge(stateRef.current, (data ?? []) as Row<Item>[])
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
          ensureSameAccount()
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
          ensureSameAccount()
          current = stateRef.current
          commit({ ...current, dirty: current.dirty.filter((dirtyId) => dirtyId !== id) })
        }
        current = stateRef.current
      }
      const { data: outfitRows, error: outfitError } = await supabase.from('closet_outfits').select('id, data, deleted, updated_at')
      if (outfitError) throw outfitError
      ensureSameAccount()
      commit({ ...stateRef.current, outfits: mergeRecords(stateRef.current.outfits, (outfitRows ?? []) as Row<Outfit>[]) })
      for (const id of stateRef.current.outfits.dirty) {
        const outfits = stateRef.current.outfits
        const outfit = outfits.records.find((candidate) => candidate.id === id)
        const deletedAt = outfits.deleted[id]
        if (!outfit && !deletedAt) continue
        const { error: outfitUpsertError } = await supabase.from('closet_outfits').upsert({
          user_id: userId,
          id,
          data: outfit ?? { id },
          deleted: !outfit,
          updated_at: new Date(outfit?.updatedAt ?? deletedAt).toISOString(),
        })
        if (outfitUpsertError) throw outfitUpsertError
        ensureSameAccount()
        const latest = stateRef.current.outfits
        const unchanged = outfit ? latest.records.find((candidate) => candidate.id === id)?.updatedAt === outfit.updatedAt : latest.deleted[id] === deletedAt
        if (unchanged) commit({ ...stateRef.current, outfits: { ...latest, dirty: latest.dirty.filter((dirtyId) => dirtyId !== id) } })
      }
      const trash = stateRef.current.trash
      if (trash.length && !stateRef.current.dirty.length) {
        const { error: removeError } = await supabase.storage.from(BUCKET).remove(trash)
        if (removeError) throw removeError
        ensureSameAccount()
        current = stateRef.current
        commit({ ...current, trash: current.trash.filter((path) => !trash.includes(path)) })
      }
      setSyncStatus('synced')
    } catch (error) {
      if (error instanceof StaleSync) return
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
      if (guest.items.length || guest.outfits.records.length) {
        const known = new Set(next.items.map((item) => item.id))
        const moved = guest.items.filter((item) => !known.has(item.id))
        const knownOutfits = new Set(next.outfits.records.map((outfit) => outfit.id))
        const movedOutfits = guest.outfits.records.filter((outfit) => !knownOutfits.has(outfit.id))
        next = {
          ...next,
          items: sortItems([...next.items, ...moved]),
          dirty: [...new Set([...next.dirty, ...moved.map((item) => item.id)])],
          outfits: {
            ...next.outfits,
            records: sortItems([...next.outfits.records, ...movedOutfits]),
            dirty: [...new Set([...next.outfits.dirty, ...movedOutfits.map((outfit) => outfit.id)])],
          },
        }
        localStorage.removeItem(GUEST_KEY)
      }
    }
    commit(next)
    setSyncStatus(userId ? 'syncing' : 'local')
    void sync()
  }, [authLoading, commit, key, sync, userId])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== keyRef.current) return
      const next = load(keyRef.current)
      stateRef.current = next
      setState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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
      const replaced = image ? existing?.image : undefined
      if (image) {
        const id = crypto.randomUUID()
        await saveLocalImage(id, image.blob)
        nextImage = { id, type: image.type }
      }
      if (replaced) void deleteLocalImage(replaced.id)
      const item: Item = {
        ...draft,
        wears: stateRef.current.items.find((candidate) => candidate.id === existing?.id)?.wears ?? draft.wears,
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
        trash: trashPath(current.trash, replaced),
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
        ...current,
        items: current.items.filter((candidate) => candidate.id !== item.id),
        deleted: { ...current.deleted, [item.id]: Date.now() },
        dirty: markDirty(current.dirty, item.id),
        trash: trashPath(current.trash, item.image),
      })
      if (item.image) void deleteLocalImage(item.image.id)
      void sync()
    },
    [commit, sync],
  )

  const saveOutfit = useCallback(
    (draft: OutfitDraft, existing?: Outfit) => {
      const now = Date.now()
      const outfit: Outfit = {
        ...existing,
        ...draft,
        name: draft.name.trim() || 'Outfit',
        id: existing?.id ?? crypto.randomUUID(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      const current = stateRef.current
      commit({
        ...current,
        outfits: {
          ...current.outfits,
          records: sortItems([outfit, ...current.outfits.records.filter((candidate) => candidate.id !== outfit.id)]),
          dirty: markDirty(current.outfits.dirty, outfit.id),
        },
      })
      void sync()
      return outfit
    },
    [commit, sync],
  )

  const deleteOutfit = useCallback(
    (outfit: Outfit) => {
      const current = stateRef.current
      commit({
        ...current,
        outfits: {
          records: current.outfits.records.filter((candidate) => candidate.id !== outfit.id),
          deleted: { ...current.outfits.deleted, [outfit.id]: Date.now() },
          dirty: markDirty(current.outfits.dirty, outfit.id),
        },
      })
      void sync()
    },
    [commit, sync],
  )

  const setWorn = useCallback(
    (itemIds: string[], day: string, worn: boolean, outfitId?: string) => {
      const now = Date.now()
      const ids = new Set(itemIds)
      const current = stateRef.current
      let dirty = current.dirty
      const items = current.items.map((item) => {
        if (!ids.has(item.id)) return item
        dirty = markDirty(dirty, item.id)
        return { ...item, wears: toggleDay(item.wears, day, worn), updatedAt: now }
      })
      const outfits = outfitId
        ? {
            ...current.outfits,
            records: current.outfits.records.map((outfit) =>
              outfit.id === outfitId ? { ...outfit, wears: toggleDay(outfit.wears, day, worn), updatedAt: now } : outfit,
            ),
            dirty: markDirty(current.outfits.dirty, outfitId),
          }
        : current.outfits
      commit({ ...current, items, dirty, outfits })
      void sync()
    },
    [commit, sync],
  )

  return { setWorn, items: state.items, outfits: state.outfits.records, syncStatus, saveItem, deleteItem, saveOutfit, deleteOutfit }
}

function trashPath(trash: string[], image: Item['image']) {
  return image?.path && !trash.includes(image.path) ? [...trash, image.path] : trash
}
