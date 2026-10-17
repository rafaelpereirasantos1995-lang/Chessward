// Rating pessoal (Elo). Começa no nível mais baixo e sobe com partidas no modo Desafio.

export const START_RATING = 400
const FLOOR = 100

export function expected(me: number, opp: number): number {
  return 1 / (1 + Math.pow(10, (opp - me) / 400))
}

/** K alto nas primeiras partidas para o rating achar seu nível rápido. */
export function kFactor(games: number): number {
  if (games < 10) return 60
  if (games < 30) return 40
  return 24
}

/** score: 1 vitória, 0.5 empate, 0 derrota. */
export function newRating(me: number, opp: number, score: number, games: number): number {
  return Math.max(FLOOR, Math.round(me + kFactor(games) * (score - expected(me, opp))))
}
