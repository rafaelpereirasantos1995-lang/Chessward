import type { Chess, Color } from 'chess.js'
import { povWin, type Score } from './analysis'

// Finais essenciais contra o Stockfish na força máxima. Todas as posições foram conferidas com o
// motor (profundidade 20): nas de "vencer" a vitória é forçada; nas de "empatar" a defesa segura.

export type EndgameGoal = 'mate' | 'promote' | 'bareKing' | 'draw'

export interface Endgame {
  id: string
  name: string
  fen: string
  player: Color
  goal: EndgameGoal
  /** Limite de lances do jogador (no empate: sobreviver até aqui). */
  limit: number
  tip: string
}

export const ENDGAMES: Endgame[] = [
  { id: 'kqk', name: 'Rei e dama contra rei', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', player: 'w', goal: 'mate', limit: 20, tip: 'Use a dama para encurralar o rei em "caixas" cada vez menores (a um salto de cavalo dele) e traga seu rei. Cuidado com o afogamento!' },
  { id: 'krk', name: 'Rei e torre contra rei', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', player: 'w', goal: 'mate', limit: 35, tip: 'A torre corta o rei numa faixa; seu rei se aproxima em oposição. Quando os reis se encaram, dê xeque com a torre.' },
  { id: 'krrk', name: 'Mate com duas torres (escada)', fen: '8/8/4k3/8/8/8/8/R3K2R w - - 0 1', player: 'w', goal: 'mate', limit: 15, tip: 'As torres se alternam: uma corta a fileira, a outra dá xeque na seguinte, empurrando o rei até a borda.' },
  { id: 'kpk-front', name: 'Peão: rei à frente do peão', fen: '4k3/8/8/8/8/4K3/4P3/8 w - - 0 1', player: 'w', goal: 'promote', limit: 25, tip: 'Leve o rei à frente do peão, conquistando as "casas-chave". Só avance o peão quando o caminho estiver garantido.' },
  { id: 'kpk-opposition', name: 'Oposição', fen: '8/8/8/3k4/8/3K4/3P4/8 b - - 0 1', player: 'w', goal: 'promote', limit: 25, tip: 'Quem precisa se mover com os reis frente a frente cede espaço. Mantenha a oposição e avance o rei antes do peão.' },
  { id: 'kpk-defense', name: 'Defesa: rei contra rei e peão', fen: '8/8/8/4k3/8/8/4P3/4K3 b - - 0 1', player: 'b', goal: 'draw', limit: 25, tip: 'Fique na frente do peão. Quando o rei branco avançar, tome a oposição; recuando, vá para a casa bem na frente do peão.' },
  { id: 'lucena', name: 'Posição de Lucena (construir a ponte)', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', player: 'w', goal: 'promote', limit: 25, tip: 'Afaste o rei preto com a torre, leve sua torre à 4ª fileira e "construa a ponte" para bloquear os xeques.' },
  { id: 'philidor', name: 'Posição de Philidor (defesa)', fen: '4k3/8/r7/4PK2/8/8/8/7R b - - 0 1', player: 'b', goal: 'draw', limit: 25, tip: 'Torre na 3ª fileira (6ª para as pretas) até o peão avançar; aí vá para a primeira fileira e dê xeques por trás.' },
  { id: 'q-vs-p', name: 'Dama contra peão na 2ª', fen: '7K/8/8/8/8/8/3pk3/1Q6 w - - 0 1', player: 'w', goal: 'bareKing', limit: 25, tip: 'Com xeques e cravadas, force o rei a ficar na frente do peão; a cada vez, ganhe um tempo para aproximar seu rei.' },
  { id: 'r-vs-p', name: 'Torre contra peão', fen: '8/8/8/8/8/2k5/1p6/1K4R1 w - - 0 1', player: 'w', goal: 'bareKing', limit: 25, tip: 'Use a torre para vigiar a casa de promoção e capture o peão quando ele não estiver protegido.' },
  { id: 'outside-passer', name: 'Peão passado afastado', fen: '8/5pk1/8/8/P7/8/5PK1/8 w - - 0 1', player: 'w', goal: 'promote', limit: 30, tip: 'O peão passado afastado atrai o rei adversário; enquanto ele corre atrás, seu rei come os peões do outro lado.' },
]

export type Verdict = { done: true; success: boolean; message: string } | { done: false }

const material = (chess: Chess, color: Color) => chess.board().flat().filter((p) => p && p.color === color && p.type !== 'k')

/**
 * Situação do treino depois de um lance. `playerMoves`: lances já feitos pelo jogador;
 * `score`: avaliação (brancas) da posição atual, quando disponível.
 */
export function endgameVerdict(e: Endgame, chess: Chess, playerMoves: number, score?: Score): Verdict {
  const opp: Color = e.player === 'w' ? 'b' : 'w'
  if (chess.isCheckmate()) {
    const playerWon = chess.turn() === opp
    if (e.goal === 'draw') return { done: true, success: false, message: 'Xeque-mate: a defesa não segurou.' }
    return playerWon ? { done: true, success: true, message: 'Xeque-mate! Final dominado.' } : { done: true, success: false, message: 'Você levou mate.' }
  }
  if (chess.isDraw() || chess.isStalemate()) {
    const why = chess.isStalemate() ? 'afogamento' : chess.isInsufficientMaterial() ? 'material insuficiente' : chess.isThreefoldRepetition() ? 'repetição' : 'regra dos 50 lances'
    return e.goal === 'draw' ? { done: true, success: true, message: `Empate por ${why}. Defesa perfeita!` } : { done: true, success: false, message: `Empate por ${why}: a vitória escapou.` }
  }
  if (e.goal === 'promote' && chess.history({ verbose: true }).some((m) => m.promotion && m.color === e.player) && chess.turn() === opp)
    return { done: true, success: true, message: 'Peão promovido: vitória garantida!' }
  if (e.goal === 'bareKing' && material(chess, opp).length === 0 && material(chess, e.player).length > 0)
    return { done: true, success: true, message: 'Peão capturado: agora o mate é questão de técnica.' }
  if (score) {
    const w = povWin(score, e.player)
    if (e.goal === 'draw' && w < 15) return { done: true, success: false, message: 'A posição ficou perdida: o adversário vai vencer.' }
    if (e.goal !== 'draw' && w < 70) return { done: true, success: false, message: 'A vantagem escapou: a posição não está mais ganha.' }
  }
  if (playerMoves >= e.limit) {
    return e.goal === 'draw'
      ? { done: true, success: true, message: `Você segurou ${e.limit} lances sem perder. Empate!` }
      : { done: true, success: false, message: `Passou de ${e.limit} lances. Tente um caminho mais direto.` }
  }
  return { done: false }
}
