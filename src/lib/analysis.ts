import type { Color } from 'chess.js'

/** Avaliação do motor, sempre do ponto de vista das brancas. */
export interface Score {
  cp?: number
  mate?: number
}

export interface PosEval {
  best: Score
  second?: Score
  bestUci?: string
  depth: number
  /** Plano do adversário se o jogador "passasse a vez" (só no Treino, na vez do jogador). */
  threat?: Threat | null
}

export interface Threat {
  /** Linha do adversário em UCI, a partir da posição com a vez passada. */
  pv: string[]
  /** Avaliação (brancas) se o jogador não fizesse nada. */
  score: Score
  /** A ameaça é relevante: o adversário ganharia bastante chance de vitória. */
  real: boolean
}

/** Uma ameaça é real quando, se o jogador passasse a vez, o adversário ganharia >= 10 pontos de chance de vitória. */
export function isRealThreat(current: Score, ifPass: Score, opponent: 'w' | 'b'): boolean {
  return povWin(ifPass, opponent) - povWin(current, opponent) >= 10
}

export type MoveClass = 'book' | 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

export const CLASS_INFO: Record<MoveClass, { label: string; symbol: string; color: string }> = {
  book: { label: 'Teoria', symbol: '📖', color: '#a8a29e' },
  brilliant: { label: 'Brilhante', symbol: '!!', color: '#22d3ee' },
  great: { label: 'Ótimo', symbol: '!', color: '#60a5fa' },
  best: { label: 'Melhor', symbol: '★', color: '#4ade80' },
  excellent: { label: 'Excelente', symbol: '👍', color: '#86efac' },
  good: { label: 'Bom', symbol: '✓', color: '#bef264' },
  inaccuracy: { label: 'Imprecisão', symbol: '?!', color: '#facc15' },
  mistake: { label: 'Erro', symbol: '?', color: '#fb923c' },
  blunder: { label: 'Capivarada', symbol: '??', color: '#ef4444' },
}

/** Pontuação em centipeões equivalentes (mate vira um valor alto). */
export function toCp(s: Score): number {
  if (s.mate !== undefined) return s.mate > 0 ? 10000 - s.mate : s.mate < 0 ? -10000 - s.mate : 0
  return s.cp ?? 0
}

/** Chance de vitória (0–100) das brancas — fórmula usada pelo Lichess. */
export function winPct(s: Score): number {
  if (s.mate !== undefined) return s.mate > 0 ? 100 : s.mate < 0 ? 0 : 50
  const cp = Math.max(-2000, Math.min(2000, s.cp ?? 0))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

export const povWin = (s: Score, c: Color) => (c === 'w' ? winPct(s) : 100 - winPct(s))

export interface ClassifyInput {
  before: PosEval
  after: PosEval
  mover: Color
  playedUci: string
  /** O lance entrega material (>= 2) de forma consciente. */
  sacrifice: boolean
  inBook: boolean
}

export function classify({ before, after, mover, playedUci, sacrifice, inBook }: ClassifyInput): { cls: MoveClass; drop: number } {
  const wBefore = povWin(before.best, mover)
  const wAfter = povWin(after.best, mover)
  const drop = Math.max(0, wBefore - wAfter)
  if (inBook) return { cls: 'book', drop }
  const isBest = before.bestUci === playedUci
  if ((isBest || drop < 2) && sacrifice && wAfter >= 50 && wBefore < 95) return { cls: 'brilliant', drop }
  if (isBest) {
    if (before.second && wBefore - povWin(before.second, mover) >= 15) return { cls: 'great', drop }
    return { cls: 'best', drop }
  }
  if (drop < 2) return { cls: 'excellent', drop }
  if (drop < 5) return { cls: 'good', drop }
  if (drop < 10) return { cls: 'inaccuracy', drop }
  if (drop < 20) return { cls: 'mistake', drop }
  return { cls: 'blunder', drop }
}

/** Precisão de um lance (0–100) a partir da perda de chance de vitória — fórmula do Lichess. */
export function moveAccuracy(drop: number): number {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669))
}

export function formatScore(s: Score | undefined): string {
  if (!s) return '0.0'
  if (s.mate !== undefined) return `M${Math.abs(s.mate)}`
  const v = (s.cp ?? 0) / 100
  return (v > 0 ? '+' : '') + v.toFixed(1)
}
