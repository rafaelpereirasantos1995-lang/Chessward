import type { Color } from 'chess.js'

// Relógio de xadrez salvo junto com a partida. Guarda o tempo restante de cada lado e desde quando
// o relógio do lado da vez está correndo; pausar "congela" o tempo (ex.: ao sair do app).

export interface Clock {
  initial: number
  increment: number
  w: number
  b: number
  /** Momento em que o relógio do lado da vez começou a correr (null = pausado). */
  runningSince: number | null
}

export const TIME_CONTROLS: { id: string; label: string; minutes: number; increment: number }[] = [
  { id: '5+3', label: '5 + 3', minutes: 5, increment: 3 },
  { id: '10+0', label: '10 min', minutes: 10, increment: 0 },
  { id: '15+10', label: '15 + 10', minutes: 15, increment: 10 },
  { id: '30+0', label: '30 min', minutes: 30, increment: 0 },
]

export function newClock(minutes: number, increment: number, now = Date.now()): Clock {
  const ms = minutes * 60_000
  return { initial: ms, increment: increment * 1000, w: ms, b: ms, runningSince: now }
}

export function remaining(c: Clock, side: Color, turn: Color, now = Date.now()): number {
  const base = c[side]
  return side === turn && c.runningSince !== null ? base - (now - c.runningSince) : base
}

/** Depois do lance de `mover`: desconta o tempo gasto, soma o incremento e passa a vez. */
export function afterMove(c: Clock, mover: Color, now = Date.now()): Clock {
  const left = remaining(c, mover, mover, now)
  return { ...c, [mover]: Math.max(0, left) + c.increment, runningSince: now }
}

export function pause(c: Clock, turn: Color, now = Date.now()): Clock {
  if (c.runningSince === null) return c
  return { ...c, [turn]: Math.max(0, remaining(c, turn, turn, now)), runningSince: null }
}

export const resume = (c: Clock, now = Date.now()): Clock => (c.runningSince === null ? { ...c, runningSince: now } : c)

export function formatClock(ms: number): string {
  const t = Math.max(0, ms)
  const m = Math.floor(t / 60000)
  const s = Math.floor((t % 60000) / 1000)
  if (t < 10_000) return `${s}.${Math.floor((t % 1000) / 100)}`
  return `${m}:${String(s).padStart(2, '0')}`
}
