import { useSyncExternalStore } from 'react'
import { START_RATING } from '../lib/rating'
import type { AppState } from './types'

const KEY = 'chessward:state'

export function defaultState(): AppState {
  return {
    version: 1,
    updatedAt: 0,
    profile: { rating: START_RATING, peak: START_RATING, ratedGames: 0, wins: 0, draws: 0, losses: 0 },
    settings: { boardTheme: 'madeira', pieceSet: 'cburnett', showCoords: true, sound: true, heatmap: true, preview: true, coach: true },
    current: null,
    history: [],
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      const d = defaultState()
      return { ...d, ...parsed, settings: { ...d.settings, ...parsed.settings }, profile: { ...d.profile, ...parsed.profile } }
    }
  } catch {
    // Armazenamento indisponível (modo privado etc.): segue com o estado padrão.
  }
  return defaultState()
}

let state: AppState = typeof localStorage === 'undefined' ? defaultState() : load()
const listeners = new Set<() => void>()
/** Ouvintes de alterações feitas neste aparelho (a sincronização usa para enviar à nuvem). */
const localChangeListeners = new Set<(s: AppState) => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Ignora: o app continua funcionando só em memória.
  }
}

export function getState() {
  return state
}

/** Alteração feita pelo usuário neste aparelho. */
export function update(fn: (s: AppState) => AppState) {
  state = { ...fn(state), updatedAt: Date.now() }
  persist()
  for (const l of listeners) l()
  for (const l of localChangeListeners) l(state)
}

/** Substitui o estado por uma cópia vinda da nuvem (não dispara novo envio). */
export function replaceFromRemote(next: AppState) {
  const d = defaultState()
  state = { ...d, ...next, settings: { ...d.settings, ...next.settings }, profile: { ...d.profile, ...next.profile } }
  persist()
  for (const l of listeners) l()
}

export function onLocalChange(fn: (s: AppState) => void) {
  localChangeListeners.add(fn)
  return () => localChangeListeners.delete(fn)
}

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state))
}
