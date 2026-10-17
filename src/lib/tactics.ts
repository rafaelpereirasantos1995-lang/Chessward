import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'

// Análise tática estática (sem motor): trocas, peças penduradas e qualidade imediata de um lance.
// É instantânea, por isso alimenta o mapa vermelho/verde e a pré-visualização ao arrastar.

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

export type HeatColor = 'red' | 'green'
export interface HeatMark {
  color: HeatColor
  /** 1 = leve (≈ peão), 2 = médio (≈ peça menor), 3 = forte (torre/dama ou mate) */
  level: 1 | 2 | 3
  reason: string
}
export type HeatMap = Partial<Record<Square, HeatMark>>

export function levelFor(value: number): 1 | 2 | 3 {
  if (value >= 5) return 3
  if (value >= 2) return 2
  return 1
}

function capturesOn(chess: Chess, sq: Square): Move[] {
  return chess.moves({ verbose: true }).filter((m) => m.to === sq && m.captured && !m.isEnPassant())
}

function gainOf(m: Move): number {
  return PIECE_VALUE[m.captured!] + (m.promotion ? PIECE_VALUE[m.promotion] - 1 : 0)
}

/**
 * Static Exchange Evaluation: quanto o lado que joga ganha capturando em `sq`,
 * sempre com o atacante de menor valor, podendo parar a sequência quando quiser.
 * Usa lances legais do chess.js, então cravadas e raios-X são respeitados.
 */
export function see(chess: Chess, sq: Square): number {
  const caps = capturesOn(chess, sq)
  if (caps.length === 0) return 0
  caps.sort((a, b) => PIECE_VALUE[a.piece] - PIECE_VALUE[b.piece])
  const m = caps.find((c) => !c.promotion || c.promotion === 'q') ?? caps[0]
  const gain = gainOf(m)
  chess.move(m)
  const reply = see(chess, sq)
  chess.undo()
  return Math.max(0, gain - reply)
}

/** Melhor captura disponível para o lado que joga: [valor, casa]. */
export function bestCapture(chess: Chess): [number, Square | null] {
  let best = 0
  let where: Square | null = null
  const targets = new Set(chess.moves({ verbose: true }).filter((m) => m.captured && !m.isEnPassant()).map((m) => m.to))
  for (const sq of targets) {
    const v = see(chess, sq)
    if (v > best) {
      best = v
      where = sq
    }
  }
  return [best, where]
}

/** Mesma posição, mas com a vez passada ao outro lado (para perguntar "o que ele ameaça?"). */
export function withTurn(fen: string, turn: Color): Chess | null {
  const parts = fen.split(' ')
  if (parts[1] === turn) return new Chess(fen)
  parts[1] = turn
  parts[3] = '-'
  try {
    return new Chess(parts.join(' '))
  } catch {
    return null
  }
}

const NAMES: Record<PieceSymbol, string> = { p: 'Peão', n: 'Cavalo', b: 'Bispo', r: 'Torre', q: 'Dama', k: 'Rei' }
export const pieceName = (p: PieceSymbol) => NAMES[p]

/**
 * Mapa de calor da posição atual do ponto de vista de `me`:
 * vermelho = minhas peças que o adversário ganha se capturar; verde = peças dele que eu ganho.
 */
export function positionHeat(fen: string, me: Color): HeatMap {
  const heat: HeatMap = {}
  const opp: Color = me === 'w' ? 'b' : 'w'
  const asOpp = withTurn(fen, opp)
  const asMe = withTurn(fen, me)
  if (!asOpp || !asMe) return heat
  for (const row of asMe.board()) {
    for (const cell of row) {
      if (!cell || cell.type === 'k') continue
      if (cell.color === me) {
        const loss = see(asOpp, cell.square)
        if (loss > 0) heat[cell.square] = { color: 'red', level: levelFor(loss), reason: `${pieceName(cell.type)} em ${cell.square} está vulnerável (perde ${loss})` }
      } else {
        const win = see(asMe, cell.square)
        if (win > 0) heat[cell.square] = { color: 'green', level: levelFor(win), reason: `${pieceName(cell.type)} em ${cell.square} pode ser ganho (+${win})` }
      }
    }
  }
  return heat
}

export interface MoveVerdict {
  /** Saldo material esperado do lance (positivo = ganha). */
  net: number
  mate: boolean
  check: boolean
  /** Ameaça criada para o lance seguinte (valor da melhor captura que passo a ter). */
  threat: number
  /** Casa onde o adversário ganha material na resposta, se houver. */
  lossAt: Square | null
  lossPiece: PieceSymbol | null
}

/** Avalia um lance candidato em `chess` (lado que joga) sem alterar a posição. */
export function judgeMove(chess: Chess, m: { from: Square; to: Square; promotion?: string }): MoveVerdict | null {
  let played: Move
  try {
    played = chess.move(m)
  } catch {
    return null
  }
  try {
    if (chess.isCheckmate()) return { net: 100, mate: true, check: true, threat: 0, lossAt: null, lossPiece: null }
    const gained = played.captured ? gainOf(played) : played.promotion ? PIECE_VALUE[played.promotion] - 1 : 0
    // Resposta do adversário: a melhor captura dele (em qualquer casa, inclusive peças que ficaram descobertas).
    const [oppBest, lossAt] = bestCapture(chess)
    const lossPiece = lossAt ? chess.get(lossAt)?.type ?? null : null
    const net = gained - oppBest
    const check = chess.inCheck()
    let threat = 0
    if (!check) {
      const again = withTurn(chess.fen(), played.color)
      if (again) threat = bestCapture(again)[0]
    }
    return { net, mate: false, check, threat, lossAt: oppBest > 0 ? lossAt : null, lossPiece }
  } finally {
    chess.undo()
  }
}

/** Pré-visualização ao segurar uma peça: cor de cada casa de destino. */
export function previewMoves(fen: string, from: Square): HeatMap {
  const chess = new Chess(fen)
  const heat: HeatMap = {}
  for (const m of chess.moves({ square: from, verbose: true })) {
    if (m.promotion && m.promotion !== 'q') continue
    const v = judgeMove(chess, m)
    if (!v) continue
    if (v.mate) heat[m.to] = { color: 'green', level: 3, reason: 'Xeque-mate!' }
    else if (v.net < 0) {
      const where = v.lossAt === m.to ? 'a peça fica exposta' : v.lossAt && v.lossPiece ? `${pieceName(v.lossPiece)} em ${v.lossAt} fica sem defesa` : 'perde material'
      heat[m.to] = { color: 'red', level: levelFor(-v.net), reason: `${v.net}: ${where}` }
    }
    else if (v.net > 0) heat[m.to] = { color: 'green', level: levelFor(v.net), reason: `+${v.net}: ganha material` }
    else if (v.threat >= 2) heat[m.to] = { color: 'green', level: 1, reason: 'Cria uma ameaça' }
  }
  return heat
}
