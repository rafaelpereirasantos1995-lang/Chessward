import { useSyncExternalStore } from 'react'
import { checkPuzzleMove, fromRow, kindOf, pickPuzzle, puzzlePosition, type KindChoice, type Puzzle, type PuzzleRow } from '../lib/puzzle'
import { newRating } from '../lib/rating'
import { playMoveSound } from '../lib/sound'
import { getState, subscribe, update } from '../state/store'
import type { AppState, PuzzleSession } from '../state/types'

// Modo Testes: desafios em sequência, sem ajuda. Lance certo → o adversário responde e o
// desafio continua até ser resolvido; lance errado → conta como erro (uma vez) e dá para tentar de novo.

let all: Puzzle[] | null = null
let loading: Promise<Puzzle[]> | null = null
const loadListeners = new Set<() => void>()

export function loadPuzzles(): Promise<Puzzle[]> {
  loading ??= fetch('/puzzles.json')
    .then((r) => r.json() as Promise<PuzzleRow[]>)
    .then((rows) => {
      all = rows.map(fromRow)
      for (const l of loadListeners) l()
      return all
    })
  return loading
}

export function usePuzzleCount(): number | null {
  return useSyncExternalStore(
    (fn) => {
      loadListeners.add(fn)
      return () => loadListeners.delete(fn)
    },
    () => all?.length ?? null,
  )
}

function setSession(fn: (p: PuzzleSession) => PuzzleSession) {
  update((s) => (s.puzzles.current ? { ...s, puzzles: { ...s.puzzles, current: fn(s.puzzles.current) } } : s))
}

export async function nextPuzzle() {
  const list = await loadPuzzles()
  const st = getState().puzzles
  // Pular um desafio sem terminar conta como erro.
  if (st.current && st.current.status === 'playing' && !st.current.failed && st.current.step > 1) registerResult(false)
  const now = getState().puzzles
  const p = pickPuzzle(list, now.rating, new Set(now.seen), now.filter, Math.random, now.kind)
  if (!p) return
  update((s) => ({
    ...s,
    puzzles: {
      ...s.puzzles,
      seen: [p.id, ...s.puzzles.seen].slice(0, 400),
      current: { puzzle: p, step: 0, failed: false, status: 'playing', feedback: null, solutionShown: false, ratingBefore: s.puzzles.rating },
    },
  }))
}

export function setKind(kind: KindChoice) {
  update((s) => ({ ...s, puzzles: { ...s.puzzles, kind, filter: 'random' } }))
  void nextPuzzle()
}

export function setFilter(filter: string) {
  update((s) => ({ ...s, puzzles: { ...s.puzzles, filter } }))
  void nextPuzzle()
}

/** Atualiza rating e estatísticas na primeira conclusão (resolveu de primeira = vitória). */
function registerResult(win: boolean) {
  update((s): AppState => {
    const cur = s.puzzles.current
    if (!cur) return s
    const st = s.puzzles
    const rating = newRating(st.rating, cur.puzzle.rating, win ? 1 : 0, st.played)
    const streak = win ? st.streak + 1 : 0
    const k = kindOf(cur.puzzle)
    const byKind = { ...st.byKind, [k]: { played: st.byKind[k].played + 1, solved: st.byKind[k].solved + (win ? 1 : 0) } }
    const byTheme = { ...s.stats.byTheme }
    for (const t of cur.puzzle.themes) {
      if (['oneMove', 'short', 'long', 'veryLong', 'defensiveMove', 'advantage', 'crushing', 'middlegame', 'master', 'masterVsMaster'].includes(t)) continue
      const b = byTheme[t] ?? { played: 0, solved: 0 }
      byTheme[t] = { played: b.played + 1, solved: b.solved + (win ? 1 : 0) }
    }
    const stats = { ...s.stats, byTheme, puzzleHistory: [...s.stats.puzzleHistory, { t: Date.now(), r: rating }].slice(-300) }
    return {
      ...s,
      stats,
      puzzles: {
        ...st,
        rating,
        peak: Math.max(st.peak, rating),
        played: st.played + 1,
        solved: st.solved + (win ? 1 : 0),
        streak,
        bestStreak: Math.max(st.bestStreak, streak),
        byKind,
        current: { ...cur, ratingAfter: rating },
      },
    }
  })
}

function sound(kind: 'move' | 'capture' | 'check' | 'end') {
  if (getState().settings.sound) playMoveSound(kind)
}

export function puzzleMove(uci: string): 'correct' | 'solved' | 'wrong' | null {
  const cur = getState().puzzles.current
  if (!cur || cur.status !== 'playing' || cur.step % 2 === 0) return null
  const result = checkPuzzleMove(cur.puzzle, cur.step, uci)
  if (result === 'wrong') {
    if (!cur.failed) registerResult(false)
    setSession((p) => ({ ...p, failed: true, feedback: { uci, ok: false } }))
    sound('check')
    return result
  }
  // Guarda o lance realmente jogado (pode ser um mate alternativo).
  const moves = [...cur.puzzle.moves]
  moves[cur.step] = uci
  const chess = puzzlePosition({ ...cur.puzzle, moves }, cur.step + 1)
  sound(result === 'solved' ? 'end' : chess.history({ verbose: true }).at(-1)?.captured ? 'capture' : 'move')
  if (result === 'solved') {
    if (!cur.failed) registerResult(true)
    setSession((p) => ({ ...p, puzzle: { ...p.puzzle, moves }, step: p.step + 1, status: 'done', feedback: { uci, ok: true } }))
  } else setSession((p) => ({ ...p, step: p.step + 1, feedback: { uci, ok: true } }))
  return result
}

export function retryPuzzle() {
  setSession((p) => ({ ...p, feedback: null }))
}

export function showSolution() {
  const cur = getState().puzzles.current
  if (!cur || cur.status !== 'playing') return
  if (!cur.failed) registerResult(false)
  setSession((p) => ({ ...p, failed: true, solutionShown: true, feedback: null }))
}

// ---------- Lances automáticos (adversário e solução) ----------

let timer: ReturnType<typeof setTimeout> | null = null
let scheduledFor: string | null = null

function tick() {
  const cur = getState().puzzles.current
  if (!cur || cur.status !== 'playing') return
  const opponentTurn = cur.step % 2 === 0
  if (!opponentTurn && !cur.solutionShown) return
  if (cur.step >= cur.puzzle.moves.length) return
  const tag = `${cur.puzzle.id}:${cur.step}:${cur.solutionShown}`
  if (scheduledFor === tag) return
  scheduledFor = tag
  if (timer) clearTimeout(timer)
  timer = setTimeout(
    () => {
      timer = null
      const now = getState().puzzles.current
      if (!now || `${now.puzzle.id}:${now.step}:${now.solutionShown}` !== tag) return
      const step = now.step + 1
      const done = step >= now.puzzle.moves.length
      const last = puzzlePosition(now.puzzle, step).history({ verbose: true }).at(-1)
      sound(last?.captured ? 'capture' : 'move')
      setSession((p) => ({ ...p, step, status: done ? 'done' : 'playing', feedback: now.solutionShown ? null : p.feedback }))
    },
    cur.step === 0 ? 800 : cur.solutionShown ? 900 : 450,
  )
}

let started = false
export function startPuzzleController() {
  if (started) return
  started = true
  subscribe(() => queueMicrotask(tick))
  tick()
}
