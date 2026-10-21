import type { Color } from 'chess.js'
import type { MoveClass, PosEval } from '../lib/analysis'
import type { CoachMsg } from '../lib/coach'
import type { KindChoice, Puzzle, PuzzleKind } from '../lib/puzzle'
import type { MistakeCard } from '../lib/stats'
import type { Clock } from '../lib/clock'

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
  /** Xadrez 960 (sem roque) ou clássico. */
  variant?: 'standard' | '960'
  /** Às cegas: as peças ficam ocultas. */
  blind?: boolean
  clock?: Clock | null
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

/** Desafio (teste) em andamento — salvo a cada lance para retomar em qualquer aparelho. */
export interface PuzzleSession {
  puzzle: Puzzle
  /** Quantos lances da sequência já foram jogados. */
  step: number
  /** Errou pelo menos uma vez (o rating já foi descontado). */
  failed: boolean
  status: 'playing' | 'done'
  /** Último lance do jogador, para o retorno visual (certo/errado). */
  feedback: { uci: string; ok: boolean } | null
  solutionShown: boolean
  ratingBefore: number
  ratingAfter?: number
}

export interface PuzzleStats {
  rating: number
  peak: number
  played: number
  solved: number
  streak: number
  bestStreak: number
  /** Últimos desafios vistos, para não repetir. */
  seen: string[]
  filter: string
  kind: KindChoice
  byKind: Record<PuzzleKind, { played: number; solved: number }>
  current: PuzzleSession | null
}

export interface Settings {
  boardTheme: string
  pieceSet: string
  showCoords: boolean
  sound: boolean
  heatmap: boolean
  preview: boolean
  coach: boolean
  /** Ameaças futuras calculadas pelo motor (mapa dinâmico). */
  threats: boolean
  tab: 'jogar' | 'testes' | 'estudos' | 'treinos' | 'evolucao'
}

export interface Profile {
  rating: number
  peak: number
  ratedGames: number
  wins: number
  draws: number
  losses: number
}

export interface OpeningStat {
  games: number
  wins: number
  draws: number
  losses: number
  accSum: number
  accN: number
}

/** Dados acumulados para a aba Evolução. */
export interface Stats {
  ratingHistory: { t: number; r: number }[]
  puzzleHistory: { t: number; r: number }[]
  byTheme: Record<string, { played: number; solved: number }>
  moveClasses: Partial<Record<MoveClass, number>>
  openings: Record<string, OpeningStat>
  /** Partidas já contabilizadas (para não contar duas vezes). */
  harvested: string[]
}

/** Treinos em andamento e progresso (aba Treinos). */
export interface TrainingState {
  endgame: { id: string; moves: string[]; status: 'playing' | 'done'; success?: boolean; message?: string } | null
  endgamesDone: Record<string, boolean>
  /** Cartões de repetição espaçada das linhas de abertura (chave: família|índice|cor). */
  openingCards: Record<string, { box: number; due: number }>
  opening: { family: string; color: 'w' | 'b'; queue: number[]; index: number; step: number; mistakes: number; lastWrong: string | null } | null
  guess: { game: number; side: 'w' | 'b'; ply: number; score: number; max: number; feedback: { text: string; points: number; master: string; guess: string } | null; done: boolean } | null
  guessBest: number | null
}

export interface AppState {
  version: 1
  /** Momento da última alteração local (ms); usado para decidir qual cópia vence na sincronização. */
  updatedAt: number
  profile: Profile
  settings: Settings
  current: GameSession | null
  history: GameRecord[]
  puzzles: PuzzleStats
  stats: Stats
  /** Erros graves das suas partidas, revisados com repetição espaçada. */
  mistakes: MistakeCard[]
  training: TrainingState
  /** Progresso na seção Estudos: linhas concluídas no modo quiz. */
  studies: Record<string, { develop?: boolean; defend?: boolean }>
}
