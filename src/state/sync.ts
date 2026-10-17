import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { getState, onLocalChange, replaceFromRemote } from './store'
import type { AppState } from './types'

// Sincronização entre aparelhos via Supabase. O estado inteiro (perfil, configurações e a
// partida em andamento) é salvo numa linha por usuário; vence a cópia alterada por último.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const cloudAvailable = Boolean(url && key)

const TABLE = 'chessward_state'
let client: SupabaseClient | null = null

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error'
interface SyncInfo {
  status: SyncStatus
  user: User | null
  lastSync: number | null
  error?: string
}

let info: SyncInfo = { status: cloudAvailable ? 'signed-out' : 'off', user: null, lastSync: null }
const listeners = new Set<() => void>()
function setInfo(patch: Partial<SyncInfo>) {
  info = { ...info, ...patch }
  for (const l of listeners) l()
}

export function useSync(): SyncInfo {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => info,
  )
}

async function pull(): Promise<void> {
  if (!client || !info.user) return
  if (!navigator.onLine) return setInfo({ status: 'offline' })
  setInfo({ status: 'syncing' })
  const { data, error } = await client.from(TABLE).select('state').eq('user_id', info.user.id).maybeSingle()
  if (error) return setInfo({ status: 'error', error: error.message })
  const remote = data?.state as AppState | undefined
  const local = getState()
  if (remote && remote.updatedAt > local.updatedAt) {
    replaceFromRemote(remote)
    setInfo({ status: 'synced', lastSync: Date.now(), error: undefined })
  } else if (!remote || remote.updatedAt < local.updatedAt) {
    await push(local)
  } else {
    setInfo({ status: 'synced', lastSync: Date.now(), error: undefined })
  }
}

let pushing: Promise<void> | null = null
let pendingPush: AppState | null = null

async function push(s: AppState): Promise<void> {
  if (!client || !info.user) return
  if (!navigator.onLine) {
    pendingPush = s
    return setInfo({ status: 'offline' })
  }
  if (pushing) {
    pendingPush = s
    return
  }
  setInfo({ status: 'syncing' })
  pushing = (async () => {
    const { error } = await client!.from(TABLE).upsert({ user_id: info.user!.id, state: s, updated_at: new Date(s.updatedAt).toISOString() })
    setInfo(error ? { status: 'error', error: error.message } : { status: 'synced', lastSync: Date.now(), error: undefined })
  })()
  await pushing
  pushing = null
  if (pendingPush) {
    const next = pendingPush
    pendingPush = null
    await push(next)
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
function schedulePush(s: AppState) {
  clearTimeout(timer)
  timer = setTimeout(() => void push(s), 800)
}

export function initSync() {
  if (!cloudAvailable || client) return
  client = createClient(url!, key!)
  client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null
    const changed = user?.id !== info.user?.id
    setInfo({ user, status: user ? info.status : 'signed-out' })
    if (user && changed) void pull()
  })
  onLocalChange(schedulePush)
  // Ao voltar para o app (ou trocar de aparelho e voltar), busca a versão mais nova.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pull()
    else if (pendingPush || timer) {
      clearTimeout(timer)
      void push(getState())
    }
  })
  window.addEventListener('online', () => void pull())
}

export async function signIn(email: string, password: string) {
  const { error } = await client!.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function signUp(email: string, password: string): Promise<'ok' | 'confirm'> {
  const { data, error } = await client!.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  return data.session ? 'ok' : 'confirm'
}

export async function signOut() {
  await client?.auth.signOut()
}

export const syncNow = () => pull()
