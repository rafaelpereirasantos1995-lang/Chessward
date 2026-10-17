import { Chess } from 'chess.js'
import masterGames from '../data/master-games.json'
import openingLines from '../data/opening-lines.json'
import { povWin } from '../lib/analysis'
import { ENDGAMES, endgameVerdict } from '../lib/endgames'
import { playMoveSound } from '../lib/sound'
import { isDue, reviewCard } from '../lib/srs'
import { getState, subscribe, update } from '../state/store'
import type { TrainingState } from '../state/types'
import { engines, scoreAfterMove, uciToMove } from './controller'

// Aba Treinos: finais contra o motor, linhas de abertura com repetição espaçada e
// "adivinhe o lance" em partidas fortes do Lichess. O progresso fica no store (e na nuvem).

export type MasterGame = [string, string, number, number, string, string, string, string]
export const GAMES = masterGames as MasterGame[]
export const OPENING_LINES = openingLines as { family: string; color: 'w' | 'b'; lines: [string, string][] }[]

const setTraining = (fn: (t: TrainingState) => TrainingState) => update((s) => ({ ...s, training: fn(s.training) }))
const sound = (captured?: boolean) => getState().settings.sound && playMoveSound(captured ? 'capture' : 'move')

function play(fen: string, moves: string[]): Chess {
  const c = new Chess(fen)
  for (const u of moves) c.move(uciToMove(u))
  return c
}

// ---------- Finais ----------

export const endgameById = (id: string) => ENDGAMES.find((e) => e.id === id)!

/** Quantos dos lances foram do jogador (a posição pode começar com a vez do motor). */
function playerMoveCount(id: string, moves: string[]): number {
  const e = endgameById(id)
  const first = new Chess(e.fen).turn()
  return moves.filter((_, i) => (i % 2 === 0 ? first : first === 'w' ? 'b' : 'w') === e.player).length
}

export function startEndgame(id: string) {
  setTraining((t) => ({ ...t, endgame: { id, moves: [], status: 'playing' } }))
}

export function leaveEndgame() {
  setTraining((t) => ({ ...t, endgame: null }))
}

function finishEndgame(success: boolean, message: string) {
  setTraining((t) =>
    t.endgame ? { ...t, endgame: { ...t.endgame, status: 'done', success, message }, endgamesDone: success ? { ...t.endgamesDone, [t.endgame.id]: true } : t.endgamesDone } : t,
  )
  if (getState().settings.sound) playMoveSound('end')
}

let endgameBusy: string | null = null
let endgameEvaluating = false

export async function endgameMove(uci: string) {
  const eg = getState().training.endgame
  if (!eg || eg.status !== 'playing' || endgameEvaluating) return
  const e = endgameById(eg.id)
  const chess = play(e.fen, eg.moves)
  if (chess.turn() !== e.player) return
  let m
  try {
    m = chess.move(uciToMove(uci))
  } catch {
    return
  }
  sound(!!m.captured)
  const moves = [...eg.moves, m.lan]
  const playerMoves = playerMoveCount(e.id, moves)
  setTraining((t) => (t.endgame ? { ...t, endgame: { ...t.endgame, moves } } : t))
  let v = endgameVerdict(e, chess, playerMoves)
  if (v.done) return finishEndgame(v.success, v.message)
  // Avalia a posição para saber se a vitória (ou o empate) ainda está garantida; o motor só
  // responde depois disso, para não jogar numa posição que já encerrou o treino.
  endgameEvaluating = true
  const res = await engines().analyst.analyze({ fen: chess.fen(), depth: 14, options: { UCI_LimitStrength: false } })
  endgameEvaluating = false
  if (getState().training.endgame?.moves.join() === moves.join()) {
    v = endgameVerdict(e, chess, playerMoves, res?.lines[0]?.score)
    if (v.done) return finishEndgame(v.success, v.message)
  }
  endgameTick()
}

function endgameTick() {
  const eg = getState().training.endgame
  if (!eg || eg.status !== 'playing') return
  const e = endgameById(eg.id)
  const chess = play(e.fen, eg.moves)
  const tag = eg.moves.join()
  if (chess.turn() === e.player || endgameBusy === tag || endgameEvaluating) return
  endgameBusy = tag
  const started = Date.now()
  void engines()
    .bot.analyze({ fen: chess.fen(), depth: 14, options: { UCI_LimitStrength: false } })
    .then((res) => {
      setTimeout(() => {
        endgameBusy = null
        const now = getState().training.endgame
        if (!res || !now || now.moves.join() !== tag || now.status !== 'playing') return
        const c = play(e.fen, now.moves)
        const m = c.move(uciToMove(res.bestmove))
        sound(!!m.captured)
        const moves = [...now.moves, m.lan]
        setTraining((t) => (t.endgame ? { ...t, endgame: { ...t.endgame, moves } } : t))
        const playerMoves = playerMoveCount(e.id, moves)
        const v = endgameVerdict(e, c, playerMoves)
        if (v.done) finishEndgame(v.success, v.message)
      }, Math.max(0, 500 - (Date.now() - started)))
    })
}

// ---------- Aberturas ----------

export const cardKey = (family: string, idx: number, color: 'w' | 'b') => `${family}|${idx}|${color}`
export const linesOf = (family: string) => OPENING_LINES.find((f) => f.family === family)!.lines.map(([name, uci]) => ({ name, moves: uci.split(' ') }))

/** Linhas a revisar hoje + até 4 novas; se não houver nada, pratica as que vencem primeiro. */
export function openingQueue(t: TrainingState, family: string, color: 'w' | 'b', now = Date.now()): number[] {
  const lines = linesOf(family)
  const due: number[] = []
  const fresh: number[] = []
  lines.forEach((_, i) => {
    const c = t.openingCards[cardKey(family, i, color)]
    if (!c) fresh.push(i)
    else if (isDue(c, now)) due.push(i)
  })
  const q = [...due, ...fresh.slice(0, 4)]
  if (q.length) return q
  return lines.map((_, i) => i).sort((a, b) => (t.openingCards[cardKey(family, a, color)]?.due ?? 0) - (t.openingCards[cardKey(family, b, color)]?.due ?? 0)).slice(0, 4)
}

export function startOpening(family: string, color: 'w' | 'b') {
  setTraining((t) => ({ ...t, opening: { family, color, queue: openingQueue(t, family, color), index: 0, step: 0, mistakes: 0, lastWrong: null } }))
}

export const leaveOpening = () => setTraining((t) => ({ ...t, opening: null }))

/** Avança um lance na linha atual; ao chegar no fim, registra a revisão do cartão. */
function advanceOpening() {
  setTraining((t) => {
    const o = t.opening
    if (!o) return t
    const line = linesOf(o.family)[o.queue[o.index]]
    const step = o.step + 1
    const next = { ...t, opening: { ...o, step, lastWrong: null } }
    if (step >= line.moves.length) {
      const key = cardKey(o.family, o.queue[o.index], o.color)
      const card = reviewCard(t.openingCards[key] ?? { box: 0, due: 0 }, o.mistakes === 0)
      next.openingCards = { ...t.openingCards, [key]: card }
    }
    return next
  })
}

export function openingMove(uci: string): 'right' | 'wrong' | null {
  const o = getState().training.opening
  if (!o) return null
  const line = linesOf(o.family)[o.queue[o.index]]
  if (o.step >= line.moves.length || (o.step % 2 === 0 ? 'w' : 'b') !== o.color || o.lastWrong) return null
  if (uci === line.moves[o.step]) {
    sound()
    advanceOpening()
    return 'right'
  }
  setTraining((t) => (t.opening ? { ...t, opening: { ...t.opening, mistakes: t.opening.mistakes + 1, lastWrong: uci } } : t))
  if (getState().settings.sound) playMoveSound('check')
  // Mostra o lance certo por um instante e segue a linha.
  setTimeout(() => {
    const now = getState().training.opening
    if (now && now.lastWrong === uci && now.step === o.step) {
      sound()
      advanceOpening()
    }
  }, 1600)
  return 'wrong'
}

export function nextOpeningLine() {
  setTraining((t) => (t.opening ? { ...t, opening: { ...t.opening, index: t.opening.index + 1, step: 0, mistakes: 0, lastWrong: null } } : t))
}

let openingTimer: string | null = null
function openingTick() {
  const o = getState().training.opening
  if (!o || o.index >= o.queue.length) return
  const line = linesOf(o.family)[o.queue[o.index]]
  if (o.step >= line.moves.length || (o.step % 2 === 0 ? 'w' : 'b') === o.color) return
  const tag = `${o.family}:${o.index}:${o.step}`
  if (openingTimer === tag) return
  openingTimer = tag
  setTimeout(() => {
    openingTimer = null
    const now = getState().training.opening
    if (now && `${now.family}:${now.index}:${now.step}` === tag) {
      sound()
      advanceOpening()
    }
  }, 550)
}

// ---------- Adivinhe o lance ----------

export const gameMoves = (i: number) => GAMES[i][6].split(' ')

/** Começa uma partida: você joga pelo lado vencedor (brancas em empates), a partir do 6º lance. */
export function startGuess(game = Math.floor(Math.random() * GAMES.length)) {
  const result = GAMES[game][5]
  const side: 'w' | 'b' = result === '0-1' ? 'b' : 'w'
  let ply = 10
  if ((ply % 2 === 0 ? 'w' : 'b') !== side) ply++
  setTraining((t) => ({ ...t, guess: { game, side, ply, score: 0, max: 0, feedback: null, done: false } }))
}

export const leaveGuess = () => setTraining((t) => ({ ...t, guess: null }))

let guessBusy = false

export async function guessMove(uci: string) {
  const g = getState().training.guess
  if (!g || g.done || guessBusy) return
  const moves = gameMoves(g.game)
  if ((g.ply % 2 === 0 ? 'w' : 'b') !== g.side || g.ply >= moves.length) return
  const fen = play(new Chess().fen(), moves.slice(0, g.ply)).fen()
  const master = moves[g.ply]
  let points = 5
  let text = 'Igual ao mestre!'
  if (uci !== master) {
    guessBusy = true
    setTraining((t) => (t.guess ? { ...t, guess: { ...t.guess, feedback: { text: 'Comparando com o lance do mestre…', points: 0, master: '', guess: uci } } } : t))
    const [mine, theirs] = [await scoreAfterMove(fen, uci), await scoreAfterMove(fen, master)]
    guessBusy = false
    const d = mine && theirs ? povWin(theirs, g.side) - povWin(mine, g.side) : 100
    if (d <= 3) [points, text] = [4, 'Tão bom quanto o lance do mestre!']
    else if (d <= 10) [points, text] = [2, 'Razoável, mas o mestre jogou melhor.']
    else [points, text] = [0, 'O mestre encontrou algo bem melhor.']
  }
  const c = new Chess(fen)
  const m = c.move(uciToMove(master))
  sound(!!m.captured)
  setTraining((t) => {
    if (!t.guess) return t
    const ply = t.guess.ply + 1
    const done = ply >= moves.length
    const score = t.guess.score + points
    const max = t.guess.max + 5
    const pct = Math.round((score / max) * 100)
    return {
      ...t,
      guessBest: done ? Math.max(t.guessBest ?? 0, pct) : t.guessBest,
      guess: { ...t.guess, ply, score, max, done, feedback: { text, points, master: m.san, guess: uci } },
    }
  })
}

let guessTimer: string | null = null
function guessTick() {
  const g = getState().training.guess
  if (!g || g.done) return
  const moves = gameMoves(g.game)
  if ((g.ply % 2 === 0 ? 'w' : 'b') === g.side) return
  if (g.ply >= moves.length) return setTraining((t) => (t.guess ? { ...t, guess: { ...t.guess, done: true } } : t))
  const tag = `${g.game}:${g.ply}`
  if (guessTimer === tag) return
  guessTimer = tag
  setTimeout(() => {
    guessTimer = null
    const now = getState().training.guess
    if (!now || `${now.game}:${now.ply}` !== tag) return
    const c = play(new Chess().fen(), moves.slice(0, now.ply))
    const m = c.move(uciToMove(moves[now.ply]))
    sound(!!m.captured)
    setTraining((t) => (t.guess ? { ...t, guess: { ...t.guess, ply: t.guess.ply + 1, done: t.guess.ply + 1 >= moves.length } } : t))
  }, 900)
}

let started = false
export function startTrainers() {
  if (started) return
  started = true
  subscribe(() =>
    queueMicrotask(() => {
      endgameTick()
      openingTick()
      guessTick()
    }),
  )
  endgameTick()
  openingTick()
  guessTick()
}
