import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import { CLASS_INFO, type MoveClass } from './analysis'
import { OPENING_TIPS, type OpeningInfo } from './openings'
import { pieceName, positionHeat, withTurn } from './tactics'

// Treinador baseado em regras: cada função olha a posição e devolve comentários curtos.

export type Tone = 'good' | 'bad' | 'info' | 'warn'
export interface CoachMsg {
  /** Chave para não repetir o mesmo comentário em sequência. */
  key: string
  ply: number
  tone: Tone
  icon: string
  title: string
  text?: string
}


export function openingMessages(op: OpeningInfo, ply: number): CoachMsg[] {
  const out: CoachMsg[] = [{ key: `op:${op.name}`, ply, tone: 'info', icon: '📖', title: `${op.name} (${op.eco})` }]
  if (op.gambit) {
    const status = /Aceito/.test(op.name) ? ' O gambito foi aceito: quem recebeu o material deve devolver no momento certo ou consolidar.' : /Recusado/.test(op.name) ? ' O gambito foi recusado.' : ''
    out.push({
      key: `gambit:${op.family}`,
      ply,
      tone: 'info',
      icon: '♟️',
      title: 'Gambito',
      text: `Um lado oferece material (geralmente um peão) em troca de desenvolvimento rápido e iniciativa.${status}`,
    })
  }
  const tip = OPENING_TIPS.find(([re]) => re.test(op.family))
  if (tip) out.push({ key: `tip:${op.family}`, ply, tone: 'info', icon: '💡', title: 'Ideia da abertura', text: tip[1] })
  return out
}

export function classificationMessage(opts: {
  cls: MoveClass
  ply: number
  san: string
  byPlayer: boolean
  bestSan?: string
}): CoachMsg {
  const { cls, ply, san, byPlayer, bestSan } = opts
  const info = CLASS_INFO[cls]
  const who = byPlayer ? 'Você jogou' : 'A máquina jogou'
  const good = ['brilliant', 'great', 'best', 'excellent', 'good', 'book'].includes(cls)
  let text: string | undefined
  if (cls === 'brilliant') text = byPlayer ? 'Sacrifício correto! Você entregou material e a posição continua boa.' : 'A máquina sacrificou material de propósito. Antes de capturar, procure o que ela ganha em troca.'
  else if (cls === 'great') text = 'Era o único lance que mantinha a vantagem.'
  else if (!good && byPlayer && bestSan) text = `Melhor era ${bestSan}.`
  else if (!good && !byPlayer) text = 'A máquina errou! Procure como punir — há algo melhor para você agora.'
  return {
    key: `cls:${ply}`,
    ply,
    tone: good ? 'good' : cls === 'inaccuracy' ? 'warn' : 'bad',
    icon: info.symbol,
    title: `${who} ${san} — ${info.label}`,
    text,
  }
}

const MAX_MOBILITY: Record<PieceSymbol, number> = { p: 4, n: 8, b: 13, r: 14, q: 27, k: 8 }

interface Activity {
  square: Square
  type: PieceSymbol
  score: number
  mobility: number
  attacks: Square[]
}

/** Atividade de cada peça (mobilidade relativa + ataques a peças inimigas + centralização). */
export function pieceActivity(fen: string, color: Color): Activity[] {
  const chess = withTurn(fen, color)
  if (!chess) return []
  const out: Activity[] = []
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== color || cell.type === 'p' || cell.type === 'k') continue
      const moves = chess.moves({ square: cell.square, verbose: true })
      const attacks = moves.filter((m) => m.captured).map((m) => m.to)
      const file = cell.square.charCodeAt(0) - 97
      const rank = Number(cell.square[1]) - 1
      const center = 3.5 - (Math.abs(file - 3.5) + Math.abs(rank - 3.5)) / 2
      out.push({
        square: cell.square,
        type: cell.type,
        mobility: moves.length,
        attacks,
        score: moves.length / MAX_MOBILITY[cell.type] + 0.15 * attacks.length + 0.05 * center,
      })
    }
  }
  return out.sort((a, b) => b.score - a.score)
}

interface PawnInfo {
  doubled: string[]
  isolated: Square[]
  passed: Square[]
}

export function pawnStructure(chess: Chess, color: Color): PawnInfo {
  const mine: Square[] = []
  const theirs: Square[] = []
  for (const row of chess.board()) for (const c of row) if (c?.type === 'p') (c.color === color ? mine : theirs).push(c.square)
  const files = (list: Square[]) => list.map((s) => s.charCodeAt(0) - 97)
  const myFiles = files(mine)
  const count = new Map<number, number>()
  for (const f of myFiles) count.set(f, (count.get(f) ?? 0) + 1)
  const doubled = [...count.entries()].filter(([, n]) => n > 1).map(([f]) => String.fromCharCode(97 + f))
  const isolated = mine.filter((s) => {
    const f = s.charCodeAt(0) - 97
    return !myFiles.includes(f - 1) && !myFiles.includes(f + 1)
  })
  const dir = color === 'w' ? 1 : -1
  const passed = mine.filter((s) => {
    const f = s.charCodeAt(0) - 97
    const r = Number(s[1])
    return !theirs.some((t) => {
      const tf = t.charCodeAt(0) - 97
      const tr = Number(t[1])
      return Math.abs(tf - f) <= 1 && (tr - r) * dir > 0
    })
  })
  return { doubled, isolated, passed }
}

function nonPawnMaterial(chess: Chess, color: Color): number {
  const v: Record<PieceSymbol, number> = { p: 0, n: 3, b: 3, r: 5, q: 9, k: 0 }
  let total = 0
  for (const row of chess.board()) for (const c of row) if (c && c.color === color) total += v[c.type]
  return total
}

export function isEndgame(chess: Chess): boolean {
  return nonPawnMaterial(chess, 'w') <= 13 && nonPawnMaterial(chess, 'b') <= 13
}

/** Comentários sobre a posição do ponto de vista do jogador, depois de cada lance. */
export function positionMessages(chess: Chess, player: Color, ply: number, opts: { tactics: boolean }): CoachMsg[] {
  const out: CoachMsg[] = []
  const fen = chess.fen()
  const opp: Color = player === 'w' ? 'b' : 'w'
  const fullMove = Math.ceil(ply / 2)
  const history = chess.history({ verbose: true })
  const myMoves = history.filter((m) => m.color === player)

  // Princípios de abertura.
  if (fullMove <= 14) {
    const home: [Square, PieceSymbol][] = player === 'w' ? [['b1', 'n'], ['g1', 'n'], ['c1', 'b'], ['f1', 'b']] : [['b8', 'n'], ['g8', 'n'], ['c8', 'b'], ['f8', 'b']]
    const undeveloped = home.filter(([sq, t]) => {
      const p = chess.get(sq)
      return p && p.type === t && p.color === player
    })
    if (myMoves.length >= 6 && undeveloped.length >= 2)
      out.push({ key: 'dev', ply, tone: 'warn', icon: '🐴', title: 'Desenvolva suas peças', text: `Ainda há ${undeveloped.length} peças menores na posição inicial. Cavalos e bispos ativos antes de atacar.` })
    const earlyQueen = myMoves.slice(0, 4).some((m) => m.piece === 'q')
    if (earlyQueen && myMoves.length <= 5)
      out.push({ key: 'queen-early', ply, tone: 'warn', icon: '👑', title: 'Dama cedo demais', text: 'A dama no início vira alvo: o adversário a ataca ganhando tempo enquanto desenvolve.' })
  }
  const castled = (c: Color) => history.some((m) => m.color === c && (m.isKingsideCastle() || m.isQueensideCastle()))
  const kingCentral = (c: Color) => {
    const sq = chess.board().flat().find((p) => p?.type === 'k' && p.color === c)?.square
    return sq !== undefined && 'de'.includes(sq[0])
  }
  if (fullMove >= 10 && !isEndgame(chess)) {
    if (!castled(player) && kingCentral(player)) out.push({ key: 'castle', ply, tone: 'warn', icon: '🏰', title: 'Rei no centro', text: 'Seu rei ainda está no centro. Considere fazer o roque para protegê-lo.' })
    if (!castled(opp) && kingCentral(opp)) out.push({ key: 'opp-king', ply, tone: 'info', icon: '🎯', title: 'Rei adversário exposto', text: 'O rei da máquina continua no centro: abrir colunas centrais pode render um ataque.' })
  }

  // Estrutura de peões.
  const ps = pawnStructure(chess, player)
  if (ps.passed.length) out.push({ key: `passed:${ps.passed.join()}`, ply, tone: 'good', icon: '🚀', title: `Peão passado em ${ps.passed.join(', ')}`, text: isEndgame(chess) ? 'No final, peões passados decidem: empurre-o com apoio do rei e das torres.' : 'Peões passados ficam mais fortes conforme as peças são trocadas.' })
  if (ps.isolated.length) out.push({ key: `iso:${ps.isolated.join()}`, ply, tone: 'warn', icon: '🧱', title: `Peão isolado em ${ps.isolated.join(', ')}`, text: 'Sem peões vizinhos para defendê-lo, ele pode virar alvo. Em compensação, abre colunas para suas peças.' })
  if (ps.doubled.length) out.push({ key: `dbl:${ps.doubled.join()}`, ply, tone: 'warn', icon: '🧱', title: `Peões dobrados na coluna ${ps.doubled.join(', ')}`, text: 'Peões dobrados controlam menos casas e são mais difíceis de defender.' })

  // Fase da partida.
  if (isEndgame(chess)) out.push({ key: 'endgame', ply, tone: 'info', icon: '♔', title: 'Final de partida', text: 'Com menos peças, o rei vira uma peça de ataque: centralize-o. Torres atrás dos peões passados.' })

  // Peça mais forte / mais fraca (a cada 4 lances completos para não poluir).
  if (fullMove >= 6 && ply % 8 === 0) {
    const mine = pieceActivity(fen, player)
    const theirs = pieceActivity(fen, opp)
    if (mine.length) {
      const s = mine[0]
      out.push({ key: `strong:${s.square}`, ply, tone: 'good', icon: '💪', title: `Sua peça mais ativa: ${pieceName(s.type)} em ${s.square}`, text: `Controla ${s.mobility} casas${s.attacks.length ? ` e ataca ${s.attacks.join(', ')}` : ''}.` })
      const w = mine[mine.length - 1]
      if (mine.length > 1 && w.mobility <= 2) out.push({ key: `weak:${w.square}`, ply, tone: 'warn', icon: '😴', title: `Peça passiva: ${pieceName(w.type)} em ${w.square}`, text: 'Tem pouquíssimas casas. Procure uma rota para ativá-la.' })
    }
    if (theirs.length) {
      const t = theirs[0]
      out.push({ key: `opp-strong:${t.square}`, ply, tone: 'info', icon: '👁️', title: `Peça mais perigosa da máquina: ${pieceName(t.type)} em ${t.square}`, text: 'Considere trocá-la ou limitar suas casas.' })
    }
  }

  // Alertas táticos (modo Treino), na vez do jogador.
  if (opts.tactics && chess.turn() === player && !chess.isGameOver()) {
    const heat = positionHeat(fen, player)
    for (const [sq, mark] of Object.entries(heat)) {
      if (mark!.color === 'red') out.push({ key: `hang:${ply}:${sq}`, ply, tone: 'bad', icon: '⚠️', title: 'Peça vulnerável', text: mark!.reason })
      else out.push({ key: `win:${ply}:${sq}`, ply, tone: 'good', icon: '🎯', title: 'Oportunidade', text: mark!.reason })
    }
    if (chess.inCheck()) out.push({ key: `check:${ply}`, ply, tone: 'warn', icon: '⚡', title: 'Você está em xeque' })
  }
  return out
}
