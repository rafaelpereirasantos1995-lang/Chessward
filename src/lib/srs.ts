// Repetição espaçada (caixas de Leitner): acertou → próxima caixa, revisão mais espaçada;
// errou → volta para a primeira caixa e reaparece no dia seguinte.

const DAY = 24 * 60 * 60 * 1000
export const INTERVALS_DAYS = [1, 3, 7, 21, 60]
export const MASTERED_BOX = INTERVALS_DAYS.length

export interface SrsCard {
  box: number
  due: number
}

export function reviewCard<T extends SrsCard>(card: T, correct: boolean, now = Date.now()): T {
  if (!correct) return { ...card, box: 0, due: now + DAY }
  const box = Math.min(card.box + 1, MASTERED_BOX)
  return { ...card, box, due: now + INTERVALS_DAYS[box - 1] * DAY }
}

export const isDue = (c: SrsCard, now = Date.now()) => c.box < MASTERED_BOX && c.due <= now
