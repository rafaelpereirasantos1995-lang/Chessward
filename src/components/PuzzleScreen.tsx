import type { Square } from 'chess.js'
import { Chess } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import { loadPuzzles, nextPuzzle, puzzleMove, setFilter, showSolution, usePuzzleCount } from '../game/puzzles'
import { puzzlePosition, THEME_FILTERS, themeLabel, uciOf } from '../lib/puzzle'
import type { HeatMap } from '../lib/tactics'
import { getState, useAppState } from '../state/store'
import { themeById } from '../themes'
import { Board } from './Board'
import { btn } from './GameScreen'

export function PuzzleScreen() {
  const settings = useAppState((s) => s.settings)
  const stats = useAppState((s) => s.puzzles)
  const cur = stats.current
  const count = usePuzzleCount()
  const [flash, setFlash] = useState<{ fen: string; uci: string } | null>(null)
  const [viewStep, setViewStep] = useState<number | null>(null)

  useEffect(() => {
    void loadPuzzles().then(() => {
      if (!getState().puzzles.current) void nextPuzzle()
    })
  }, [])

  // Novo desafio ou novo lance: volta para a posição atual.
  const id = cur?.puzzle.id
  const step = cur?.step ?? 0
  useEffect(() => setViewStep(null), [id, step])

  const solver = useMemo(() => (cur ? (new Chess(cur.puzzle.fen).turn() === 'w' ? 'b' : 'w') : 'w'), [cur])
  const shownStep = viewStep ?? step
  const position = useMemo(() => (cur ? puzzlePosition(cur.puzzle, shownStep) : new Chess()), [cur, shownStep])
  const fen = flash?.fen ?? position.fen()
  const done = cur?.status === 'done'
  const myTurn = !!cur && cur.status === 'playing' && step % 2 === 1 && !cur.solutionShown && viewStep === null && !flash

  const lastUci = flash?.uci ?? (cur && shownStep > 0 ? cur.puzzle.moves[shownStep - 1] : undefined)
  const lastMove = lastUci ? ([lastUci.slice(0, 2), lastUci.slice(2, 4)] as [Square, Square]) : undefined

  // Retorno visual do último lance do jogador: verde (certo) ou vermelho (errado).
  const heat: HeatMap = {}
  if (flash) heat[flash.uci.slice(2, 4) as Square] = { color: 'red', level: 3, reason: 'Lance errado' }
  else if (cur?.feedback?.ok && viewStep === null && cur.puzzle.moves[step - 1] === cur.feedback.uci)
    heat[cur.feedback.uci.slice(2, 4) as Square] = { color: 'green', level: 2, reason: 'Correto' }

  const onMove = (from: Square, to: Square, promotion?: string) => {
    const uci = uciOf({ from, to, promotion })
    const before = fen
    const result = puzzleMove(uci)
    if (result === 'wrong') {
      const c = new Chess(before)
      c.move({ from, to, promotion })
      setFlash({ fen: c.fen(), uci })
      setTimeout(() => setFlash(null), 700)
    }
  }

  const delta = cur?.ratingAfter !== undefined ? cur.ratingAfter - cur.ratingBefore : null
  const sideName = solver === 'w' ? 'Brancas' : 'Pretas'

  let status: { text: string; tone: string }
  if (!cur || count === null) status = { text: 'Carregando desafios…', tone: 'bg-stone-800' }
  else if (done && !cur.failed) status = { text: '🎉 Resolvido!', tone: 'bg-green-900/60 border-green-500' }
  else if (done && cur.solutionShown) status = { text: '📖 Solução mostrada', tone: 'bg-stone-800 border-stone-500' }
  else if (done) status = { text: '✔️ Resolvido (com erro)', tone: 'bg-amber-900/40 border-amber-500' }
  else if (cur.solutionShown) status = { text: 'Mostrando a solução…', tone: 'bg-stone-800 border-stone-500' }
  else if (flash || (cur.feedback && !cur.feedback.ok)) status = { text: '✗ Não é esse lance. Tente outro!', tone: 'bg-red-900/50 border-red-500' }
  else if (step === 0) status = { text: 'Observe o lance do adversário…', tone: 'bg-stone-800 border-stone-600' }
  else if (step % 2 === 0) status = { text: '✓ Correto! O adversário responde…', tone: 'bg-green-900/40 border-green-600' }
  else if (cur.feedback?.ok) status = { text: `✓ Correto! Continue — melhor lance para as ${sideName}.`, tone: 'bg-green-900/40 border-green-600' }
  else status = { text: `Sua vez: encontre o melhor lance para as ${sideName}.`, tone: 'bg-stone-800 border-amber-500' }

  const pct = stats.played ? Math.round((stats.solved / stats.played) * 100) : 0

  return (
    <main className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="mx-auto w-full max-w-[min(100%,calc(100vh-12rem))] lg:max-w-[calc(100vh-9rem)]">
        <div className={`mb-1.5 rounded-lg border-l-4 px-3 py-2 text-sm font-semibold ${status.tone}`}>{status.text}</div>
        <Board
          fen={fen}
          orientation={solver}
          movable={myTurn ? solver : null}
          onMove={onMove}
          lastMove={lastMove}
          heat={heat}
          theme={themeById(settings.boardTheme)}
          pieceSet={settings.pieceSet}
          showCoords={settings.showCoords}
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {done && (
            <>
              <button className={btn} disabled={shownStep === 0} onClick={() => setViewStep(shownStep - 1)} aria-label="Lance anterior">
                ◀
              </button>
              <button className={btn} disabled={viewStep === null} onClick={() => setViewStep(shownStep + 1 >= step ? null : shownStep + 1)} aria-label="Próximo lance">
                ▶
              </button>
            </>
          )}
          <div className="flex-1" />
          {cur?.status === 'playing' && !cur.solutionShown && (
            <button className={btn} disabled={step === 0} onClick={showSolution}>
              👁️ Ver solução
            </button>
          )}
          <button className={done ? 'rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-stone-900 hover:bg-amber-400' : btn} onClick={() => void nextPuzzle()}>
            {done ? 'Próximo desafio ▶' : 'Pular ⏭'}
          </button>
        </div>
      </section>

      <aside className="flex min-w-0 flex-col gap-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Rating testes" value={String(stats.rating)} accent />
          <Stat label="Acertos" value={`${stats.solved}/${stats.played}`} sub={stats.played ? `${pct}%` : undefined} />
          <Stat label="Sequência" value={`🔥 ${stats.streak}`} sub={`recorde ${stats.bestStreak}`} />
        </div>

        {done && cur && (
          <div className="rounded-xl bg-stone-800 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>
                Desafio de rating <b>{cur.puzzle.rating}</b>
              </span>
              {delta !== null && (
                <span className={delta >= 0 ? 'font-bold text-green-400' : 'font-bold text-red-400'}>
                  {delta >= 0 ? '+' : ''}
                  {delta}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cur.puzzle.themes.map((t) => (
                <span key={t} className="rounded-full bg-stone-700 px-2 py-0.5 text-xs">
                  {themeLabel(t)}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-400">Use ◀ ▶ para rever a solução lance a lance.</p>
          </div>
        )}

        <div className="rounded-xl bg-stone-800 p-3">
          <h3 className="mb-2 text-sm font-semibold text-stone-300">Tipo de desafio</h3>
          <div className="flex flex-wrap gap-1.5">
            {THEME_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-3 py-1 text-xs ${stats.filter === f.id ? 'bg-amber-500 font-semibold text-stone-900' : 'bg-stone-700 hover:bg-stone-600'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs leading-relaxed text-stone-500">
          Sem ajudas: encontre a sequência inteira. Cada lance certo faz o adversário responder até o desafio acabar. Errar uma vez já conta como erro no rating, mas você pode continuar tentando ou ver a solução.
          {count !== null && ` · ${count} desafios disponíveis.`}
        </p>
      </aside>
    </main>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-800 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`text-lg font-bold ${accent ? 'text-amber-400' : ''}`}>{value}</div>
      {sub && <div className="text-[10px] text-stone-500">{sub}</div>}
    </div>
  )
}
