import { Chess } from 'chess.js'
import { moveAccuracy, type MoveClass, type PosEval, type Score } from './analysis'
import type { MoveReview } from '../state/types'

// Extrai de uma partida analisada o que alimenta a aba Evolução.

export interface MistakeCard {
  id: string
  gameId: string
  date: number
  /** Posição antes do erro, com o jogador na vez. */
  fen: string
  playedUci: string
  bestUci: string
  /** Avaliação (brancas) da posição com o melhor lance, para aceitar alternativas igualmente boas. */
  bestScore: Score
  cls: MoveClass
  box: number
  due: number
}

export interface GameHarvest {
  classes: Partial<Record<MoveClass, number>>
  accuracy: number | null
  family: string | null
  mistakes: MistakeCard[]
}

interface HarvestInput {
  id: string
  startFen: string
  moves: string[]
  playerColor: 'w' | 'b'
  evals: Record<number, PosEval>
  reviews: Record<number, MoveReview>
}

const uci = (u: string) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })

export function harvestGame(g: HarvestInput, familyOf: (fen: string) => string | null, now = Date.now()): GameHarvest {
  const chess = new Chess(g.startFen)
  const classes: Partial<Record<MoveClass, number>> = {}
  const mistakes: MistakeCard[] = []
  let accSum = 0
  let accN = 0
  let family: string | null = null
  g.moves.forEach((u, idx) => {
    const ply = idx + 1
    const fenBefore = chess.fen()
    const mover = chess.turn()
    chess.move(uci(u))
    family = familyOf(chess.fen()) ?? family
    const r = g.reviews[ply]
    if (!r || mover !== g.playerColor) return
    classes[r.cls] = (classes[r.cls] ?? 0) + 1
    accSum += moveAccuracy(r.drop)
    accN++
    const before = g.evals[ply - 1]
    if ((r.cls === 'mistake' || r.cls === 'blunder') && before?.bestUci && before.bestUci !== u)
      mistakes.push({ id: `${g.id}:${ply}`, gameId: g.id, date: now, fen: fenBefore, playedUci: u, bestUci: before.bestUci, bestScore: before.best, cls: r.cls, box: 0, due: now })
  })
  return { classes, accuracy: accN ? accSum / accN : null, family, mistakes }
}
