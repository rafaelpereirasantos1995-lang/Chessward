import { Chess } from 'chess.js'
import { useEffect, useMemo, useRef } from 'react'
import { CLASS_INFO, formatScore, winPct, type PosEval } from '../lib/analysis'
import type { CoachMsg } from '../lib/coach'
import { uciToMove } from '../game/controller'
import type { GameSession } from '../state/types'

export function EvalBar({ ev, orientation, terminal }: { ev?: PosEval; orientation: 'w' | 'b'; terminal?: string }) {
  const white = ev ? winPct(ev.best) : 50
  const label = terminal ?? (ev ? formatScore(ev.best) : '…')
  const whiteOnBottom = orientation === 'w'
  return (
    <div className="relative w-4 shrink-0 overflow-hidden rounded-sm bg-stone-700 sm:w-6" title="Avaliação do motor">
      <div className="absolute inset-x-0 bg-stone-100 transition-all duration-500" style={whiteOnBottom ? { bottom: 0, height: `${white}%` } : { top: 0, height: `${white}%` }} />
      <div className={`absolute inset-x-0 text-center text-[8px] font-bold sm:text-[10px] ${white >= 50 === whiteOnBottom ? 'bottom-1 text-stone-800' : 'top-1 text-stone-100'}`}>{label}</div>
    </div>
  )
}

export function MoveList({ game, viewPly, onSelect, showReviews }: { game: GameSession; viewPly: number; onSelect: (ply: number) => void; showReviews: boolean }) {
  const sans = useMemo(() => {
    const chess = new Chess(game.startFen)
    return game.moves.map((u) => chess.move(uciToMove(u)).san)
  }, [game.startFen, game.moves])
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [viewPly])

  const rows = []
  for (let i = 0; i < sans.length; i += 2) {
    rows.push(
      <div key={i} className="grid grid-cols-[2.2rem_1fr_1fr] items-center text-sm">
        <span className="text-stone-500">{i / 2 + 1}.</span>
        {[i, i + 1].map((j) => {
          if (j >= sans.length) return <span key={j} />
          const ply = j + 1
          const r = showReviews ? game.reviews[ply] : undefined
          const info = r ? CLASS_INFO[r.cls] : undefined
          return (
            <button
              key={j}
              data-active={viewPly === ply}
              onClick={() => onSelect(ply)}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-left font-mono ${viewPly === ply ? 'bg-stone-600' : 'hover:bg-stone-700'}`}
            >
              {sans[j]}
              {info && !['best', 'excellent', 'good', 'book'].includes(r!.cls) && (
                <span className="text-xs font-bold" style={{ color: info.color }}>
                  {info.symbol}
                </span>
              )}
            </button>
          )
        })}
      </div>,
    )
  }
  return (
    <div ref={ref} className="max-h-40 overflow-y-auto rounded-lg bg-stone-800 p-2 lg:max-h-56">
      {rows.length ? rows : <p className="text-sm text-stone-500">Nenhum lance ainda.</p>}
    </div>
  )
}

const TONE: Record<CoachMsg['tone'], string> = {
  good: 'border-green-600/60 bg-green-950/40',
  bad: 'border-red-600/60 bg-red-950/40',
  warn: 'border-amber-500/60 bg-amber-950/30',
  info: 'border-sky-600/50 bg-sky-950/30',
}

export function CoachFeed({ messages, locked }: { messages: CoachMsg[]; locked: boolean }) {
  if (locked)
    return (
      <div className="rounded-lg border border-stone-700 bg-stone-800 p-4 text-sm text-stone-400">
        🔒 Modo Desafio: o treinador fica em silêncio durante a partida. Os comentários e a análise completa aparecem no final.
      </div>
    )
  const list = [...messages].reverse()
  return (
    <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[52vh]">
      {list.map((m, i) => (
        <div key={m.key + i} className={`rounded-lg border-l-4 p-2.5 text-sm ${TONE[m.tone]} ${i === 0 ? 'ring-1 ring-stone-500/40' : 'opacity-90'}`}>
          <div className="flex items-start gap-2">
            <span className="min-w-[1.5rem] text-center font-bold">{m.icon}</span>
            <div>
              <div className="font-semibold leading-snug">{m.title}</div>
              {m.text && <div className="mt-0.5 leading-snug text-stone-300">{m.text}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
