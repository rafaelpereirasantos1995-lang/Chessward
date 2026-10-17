import type { Color } from 'chess.js'
import type { MoveClass, PosEval } from '../lib/analysis'
import type { CoachMsg } from '../lib/coach'

export type Mode = 'treino' | 'desafio'
export type Result = '1-0' | '0-1' | '1/2-1/2'

export interface MoveReview {
  cls: MoveClass
  drop: number
  bestSan?: string
}

/** Partida em andamento ou terminada — tudo o que é preciso para retomá-la em outro aparelho. */
export interface GameSession {
  id: string
  mode: Mode
  botElo: number
  playerColor: Color
  startFen: string
  /** Lances em notação UCI (e2e4, e7e8q…). */
  moves: string[]
  /** Avaliação da posição depois do lance i (0 = posição inicial). */
  evals: Record<number, PosEval>
  /** Classificação do lance i (1 = primeiro lance). */
  reviews: Record<number, MoveReview>
  coach: CoachMsg[]
  status: 'playing' | 'ended'
  result?: Result
  endReason?: string
  ratingBefore?: number
  ratingAfter?: number
  startedAt: number
}

export interface GameRecord {
  id: string
  date: number
  mode: Mode
  botElo: number
  playerColor: Color
  result: Result
  endReason: string
  ratingAfter?: number
  moves: string[]
  startFen: string
}

export interface Settings {
  boardTheme: string
  pieceSet: string
  showCoords: boolean
  sound: boolean
  heatmap: boolean
  preview: boolean
  coach: boolean
}

export interface Profile {
  rating: number
  peak: number
  ratedGames: number
  wins: number
  draws: number
  losses: number
}

export interface AppState {
  version: 1
  /** Momento da última alteração local (ms); usado para decidir qual cópia vence na sincronização. */
  updatedAt: number
  profile: Profile
  settings: Settings
  current: GameSession | null
  history: GameRecord[]
}
