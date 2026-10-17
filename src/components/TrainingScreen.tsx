import type { Square } from 'chess.js'
import { Chess } from 'chess.js'
import { useMemo, useState, type ReactNode } from 'react'
import { uciToMove } from '../game/controller'
import {
  cardKey,
  endgameById,
  endgameMove,
  GAMES,
  gameMoves,
  guessMove,
  leaveEndgame,
  leaveGuess,
  leaveOpening,
  linesOf,
  nextOpeningLine,
  OPENING_LINES,
  openingMove,
  openingQueue,
  startEndgame,
  startGuess,
  startOpening,
} from '../game/trainers'
import { ENDGAMES } from '../lib/endgames'
import { translateName } from '../lib/openings'
import { uciOf } from '../lib/puzzle'
import { isDue, MASTERED_BOX } from '../lib/srs'
import type { HeatMap } from '../lib/tactics'
import { useAppState } from '../state/store'
import { themeById } from '../themes'
import { Board, type Arrow } from './Board'
import { btn } from './GameScreen'

type View = 'menu' | 'endgames' | 'openings'

export function TrainingScreen() {
  const training = useAppState((s) => s.training)
  const [view, setView] = useState<View>('menu')

  if (training.endgame) return <EndgameView />
  if (training.opening) return <OpeningView />
  if (training.guess) return <GuessView />
  if (view === 'endgames') return <EndgameMenu onBack={() => setView('menu')} />
  if (view === 'openings') return <OpeningMenu onBack={() => setView('menu')} />

  const endgamesDone = Object.keys(training.endgamesDone).length
  const dueLines = Object.values(training.openingCards).filter((c) => isDue(c)).length
  return (
    <main className="grid gap-3 sm:grid-cols-3">
      <MenuCard icon="♔" title="Finais essenciais" text={`Técnica contra o Stockfish na força máxima: mates básicos, oposição, Lucena, Philidor… ${endgamesDone}/${ENDGAMES.length} dominados.`} onClick={() => setView('endgames')} />
      <MenuCard icon="📖" title="Aberturas" text={`Aprenda linhas de 12 aberturas com repetição espaçada: a máquina joga o outro lado, você repete a teoria.${dueLines ? ` ${dueLines} para revisar hoje.` : ''}`} onClick={() => setView('openings')} />
      <MenuCard
        icon="🎓"
        title="Adivinhe o lance"
        text={`Jogue no lugar do vencedor em ${GAMES.length} partidas de jogadores 2300+ do Lichess e compare cada lance com o dele.${training.guessBest !== null ? ` Seu recorde: ${training.guessBest}%.` : ''}`}
        onClick={() => startGuess()}
      />
    </main>
  )
}

function MenuCard({ icon, title, text, onClick }: { icon: string; title: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl bg-stone-800 p-4 text-left transition hover:bg-stone-700">
      <div className="text-3xl">{icon}</div>
      <div className="mt-2 font-semibold">{title}</div>
      <div className="mt-1 text-sm text-stone-400">{text}</div>
    </button>
  )
}

function Layout({ board, side }: { board: ReactNode; side: ReactNode }) {
  return (
    <main className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="mx-auto w-full max-w-[min(100%,calc(100vh-12rem))] lg:max-w-[calc(100vh-9rem)]">{board}</section>
      <aside className="flex min-w-0 flex-col gap-3">{side}</aside>
    </main>
  )
}

function useBoardLook() {
  const settings = useAppState((s) => s.settings)
  return { theme: themeById(settings.boardTheme), pieceSet: settings.pieceSet, showCoords: settings.showCoords }
}

const lastOf = (c: Chess): [Square, Square] | undefined => {
  const m = c.history({ verbose: true }).at(-1)
  return m ? [m.from, m.to] : undefined
}

// ---------- Finais ----------

function EndgameMenu({ onBack }: { onBack: () => void }) {
  const done = useAppState((s) => s.training.endgamesDone)
  return (
    <main>
      <button className={btn + ' mb-3'} onClick={onBack}>
        ← Treinos
      </button>
      <div className="grid gap-2 sm:grid-cols-2">
        {ENDGAMES.map((e) => (
          <button key={e.id} onClick={() => startEndgame(e.id)} className="flex items-start justify-between gap-3 rounded-xl bg-stone-800 p-3 text-left hover:bg-stone-700">
            <div>
              <div className="font-semibold">{e.name}</div>
              <div className="text-xs text-stone-400">
                {e.goal === 'draw' ? '🛡️ Empatar' : '⚔️ Vencer'} jogando de {e.player === 'w' ? 'brancas' : 'pretas'} · até {e.limit} lances
              </div>
            </div>
            {done[e.id] && <span className="text-green-400">✓</span>}
          </button>
        ))}
      </div>
    </main>
  )
}

function EndgameView() {
  const eg = useAppState((s) => s.training.endgame)!
  const look = useBoardLook()
  const e = endgameById(eg.id)
  const chess = useMemo(() => {
    const c = new Chess(e.fen)
    for (const u of eg.moves) c.move(uciToMove(u))
    return c
  }, [e.fen, eg.moves])
  const playing = eg.status === 'playing'
  const myTurn = playing && chess.turn() === e.player
  const goalText = e.goal === 'mate' ? 'Dê xeque-mate' : e.goal === 'promote' ? 'Promova o peão com a vitória garantida' : e.goal === 'bareKing' ? 'Capture o peão adversário' : 'Segure o empate'
  return (
    <Layout
      board={
        <>
          <div className={`mb-1.5 rounded-lg border-l-4 px-3 py-2 text-sm font-semibold ${!playing ? (eg.success ? 'border-green-500 bg-green-900/50' : 'border-red-500 bg-red-900/50') : 'border-amber-500 bg-stone-800'}`}>
            {!playing ? (eg.success ? `🎉 ${eg.message}` : `✗ ${eg.message}`) : myTurn ? `Sua vez — ${goalText.toLowerCase()}.` : 'O motor está pensando…'}
          </div>
          <Board fen={chess.fen()} orientation={e.player} movable={myTurn ? e.player : null} onMove={(f, t, p) => void endgameMove(uciOf({ from: f, to: t, promotion: p }))} lastMove={lastOf(chess)} {...look} />
        </>
      }
      side={
        <>
          <div className="rounded-xl bg-stone-800 p-4 text-sm">
            <div className="text-base font-semibold">{e.name}</div>
            <div className="mt-1 text-stone-400">
              Objetivo: {goalText} em até {e.limit} lances, contra o Stockfish na força máxima.
            </div>
            <p className="mt-2 text-stone-300">💡 {e.tip}</p>
          </div>
          <div className="flex gap-2">
            <button className={btn} onClick={leaveEndgame}>
              ← Finais
            </button>
            <button className={btn} onClick={() => startEndgame(e.id)}>
              ↺ Recomeçar
            </button>
          </div>
        </>
      }
    />
  )
}

// ---------- Aberturas ----------

function OpeningMenu({ onBack }: { onBack: () => void }) {
  const cards = useAppState((s) => s.training.openingCards)
  const training = useAppState((s) => s.training)
  const [colors, setColors] = useState<Record<string, 'w' | 'b'>>({})
  return (
    <main>
      <button className={btn + ' mb-3'} onClick={onBack}>
        ← Treinos
      </button>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPENING_LINES.map((f) => {
          const color = colors[f.family] ?? f.color
          const keys = f.lines.map((_, i) => cardKey(f.family, i, color))
          const learned = keys.filter((k) => cards[k] && cards[k].box >= 2).length
          const mastered = keys.filter((k) => cards[k]?.box >= MASTERED_BOX).length
          const due = keys.filter((k) => cards[k] && isDue(cards[k])).length
          const queue = openingQueue(training, f.family, color)
          return (
            <div key={f.family} className="rounded-xl bg-stone-800 p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{translateName(f.family)}</div>
                <div className="flex gap-1 text-xs">
                  {(['w', 'b'] as const).map((c) => (
                    <button key={c} onClick={() => setColors({ ...colors, [f.family]: c })} className={`rounded px-2 py-0.5 ${color === c ? 'bg-amber-500 font-semibold text-stone-900' : 'bg-stone-700'}`}>
                      {c === 'w' ? '♔ Brancas' : '♚ Pretas'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-1 text-xs text-stone-400">
                {f.lines.length} linhas · {learned} aprendidas · {mastered} dominadas{due ? ` · ${due} para hoje` : ''}
              </div>
              <button className="mt-2 w-full rounded-lg bg-stone-700 py-1.5 text-sm font-semibold hover:bg-stone-600" onClick={() => startOpening(f.family, color)}>
                {due ? `Revisar ${due}` : `Treinar ${queue.length} ${queue.length === 1 ? 'linha' : 'linhas'}`}
              </button>
            </div>
          )
        })}
      </div>
    </main>
  )
}

function OpeningView() {
  const o = useAppState((s) => s.training.opening)!
  const look = useBoardLook()
  const finished = o.index >= o.queue.length
  const line = finished ? null : linesOf(o.family)[o.queue[o.index]]
  const chess = useMemo(() => {
    const c = new Chess()
    if (line) for (const u of line.moves.slice(0, o.step)) c.move(uciToMove(u))
    return c
  }, [line, o.step])

  if (finished || !line) {
    return (
      <main className="mx-auto max-w-md rounded-xl bg-stone-800 p-6 text-center">
        <p className="text-lg font-semibold">Sessão concluída! 📖</p>
        <p className="mt-1 text-sm text-stone-400">As linhas voltam para revisão na data certa (1, 3, 7, 21 e 60 dias).</p>
        <button className="mt-4 rounded-lg bg-amber-500 px-4 py-2 font-bold text-stone-900" onClick={leaveOpening}>
          Voltar
        </button>
      </main>
    )
  }

  const lineDone = o.step >= line.moves.length
  const myTurn = !lineDone && !o.lastWrong && (o.step % 2 === 0 ? 'w' : 'b') === o.color
  const arrows: Arrow[] = []
  const heat: HeatMap = {}
  if (o.lastWrong) {
    const right = uciToMove(line.moves[o.step])
    arrows.push({ from: right.from, to: right.to, color: '#22c55e' })
    heat[o.lastWrong.slice(2, 4) as Square] = { color: 'red', level: 3, reason: '' }
  }
  return (
    <Layout
      board={
        <>
          <div className={`mb-1.5 rounded-lg border-l-4 px-3 py-2 text-sm font-semibold ${o.lastWrong ? 'border-red-500 bg-red-900/50' : lineDone ? (o.mistakes ? 'border-amber-500 bg-amber-900/40' : 'border-green-500 bg-green-900/50') : 'border-amber-500 bg-stone-800'}`}>
            {o.lastWrong ? '✗ Não é a linha. O lance certo está na seta verde.' : lineDone ? (o.mistakes ? `Linha concluída com ${o.mistakes} ${o.mistakes === 1 ? 'erro' : 'erros'}: volta amanhã.` : '✓ Linha perfeita!') : myTurn ? 'Sua vez: jogue o lance da teoria.' : '…'}
          </div>
          <Board fen={chess.fen()} orientation={o.color} movable={myTurn ? o.color : null} onMove={(f, t, p) => openingMove(uciOf({ from: f, to: t, promotion: p }))} lastMove={lastOf(chess)} arrows={arrows} heat={heat} {...look} />
        </>
      }
      side={
        <>
          <div className="text-xs text-stone-400">
            Linha {o.index + 1} de {o.queue.length}
          </div>
          <div className="rounded-xl bg-stone-800 p-4 text-sm">
            <div className="font-semibold">{lineDone ? translateName(line.name) : translateName(o.family)}</div>
            <div className="mt-1 font-mono text-stone-300">{chess.history().map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join(' ') || '—'}</div>
          </div>
          <div className="flex gap-2">
            <button className={btn} onClick={leaveOpening}>
              ← Sair
            </button>
            {lineDone && (
              <button className="flex-1 rounded-lg bg-amber-500 py-2 font-bold text-stone-900" onClick={nextOpeningLine}>
                Próxima linha ▶
              </button>
            )}
          </div>
        </>
      }
    />
  )
}

// ---------- Adivinhe o lance ----------

function GuessView() {
  const g = useAppState((s) => s.training.guess)!
  const look = useBoardLook()
  const moves = gameMoves(g.game)
  const [white, black, we, be, date, result, , site] = GAMES[g.game]
  const chess = useMemo(() => {
    const c = new Chess()
    for (const u of moves.slice(0, g.ply)) c.move(uciToMove(u))
    return c
  }, [moves, g.ply])
  const myTurn = !g.done && (g.ply % 2 === 0 ? 'w' : 'b') === g.side && g.feedback?.text !== 'Comparando com o lance do mestre…'
  const pct = g.max ? Math.round((g.score / g.max) * 100) : 0
  const arrows: Arrow[] = []
  if (g.feedback && g.feedback.points < 5 && g.feedback.guess && g.feedback.master) {
    const mine = uciToMove(g.feedback.guess)
    arrows.push({ from: mine.from, to: mine.to, color: '#a8a29e', dashed: true })
  }
  return (
    <Layout
      board={
        <>
          <div className="mb-1.5 rounded-lg border-l-4 border-amber-500 bg-stone-800 px-3 py-2 text-sm font-semibold">
            {g.done ? `Fim da partida (${result}). Você fez ${g.score} de ${g.max} pontos (${pct}%).` : myTurn ? `Sua vez: o que ${g.side === 'w' ? white : black} jogou aqui?` : 'O adversário joga…'}
          </div>
          <Board fen={chess.fen()} orientation={g.side} movable={myTurn ? g.side : null} onMove={(f, t, p) => void guessMove(uciOf({ from: f, to: t, promotion: p }))} lastMove={lastOf(chess)} arrows={arrows} {...look} />
        </>
      }
      side={
        <>
          <div className="rounded-xl bg-stone-800 p-4 text-sm">
            <div className="font-semibold">
              ♔ {white} ({we}) × ♚ {black} ({be})
            </div>
            <div className="text-xs text-stone-400">
              Lichess · {date.replace(/\./g, '/')} ·{' '}
              <a className="underline" href={site} target="_blank" rel="noreferrer">
                ver partida
              </a>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-stone-900/60 py-2">
                <div className="text-xl font-bold">{g.score}</div>
                <div className="text-[11px] text-stone-400">pontos (de {g.max})</div>
              </div>
              <div className="rounded-lg bg-stone-900/60 py-2">
                <div className="text-xl font-bold">{pct}%</div>
                <div className="text-[11px] text-stone-400">aproveitamento</div>
              </div>
            </div>
          </div>
          {g.feedback && (
            <div className={`rounded-xl border-l-4 p-3 text-sm ${g.feedback.points >= 4 ? 'border-green-500 bg-green-900/40' : g.feedback.points >= 2 ? 'border-amber-500 bg-amber-900/30' : g.feedback.master ? 'border-red-500 bg-red-900/40' : 'border-stone-500 bg-stone-800'}`}>
              <div className="font-semibold">
                {g.feedback.text} {g.feedback.master && `(+${g.feedback.points})`}
              </div>
              {g.feedback.master && g.feedback.points < 5 && <div className="mt-1 text-stone-300">O mestre jogou {g.feedback.master}. Seu lance está na seta cinza tracejada.</div>}
            </div>
          )}
          <p className="text-xs text-stone-500">Igual ao mestre: 5 pontos · tão bom quanto (pelo motor): 4 · razoável: 2.</p>
          <div className="flex gap-2">
            <button className={btn} onClick={leaveGuess}>
              ← Sair
            </button>
            <button className={btn} onClick={() => startGuess()}>
              🎲 Outra partida
            </button>
          </div>
        </>
      }
    />
  )
}
