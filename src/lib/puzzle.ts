import { Chess } from 'chess.js'

// Desafios no formato da base do Lichess: `moves[0]` é o lance do adversário que cria a posição;
// depois os lances alternam jogador / adversário. O jogador sempre faz os lances de índice ímpar.

export interface Puzzle {
  id: string
  fen: string
  moves: string[]
  rating: number
  themes: string[]
}

/** Formato compacto de public/puzzles.json: [id, fen, "lances uci", rating, "temas"]. */
export type PuzzleRow = [string, string, string, number, string]

export const fromRow = ([id, fen, moves, rating, themes]: PuzzleRow): Puzzle => ({
  id,
  fen,
  moves: moves.split(' '),
  rating,
  themes: themes ? themes.split(' ') : [],
})

export const uciOf = (m: { from: string; to: string; promotion?: string }) => m.from + m.to + (m.promotion ?? '')

/** Posição depois de `step` lances da sequência. */
export function puzzlePosition(p: Puzzle, step: number): Chess {
  const chess = new Chess(p.fen)
  for (const u of p.moves.slice(0, step)) chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })
  return chess
}

export type MoveCheck = 'correct' | 'solved' | 'wrong'

/** Confere o lance do jogador no passo `step` (ímpar). Qualquer xeque-mate também resolve, como no Lichess. */
export function checkPuzzleMove(p: Puzzle, step: number, uci: string): MoveCheck {
  const last = step === p.moves.length - 1
  if (uci === p.moves[step]) return last ? 'solved' : 'correct'
  const chess = puzzlePosition(p, step)
  try {
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    return 'wrong'
  }
  return chess.isCheckmate() ? 'solved' : 'wrong'
}

export const THEMES: Record<string, string> = {
  mate: 'Xeque-mate',
  mateIn1: 'Mate em 1',
  mateIn2: 'Mate em 2',
  mateIn3: 'Mate em 3',
  mateIn4: 'Mate em 4',
  mateIn5: 'Mate em 5',
  fork: 'Garfo',
  pin: 'Cravada',
  skewer: 'Espeto',
  discoveredAttack: 'Ataque descoberto',
  doubleCheck: 'Xeque duplo',
  hangingPiece: 'Peça pendurada',
  trappedPiece: 'Peça presa',
  sacrifice: 'Sacrifício',
  deflection: 'Desvio',
  attraction: 'Atração',
  promotion: 'Promoção',
  quietMove: 'Lance silencioso',
  oneMove: 'Um lance',
  short: 'Curto',
  long: 'Longo',
  veryLong: 'Muito longo',
  endgame: 'Final',
  middlegame: 'Meio-jogo',
  opening: 'Abertura',
  backRankMate: 'Mate na última fileira',
  defensiveMove: 'Lance defensivo',
  defendMate: 'Defesa contra mate',
  defendCheck: 'Saída de xeque',
  savePiece: 'Salvar material',
  equality: 'Salvar o empate',
  advantage: 'Vantagem',
  crushing: 'Vantagem decisiva',
}

export const themeLabel = (t: string) => THEMES[t] ?? t

export type PuzzleKind = 'attack' | 'defense'
export type KindChoice = PuzzleKind | 'mix'

/** Defesa = encontrar o lance que evita a perda (temas do Lichess: defensiveMove / equality). */
export const kindOf = (p: Puzzle): PuzzleKind => (p.themes.includes('defensiveMove') || p.themes.includes('equality') ? 'defense' : 'attack')

/** Filtros oferecidos ao jogador (o padrão é aleatório). */
export const THEME_FILTERS: { id: string; label: string; kind: KindChoice; match: (p: Puzzle) => boolean }[] = [
  { id: 'random', label: '🎲 Qualquer', kind: 'mix', match: () => true },
  { id: 'mateIn1', label: 'Mate em 1', kind: 'attack', match: (p) => p.themes.includes('mateIn1') },
  { id: 'mateLong', label: 'Mate em 2+', kind: 'attack', match: (p) => p.themes.includes('mate') && !p.themes.includes('mateIn1') },
  { id: 'fork', label: 'Garfo', kind: 'attack', match: (p) => p.themes.includes('fork') },
  { id: 'hangingPiece', label: 'Peça pendurada', kind: 'attack', match: (p) => p.themes.includes('hangingPiece') },
  { id: 'pin', label: 'Cravada', kind: 'attack', match: (p) => p.themes.includes('pin') },
  { id: 'skewer', label: 'Espeto', kind: 'attack', match: (p) => p.themes.includes('skewer') },
  { id: 'discoveredAttack', label: 'Ataque descoberto', kind: 'attack', match: (p) => p.themes.includes('discoveredAttack') },
  { id: 'sacrifice', label: 'Sacrifício', kind: 'attack', match: (p) => p.themes.includes('sacrifice') },
  { id: 'defendCheck', label: 'Saída de xeque', kind: 'defense', match: (p) => p.themes.includes('defendCheck') },
  { id: 'equality', label: 'Salvar o empate', kind: 'defense', match: (p) => p.themes.includes('equality') },
  { id: 'long', label: 'Sequências longas', kind: 'mix', match: (p) => p.themes.includes('short') || p.themes.includes('long') || p.themes.includes('veryLong') },
  { id: 'quietMove', label: 'Lance silencioso', kind: 'mix', match: (p) => p.themes.includes('quietMove') },
  { id: 'endgame', label: 'Final', kind: 'mix', match: (p) => p.themes.includes('endgame') },
]

/** Filtros que fazem sentido para o tipo escolhido. */
export const filtersFor = (kind: KindChoice) => THEME_FILTERS.filter((f) => f.kind === 'mix' || kind === 'mix' || f.kind === kind)

/** Sorteia um desafio perto do rating, evitando os já vistos; amplia a faixa se faltar opção. */
export function pickPuzzle(all: Puzzle[], rating: number, seen: Set<string>, filter = 'random', rnd = Math.random, kind: KindChoice = 'mix'): Puzzle | null {
  const match = THEME_FILTERS.find((f) => f.id === filter)?.match ?? (() => true)
  const matching = all.filter(match)
  // No modo misto, sorteia primeiro o tipo para equilibrar ataque e defesa.
  const wanted: KindChoice = kind === 'mix' ? (rnd() < 0.5 ? 'attack' : 'defense') : kind
  let pool = matching.filter((p) => kindOf(p) === wanted)
  if (!pool.length && kind === 'mix') pool = matching
  if (!pool.length) return null
  for (const range of [100, 200, 350, 600, 1000, 3000]) {
    const near = pool.filter((p) => Math.abs(p.rating - rating) <= range && !seen.has(p.id))
    if (near.length) return near[Math.floor(rnd() * near.length)]
  }
  // Tudo já visto: recomeça pelos mais próximos.
  const sorted = [...pool].sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating))
  return sorted[Math.floor(rnd() * Math.min(20, sorted.length))]
}
