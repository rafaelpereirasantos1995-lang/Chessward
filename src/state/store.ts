import { useSyncExternalStore } from 'react'
import { START_RATING } from '../lib/rating'
import type { AppState } from './types'

const KEY = 'chessward:state'

export function defaultState(): AppState {
  return {
    version: 1,
    updatedAt: 0,
    profile: { rating: START_RATING, peak: START_RATING, ratedGames: 0, wins: 0, draws: 0, losses: 0 },
    settings: { boardTheme: 'madeira', pieceSet: 'cburnett', showCoords: true, sound: true, heatmap: true, preview: true, coach: true, threats: true, tab: 'jogar' },
    current: null,
    history: [],
    puzzles: { rating: START_RATING, peak: START_RATING, played: 0, solved: 0, streak: 0, bestStreak: 0, seen: [], filter: 'random', kind: 'mix', byKind: { attack: { played: 0, solved: 0 }, defense: { played: 0, solved: 0 } }, current: null },
    stats: { ratingHistory: [], puzzleHistory: [], byTheme: {}, moveClasses: {}, openings: {}, harvested: [] },
    mistakes: [],
    training: { endgame: null, endgamesDone: {}, openingCards: {}, opening: null, guess: null, guessBest: null },
  }
}

/** Completa campos que não existiam em versões anteriores do estado salvo. */
function withDefaults(s: AppState): AppState {
  const d = defaultState()
  return { ...d, ...s, settings: { ...d.settings, ...s.settings }, profile: { ...d.profile, ...s.profile }, puzzles: { ...d.puzzles, ...s.puzzles }, stats: { ...d.stats, ...s.stats }, training: { ...d.training, ...s.training } }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      return withDefaults(JSON.parse(raw) as AppState)
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
  state = withDefaults(next)
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
