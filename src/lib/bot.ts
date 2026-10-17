import { Chess } from 'chess.js'
import { toCp } from './analysis'
import type { Engine } from './engine'

export interface BotLevel {
  elo: number
  name: string
  /** Níveis abaixo de 1320 (mínimo do UCI_Elo do Stockfish) usam enfraquecimento próprio. */
  depth?: number
  /** Chance de jogar um lance legal qualquer. */
  randomness?: number
  /** "Temperatura" da escolha entre os melhores lances (cp): maior = mais erros. */
  temperature?: number
}

export const BOT_LEVELS: BotLevel[] = [
  { elo: 250, name: 'Novato', depth: 1, randomness: 0.35, temperature: 250 },
  { elo: 400, name: 'Iniciante', depth: 2, randomness: 0.25, temperature: 200 },
  { elo: 550, name: 'Aprendiz', depth: 3, randomness: 0.18, temperature: 160 },
  { elo: 700, name: 'Casual', depth: 4, randomness: 0.12, temperature: 120 },
  { elo: 850, name: 'Clube I', depth: 5, randomness: 0.08, temperature: 90 },
  { elo: 1000, name: 'Clube II', depth: 6, randomness: 0.05, temperature: 60 },
  { elo: 1150, name: 'Clube III', depth: 8, randomness: 0.03, temperature: 40 },
  { elo: 1320, name: 'Intermediário' },
  { elo: 1500, name: 'Avançado' },
  { elo: 1700, name: 'Forte' },
  { elo: 1900, name: 'Especialista' },
  { elo: 2100, name: 'Candidato a Mestre' },
  { elo: 2400, name: 'Mestre' },
  { elo: 2800, name: 'Campeão' },
]

export const levelByElo = (elo: number) => BOT_LEVELS.find((l) => l.elo === elo) ?? BOT_LEVELS[0]

/** Nível cujo rating é o mais próximo do jogador. */
export function suggestedLevel(rating: number): BotLevel {
  return BOT_LEVELS.reduce((best, l) => (Math.abs(l.elo - rating) < Math.abs(best.elo - rating) ? l : best))
}

/** `timeLeft`: tempo restante da máquina no relógio (ms), para ela não perder por tempo. */
export async function chooseBotMove(engine: Engine, fen: string, level: BotLevel, rnd = Math.random, timeLeft?: number): Promise<string | null> {
  if (level.depth === undefined) {
    const normal = 400 + Math.min(1200, (level.elo - 1300) / 1.5)
    const res = await engine.analyze({
      fen,
      movetime: timeLeft === undefined ? normal : Math.max(50, Math.min(normal, timeLeft / 40)),
      options: { UCI_LimitStrength: true, UCI_Elo: level.elo },
    })
    return res?.bestmove ?? null
  }

  const chess = new Chess(fen)
  if (rnd() < (level.randomness ?? 0)) {
    const moves = chess.moves({ verbose: true })
    const m = moves[Math.floor(rnd() * moves.length)]
    return m.from + m.to + (m.promotion ?? '')
  }
  const res = await engine.analyze({ fen, depth: level.depth, multipv: 8, options: { UCI_LimitStrength: false } })
  if (!res) return null
  if (res.lines.length === 0) return res.bestmove
  const sign = chess.turn() === 'w' ? 1 : -1
  const scores = res.lines.map((l) => Math.max(-2000, Math.min(2000, toCp(l.score) * sign)))
  const top = Math.max(...scores)
  const weights = scores.map((s) => Math.exp((s - top) / (level.temperature ?? 50)))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rnd() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return res.lines[i].pv[0]
  }
  return res.lines[0].pv[0]
}
