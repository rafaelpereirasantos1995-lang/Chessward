import type { Square } from 'chess.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Board, type Arrow } from './Board'
import { GameOverDialog, NewGameDialog } from './Dialogs'
import { CoachFeed, EvalBar, MoveList } from './Panels'
import { newGame, playerMove, replay, resign, undo, uciToMove } from '../game/controller'
import { CLASS_INFO, type MoveClass } from '../lib/analysis'
import { levelByElo } from '../lib/bot'
import { positionHeat, previewMoves } from '../lib/tactics'
import { useAppState } from '../state/store'
import { themeById } from '../themes'

type Dialog = 'new' | 'over' | null

export const btn = 'rounded-lg bg-stone-800 px-3 py-2 text-sm font-medium hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-stone-800'

export function GameScreen({ newRequest }: { newRequest: number }) {
  const settings = useAppState((s) => s.settings)
  const profile = useAppState((s) => s.profile)
  const game = useAppState((s) => s.current)
  const [dialog, setDialog] = useState<Dialog>(game ? null : 'new')
  const [viewPly, setViewPly] = useState<number | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [hintPly, setHintPly] = useState<number | null>(null)
  const [seenEnd, setSeenEnd] = useState<string | null>(game?.status === 'ended' ? game.id : null)

  useEffect(() => {
    if (newRequest > 0) setDialog('new')
  }, [newRequest])

  // Abre o resumo quando a partida termina.
  useEffect(() => {
    if (game?.status === 'ended' && seenEnd !== game.id) {
      setSeenEnd(game.id)
      setDialog('over')
    }
  }, [game?.status, game?.id, seenEnd])

  // Volta para o lance atual quando a partida avança.
  const moveCount = game?.moves.length ?? 0
  useEffect(() => {
    if (game?.status === 'playing') setViewPly(null)
  }, [moveCount, game?.status])

  const shownPly = viewPly ?? moveCount
  const live = shownPly === moveCount
  const chess = useMemo(() => (game ? replay(game, shownPly) : null), [game, shownPly])
  const fen = chess?.fen() ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  const playing = game?.status === 'playing'
  const ended = game?.status === 'ended'
  const treino = game?.mode === 'treino'
  const helps = !!game && (treino || ended)
  const player = game?.playerColor ?? 'w'
  const orientation = flipped ? (player === 'w' ? 'b' : 'w') : player
  const myTurn = playing && live && chess?.turn() === player

  const heat = useMemo(() => (settings.heatmap && treino && myTurn ? positionHeat(fen, player) : undefined), [settings.heatmap, treino, myTurn, fen, player])
  const previewFor = useCallback((from: Square) => previewMoves(fen, from), [fen])

  const arrows: Arrow[] = []
  if (game && helps) {
    if (hintPly === moveCount && live && treino && game.evals[moveCount]?.bestUci) {
      const m = uciToMove(game.evals[moveCount].bestUci!)
      arrows.push({ from: m.from, to: m.to, color: '#3b82f6' })
    }
    const r = game.reviews[shownPly]
    const prevBest = game.evals[shownPly - 1]?.bestUci
    if (!live || ended) {
      if (r && ['inaccuracy', 'mistake', 'blunder'].includes(r.cls) && prevBest) {
        const m = uciToMove(prevBest)
        arrows.push({ from: m.from, to: m.to, color: '#22c55e' })
      }
    }
  }

  const lastUci = game && shownPly > 0 ? game.moves[shownPly - 1] : undefined
  const lastMove = lastUci ? ([lastUci.slice(0, 2), lastUci.slice(2, 4)] as [Square, Square]) : undefined
  const terminal = chess?.isCheckmate() ? '#' : chess?.isGameOver() ? '½' : undefined
  const level = game ? levelByElo(game.botElo) : null
  const lastReview = game?.reviews[shownPly]

  return (
    <>
      <main className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="mx-auto w-full max-w-[min(100%,calc(100vh-12rem))] lg:max-w-[calc(100vh-9rem)]">
          <PlayerStrip label={level ? `🤖 ${level.name}` : '🤖 Máquina'} sub={level ? `≈ ${level.elo}` : ''} active={playing && chess?.turn() !== player} />
          <div className="my-1.5 flex gap-1.5">
            {helps && <EvalBar ev={game?.evals[shownPly]} orientation={orientation} terminal={terminal} />}
            <div className="min-w-0 flex-1">
              <Board
                fen={fen}
                orientation={orientation}
                movable={myTurn ? player : null}
                onMove={(from, to, promo) => playerMove(from, to, promo)}
                lastMove={lastMove}
                heat={heat}
                previewFor={settings.preview && treino && myTurn ? previewFor : undefined}
                arrows={arrows}
                theme={themeById(settings.boardTheme)}
                pieceSet={settings.pieceSet}
                showCoords={settings.showCoords}
              />
            </div>
          </div>
          <PlayerStrip label="🙂 Você" sub={`${profile.rating}`} active={!!myTurn} />

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button className={btn} disabled={!game || shownPly === 0} onClick={() => setViewPly(0)} aria-label="Início">
              ⏮
            </button>
            <button className={btn} disabled={!game || shownPly === 0} onClick={() => setViewPly(shownPly - 1)} aria-label="Anterior">
              ◀
            </button>
            <button className={btn} disabled={!game || live} onClick={() => setViewPly(Math.min(moveCount, shownPly + 1))} aria-label="Próximo">
              ▶
            </button>
            <button className={btn} disabled={!game || live} onClick={() => setViewPly(null)} aria-label="Atual">
              ⏭
            </button>
            <button className={btn} onClick={() => setFlipped(!flipped)} title="Virar tabuleiro">
              🔄
            </button>
            <div className="flex-1" />
            {playing && treino && (
              <>
                <button className={btn} disabled={!myTurn || !game?.evals[moveCount]} onClick={() => setHintPly(moveCount)} title="Mostra o melhor lance">
                  💡 Dica
                </button>
                <button className={btn} disabled={moveCount === 0} onClick={undo}>
                  ↩ Desfazer
                </button>
              </>
            )}
            {playing && (
              <button
                className={btn}
                onClick={() => {
                  if (confirm(game?.mode === 'desafio' ? 'Desistir? Conta como derrota no rating.' : 'Desistir desta partida?')) resign()
                }}
              >
                🏳️ Desistir
              </button>
            )}
            {ended && (
              <button className={btn} onClick={() => setDialog('over')}>
                📊 Resumo
              </button>
            )}
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-3">
          {!game && (
            <div className="rounded-xl bg-stone-800 p-4 text-sm text-stone-300">
              <p className="font-semibold text-stone-100">Bem-vindo ao seu centro de treinamento!</p>
              <p className="mt-1">Seu rating começa em {profile.rating}. Partidas no modo Desafio fazem ele subir conforme você evolui.</p>
              <button className="mt-3 w-full rounded-lg bg-amber-500 py-2 font-bold text-stone-900" onClick={() => setDialog('new')}>
                Começar uma partida
              </button>
            </div>
          )}
          {game && (
            <>
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>
                  {game.mode === 'treino' ? '🎓 Treino' : '🏆 Desafio'} · {ended ? `Terminada (${game.result})` : 'Em andamento'}
                </span>
                {!live && <span className="text-amber-400">Revendo lance {shownPly}</span>}
              </div>
              {helps && lastReview && <ReviewBadge cls={lastReview.cls} bestSan={lastReview.bestSan} />}
              <MoveList game={game} viewPly={shownPly} onSelect={(p) => setViewPly(p === moveCount ? null : p)} showReviews={helps} />
              {settings.coach && <CoachFeed messages={game.coach.filter((m) => m.ply <= shownPly)} locked={game.mode === 'desafio' && playing} />}
              {treino && myTurn && settings.heatmap && (
                <p className="text-xs text-stone-500">
                  <span className="text-red-400">■</span> vulnerável · <span className="text-green-400">■</span> você ganha material · segure uma peça para ver cada destino
                </p>
              )}
            </>
          )}
        </aside>
      </main>

      {dialog === 'new' && (
        <NewGameDialog
          onClose={() => setDialog(null)}
          onStart={(o) => {
            newGame(o)
            setFlipped(false)
            setViewPly(null)
            setHintPly(null)
            setDialog(null)
          }}
        />
      )}
      {dialog === 'over' && game && (
        <GameOverDialog
          game={game}
          onClose={() => setDialog(null)}
          onNew={() => setDialog('new')}
          onReview={() => {
            setViewPly(0)
            setDialog(null)
          }}
        />
      )}
    </>
  )
}

function PlayerStrip({ label, sub, active }: { label: string; sub: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md px-1 text-sm">
      <span className="font-semibold">
        {label} <span className="font-normal text-stone-400">{sub}</span>
      </span>
      {active && <span className="animate-pulse text-xs text-amber-400">● na vez</span>}
    </div>
  )
}

function ReviewBadge({ cls, bestSan }: { cls: MoveClass; bestSan?: string }) {
  const info = CLASS_INFO[cls]
  return (
    <div className="flex items-center gap-2 rounded-lg bg-stone-800 px-3 py-2 text-sm">
      <span className="font-bold" style={{ color: info.color }}>
        {info.symbol} {info.label}
      </span>
      {bestSan && !['best', 'excellent', 'good', 'book', 'brilliant', 'great'].includes(cls) && <span className="text-stone-400">· melhor era {bestSan}</span>}
    </div>
  )
}
