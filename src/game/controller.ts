import { Chess, type Color, type Square } from 'chess.js'
import { classify, isRealThreat, type PosEval, type Score } from '../lib/analysis'
import { chooseBotMove, levelByElo } from '../lib/bot'
import { classificationMessage, openingMessages, positionMessages, type CoachMsg } from '../lib/coach'
import { Engine } from '../lib/engine'
import { loadOpenings, lookupOpening, openingsLoaded } from '../lib/openings'
import { newRating } from '../lib/rating'
import { playMoveSound } from '../lib/sound'
import { chess960Fen } from '../lib/chess960'
import { afterMove, newClock, pause, remaining, resume } from '../lib/clock'
import { harvestGame } from '../lib/stats'
import { judgeMove, withTurn } from '../lib/tactics'
import { getState, subscribe, update } from '../state/store'
import type { AppState, GameSession, Mode, Result } from '../state/types'

// Orquestra a partida: lances do jogador, resposta da máquina, análise de cada posição
// e comentários do treinador. Todo o progresso vai para o store (e dali para a nuvem),
// então a partida pode ser retomada em qualquer aparelho.

const ANALYSIS_DEPTH = 12

let bot: Engine | null = null
let analyst: Engine | null = null
export const engines = () => {
  bot ??= new Engine()
  analyst ??= new Engine()
  return { bot, analyst }
}

export function replay(session: Pick<GameSession, 'startFen' | 'moves'>, upTo = session.moves.length): Chess {
  const chess = new Chess(session.startFen)
  for (const uci of session.moves.slice(0, upTo)) chess.move(uciToMove(uci))
  return chess
}

export const uciToMove = (uci: string) => ({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] })

const sameLine = (s: GameSession | null, id: string, ply: number, prefix: string) =>
  !!s && s.id === id && s.moves.length >= ply && s.moves.slice(0, ply).join() === prefix

function setCurrent(fn: (g: GameSession) => GameSession) {
  update((s) => (s.current ? { ...s, current: fn(s.current) } : s))
}

function addCoach(list: CoachMsg[], msgs: CoachMsg[]): CoachMsg[] {
  let out = list
  for (const m of msgs) {
    if (out.slice(-15).some((x) => x.key === m.key)) continue
    out = [...out, m]
  }
  return out.slice(-60)
}

// ---------- Ações ----------

export interface GameOptions {
  mode: Mode
  botElo: number
  playerColor: Color | 'random'
  variant?: 'standard' | '960'
  blind?: boolean
  time?: { minutes: number; increment: number } | null
  /** Começar de uma posição (ex.: o fim de uma linha da seção Estudos). */
  startFen?: string
  lesson?: string
}

export function newGame(opts: GameOptions) {
  const s = getState()
  if (s.current?.status === 'playing' && s.current.mode === 'desafio' && s.current.moves.length >= 2) resign('Abandonou a partida')
  bot?.cancelAll()
  analyst?.cancelAll()
  botBusy = null
  analysisBusy = null
  const playerColor: Color = opts.playerColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : opts.playerColor
  const game: GameSession = {
    id: crypto.randomUUID(),
    mode: opts.mode,
    botElo: opts.botElo,
    playerColor,
    startFen: opts.startFen ?? (opts.variant === '960' ? chess960Fen() : new Chess().fen()),
    variant: opts.variant ?? 'standard',
    blind: opts.blind ?? false,
    clock: opts.time ? newClock(opts.time.minutes, opts.time.increment) : null,
    moves: [],
    evals: {},
    reviews: {},
    coach: [
      {
        key: 'start',
        ply: 0,
        tone: 'info',
        icon: opts.mode === 'treino' ? '🎓' : '🏆',
        title: opts.lesson ? `Praticando: ${opts.lesson}` : opts.mode === 'treino' ? 'Modo Treino' : 'Modo Desafio — vale rating',
        text:
          opts.mode === 'treino'
            ? 'Mapa de vulnerabilidades, dicas e desfazer liberados. Segure uma peça para ver onde cada lance é seguro (verde) ou perigoso (vermelho).'
            : 'Sem ajuda durante a partida. A análise completa e os comentários aparecem no final.',
      },
    ],
    status: 'playing',
    startedAt: Date.now(),
  }
  update((st) => ({ ...st, current: game }))
}

export function playerMove(from: Square, to: Square, promotion?: string): boolean {
  const g = getState().current
  if (!g || g.status !== 'playing') return false
  const chess = replay(g)
  if (chess.turn() !== g.playerColor) return false
  return applyMove(g, chess, from + to + (promotion ?? ''))
}

function applyMove(g: GameSession, chess: Chess, uci: string): boolean {
  let move
  try {
    move = chess.move(uciToMove(uci))
  } catch {
    return false
  }
  const ply = g.moves.length + 1
  const msgs: CoachMsg[] = []
  const op = lookupOpening(chess.fen())
  if (op && ply <= 30) msgs.push(...openingMessages(op, ply))
  msgs.push(...positionMessages(chess, g.playerColor, ply, { tactics: g.mode === 'treino' && !g.blind, standard: g.variant !== '960' }))

  if (getState().settings.sound) playMoveSound(chess.isGameOver() ? 'end' : chess.inCheck() ? 'check' : move.captured ? 'capture' : 'move')

  setCurrent((cur) => ({ ...cur, moves: [...cur.moves, move.lan], coach: addCoach(cur.coach, msgs), clock: cur.clock ? afterMove(cur.clock, move.color) : cur.clock }))

  if (chess.isGameOver()) {
    let result: Result = '1/2-1/2'
    let reason = 'Empate'
    if (chess.isCheckmate()) {
      result = chess.turn() === 'w' ? '0-1' : '1-0'
      reason = 'Xeque-mate'
    } else if (chess.isStalemate()) reason = 'Afogamento'
    else if (chess.isThreefoldRepetition()) reason = 'Repetição tripla'
    else if (chess.isInsufficientMaterial()) reason = 'Material insuficiente'
    else reason = 'Regra dos 50 lances'
    endGame(result, reason)
  }
  return true
}

export function resign(reason = 'Desistência') {
  const g = getState().current
  if (!g || g.status !== 'playing') return
  endGame(g.playerColor === 'w' ? '0-1' : '1-0', reason)
}

function endGame(result: Result, reason: string) {
  update((s): AppState => {
    const g = s.current
    if (!g || g.status !== 'playing') return s
    const score = result === '1/2-1/2' ? 0.5 : (result === '1-0') === (g.playerColor === 'w') ? 1 : 0
    let profile = s.profile
    let ratingAfter: number | undefined
    if (g.mode === 'desafio') {
      ratingAfter = newRating(profile.rating, g.botElo, score, profile.ratedGames)
      profile = {
        rating: ratingAfter,
        peak: Math.max(profile.peak, ratingAfter),
        ratedGames: profile.ratedGames + 1,
        wins: profile.wins + (score === 1 ? 1 : 0),
        draws: profile.draws + (score === 0.5 ? 1 : 0),
        losses: profile.losses + (score === 0 ? 1 : 0),
      }
    }
    const clock = g.clock ? pause(g.clock, replay(g).turn()) : g.clock
    const ended: GameSession = { ...g, clock, status: 'ended', result, endReason: reason, ratingBefore: s.profile.rating, ratingAfter }
    const record = { id: g.id, date: Date.now(), mode: g.mode, botElo: g.botElo, playerColor: g.playerColor, result, endReason: reason, ratingAfter, moves: g.moves, startFen: g.startFen }
    const stats = ratingAfter !== undefined ? { ...s.stats, ratingHistory: [...s.stats.ratingHistory, { t: Date.now(), r: ratingAfter }].slice(-300) } : s.stats
    return { ...s, profile, stats, current: ended, history: [record, ...s.history].slice(0, 50) }
  })
}

/** Modo Treino: volta ao último lance do jogador. */
export function undo() {
  const g = getState().current
  if (!g || g.status !== 'playing' || g.mode !== 'treino' || g.moves.length === 0) return
  bot?.cancelAll()
  analyst?.cancelAll()
  botBusy = null
  analysisBusy = null
  // Volta para a posição antes do último lance do jogador (desfazendo também a resposta da máquina).
  let keep = g.moves.length - 1
  while (keep > 0 && replay(g, keep).turn() !== g.playerColor) keep--
  setCurrent((cur) => ({
    ...cur,
    moves: cur.moves.slice(0, keep),
    evals: Object.fromEntries(Object.entries(cur.evals).filter(([k]) => Number(k) <= keep)),
    reviews: Object.fromEntries(Object.entries(cur.reviews).filter(([k]) => Number(k) <= keep)),
    coach: cur.coach.filter((m) => m.ply <= keep),
  }))
}

// ---------- Ciclo automático (máquina + análise) ----------

let botBusy: string | null = null
let analysisBusy: string | null = null

function tick() {
  const g = getState().current
  if (!g) return
  runBot(g)
  runAnalysis(g)
  runThreat(g)
  harvest(g)
}

let threatBusy: string | null = null

/** Mapa dinâmico: na vez do jogador (Treino), o que o adversário faria se o jogador passasse a vez? */
function runThreat(g: GameSession) {
  const n = g.moves.length
  const ev = g.evals[n]
  if (g.status !== 'playing' || g.mode !== 'treino' || g.blind || !getState().settings.threats || !ev || ev.threat !== undefined) return
  const chess = replay(g)
  if (chess.turn() !== g.playerColor || chess.isGameOver()) return
  const tag = `${g.id}:${n}:${g.moves.join()}`
  if (threatBusy === tag) return
  threatBusy = tag
  const opp = g.playerColor === 'w' ? 'b' : 'w'
  const passed = chess.inCheck() ? null : withTurn(chess.fen(), opp)
  const store = (threat: PosEval['threat'], msgs: CoachMsg[] = []) => {
    if (threatBusy === tag) threatBusy = null
    const cur = getState().current
    if (!cur || cur.id !== g.id || cur.moves.join() !== g.moves.join() || !cur.evals[n]) return
    setCurrent((c) => ({ ...c, evals: { ...c.evals, [n]: { ...c.evals[n], threat } }, coach: addCoach(c.coach, msgs) }))
  }
  if (!passed) return store(null)
  void engines()
    .analyst.analyze({ fen: passed.fen(), depth: 10, options: { UCI_LimitStrength: false } })
    .then((res) => {
      const line = res?.lines[0]
      if (!line) return store(null)
      const real = isRealThreat(ev.best, line.score, opp)
      const msgs: CoachMsg[] = []
      if (real) {
        // Lances do adversário na linha (posições pares a partir da vez passada).
        const c = new Chess(passed.fen())
        const sans: string[] = []
        for (let k = 0; k < Math.min(3, line.pv.length); k++) {
          try {
            const m = c.move(uciToMove(line.pv[k]))
            if (k % 2 === 0) sans.push(m.san)
          } catch {
            break
          }
        }
        msgs.push({
          key: `threat:${n}`,
          ply: n,
          tone: 'bad',
          icon: '🔮',
          title: `Ameaça: a máquina planeja ${sans.join(' e depois ')}`,
          text: 'Setas vermelhas tracejadas mostram o plano. Antes do seu lance, veja se ele impede essa ideia.',
        })
      }
      store({ pv: line.pv.slice(0, 4), score: line.score, real }, msgs)
    })
}

/** Quando a partida termina e todos os lances foram analisados, alimenta a aba Evolução. */
function harvest(g: GameSession) {
  if (g.status !== 'ended' || g.moves.length < 2 || !openingsLoaded()) return
  if (Object.keys(g.reviews).length < g.moves.length) return
  if (getState().stats.harvested.includes(g.id)) return
  const h = harvestGame(g, (fen) => lookupOpening(fen)?.family ?? null)
  update((s) => {
    const st = s.stats
    const moveClasses = { ...st.moveClasses }
    for (const [k, v] of Object.entries(h.classes)) moveClasses[k as keyof typeof moveClasses] = (moveClasses[k as keyof typeof moveClasses] ?? 0) + v
    const openings = { ...st.openings }
    if (h.family) {
      const o = openings[h.family] ?? { games: 0, wins: 0, draws: 0, losses: 0, accSum: 0, accN: 0 }
      const score = g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (g.playerColor === 'w') ? 1 : 0
      openings[h.family] = {
        games: o.games + 1,
        wins: o.wins + (score === 1 ? 1 : 0),
        draws: o.draws + (score === 0.5 ? 1 : 0),
        losses: o.losses + (score === 0 ? 1 : 0),
        accSum: o.accSum + (h.accuracy ?? 0),
        accN: o.accN + (h.accuracy === null ? 0 : 1),
      }
    }
    const known = new Set(s.mistakes.map((m) => m.id))
    const mistakes = [...s.mistakes, ...h.mistakes.filter((m) => !known.has(m.id))].slice(-200)
    return { ...s, mistakes, stats: { ...st, moveClasses, openings, harvested: [...st.harvested, g.id].slice(-200) } }
  })
}

/** Avalia (pelas brancas) a posição depois de um lance — usado para aceitar alternativas na revisão de erros. */
export async function scoreAfterMove(fen: string, uci: string): Promise<Score | null> {
  const chess = new Chess(fen)
  try {
    chess.move(uciToMove(uci))
  } catch {
    return null
  }
  const terminal = terminalEval(chess)
  if (terminal) return terminal.best
  const res = await engines().analyst.analyze({ fen: chess.fen(), depth: ANALYSIS_DEPTH, options: { UCI_LimitStrength: false } })
  return res?.lines[0]?.score ?? null
}

function runBot(g: GameSession) {
  if (g.status !== 'playing') return
  const chess = replay(g)
  if (chess.turn() === g.playerColor || chess.isGameOver()) return
  const tag = `${g.id}:${g.moves.length}`
  if (botBusy === tag) return
  botBusy = tag
  const ply = g.moves.length
  const prefix = g.moves.join()
  const started = Date.now()
  const timeLeft = g.clock ? remaining(g.clock, chess.turn(), chess.turn()) : undefined
  void chooseBotMove(engines().bot, chess.fen(), levelByElo(g.botElo), Math.random, timeLeft).then((uci) => {
    const wait = Math.max(0, 600 - (Date.now() - started))
    setTimeout(() => {
      if (botBusy === tag) botBusy = null
      const cur = getState().current
      if (!uci || !cur || cur.status !== 'playing' || !sameLine(cur, g.id, ply, prefix) || cur.moves.length !== ply) return
      applyMove(cur, replay(cur), uci)
    }, wait)
  })
}

function terminalEval(chess: Chess): PosEval | null {
  if (chess.isCheckmate()) return { best: { cp: chess.turn() === 'w' ? -10000 : 10000 }, depth: 0 }
  if (chess.isGameOver()) return { best: { cp: 0 }, depth: 0 }
  return null
}

function runAnalysis(g: GameSession) {
  let i = 0
  while (i <= g.moves.length && g.evals[i]) i++
  if (i > g.moves.length) return
  const tag = `${g.id}:${i}:${g.moves.slice(0, i).join()}`
  if (analysisBusy === tag) return
  analysisBusy = tag
  const prefix = g.moves.slice(0, i).join()
  const chess = replay(g, i)
  const fen = chess.fen()
  const done = (ev: PosEval | null) => {
    if (analysisBusy === tag) analysisBusy = null
    const cur = getState().current
    if (!ev || !sameLine(cur, g.id, i, prefix)) return tick()
    storeEval(cur!, i, ev)
  }
  const terminal = terminalEval(chess)
  if (terminal) return done(terminal)
  void engines()
    .analyst.analyze({ fen, depth: ANALYSIS_DEPTH, multipv: 2, options: { UCI_LimitStrength: false } })
    .then((res) => {
      if (!res || res.lines.length === 0) return done(null)
      done({ best: res.lines[0].score, second: res.lines[1]?.score, bestUci: res.bestmove, depth: res.lines[0].depth })
    })
}

function storeEval(g: GameSession, i: number, ev: PosEval) {
  const extra: Partial<GameSession> = {}
  const before = g.evals[i - 1]
  if (i >= 1 && before) {
    const prev = replay(g, i - 1)
    const uci = g.moves[i - 1]
    const mover = prev.turn()
    const verdict = judgeMove(prev, uciToMove(uci))
    const after = new Chess(prev.fen())
    const played = after.move(uciToMove(uci))
    const { cls, drop } = classify({
      before,
      after: ev,
      mover,
      playedUci: uci,
      sacrifice: !!verdict && !verdict.mate && verdict.net <= -2,
      inBook: i <= 24 && !!lookupOpening(after.fen()),
    })
    let bestSan: string | undefined
    if (before.bestUci && before.bestUci !== uci) {
      try {
        bestSan = new Chess(prev.fen()).move(uciToMove(before.bestUci)).san
      } catch {
        bestSan = undefined
      }
    }
    extra.reviews = { ...g.reviews, [i]: { cls, drop, bestSan } }
    if (cls !== 'book' && (mover === g.playerColor || ['brilliant', 'great', 'mistake', 'blunder'].includes(cls)))
      extra.coach = addCoach(g.coach, [classificationMessage({ cls, ply: i, san: played.san, byPlayer: mover === g.playerColor, bestSan })])
  }
  setCurrent((cur) => ({ ...cur, ...extra, evals: { ...cur.evals, [i]: ev } }))
}

/** Queda de bandeira: quem está na vez com o relógio zerado perde (empata se o outro só tem o rei). */
function checkFlag() {
  const g = getState().current
  if (!g || g.status !== 'playing' || !g.clock || g.clock.runningSince === null) return
  const chess = replay(g)
  const turn = chess.turn()
  if (remaining(g.clock, turn, turn) > 0) return
  const other: Color = turn === 'w' ? 'b' : 'w'
  const loneKing = chess.board().flat().filter((p) => p && p.color === other).length === 1
  setCurrent((c) => ({ ...c, clock: c.clock ? { ...c.clock, [turn]: 0, runningSince: null } : c.clock }))
  endGame(loneKing ? '1/2-1/2' : turn === 'w' ? '0-1' : '1-0', loneKing ? 'Tempo esgotado (sem material para mate)' : 'Tempo esgotado')
}

/** O relógio pausa quando o app sai da tela (troca de aba, de aparelho ou fecha) e volta ao retornar. */
function setClockRunning(running: boolean) {
  const g = getState().current
  if (!g || g.status !== 'playing' || !g.clock) return
  const turn = replay(g).turn()
  const next = running ? resume(g.clock) : pause(g.clock, turn)
  if (next !== g.clock) setCurrent((c) => ({ ...c, clock: next }))
}

let started = false
export function startController() {
  if (started) return
  started = true
  // Partida retomada (outro dia ou outro aparelho): o tempo fora do app não conta.
  const g = getState().current
  if (g?.status === 'playing' && g.clock?.runningSince) setCurrent((c) => ({ ...c, clock: c.clock ? { ...c.clock, runningSince: Date.now() } : c.clock }))
  setInterval(checkFlag, 250)
  document.addEventListener('visibilitychange', () => setClockRunning(document.visibilityState === 'visible'))
  void loadOpenings().then(tick)
  subscribe(() => queueMicrotask(tick))
  tick()
}
