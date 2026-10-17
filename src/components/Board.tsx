import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { HeatMap, HeatMark } from '../lib/tactics'
import { pieceUrl, type BoardTheme } from '../themes'

export interface Arrow {
  from: Square
  to: Square
  color: string
  /** Seta tracejada (lances futuros/ameaças). */
  dashed?: boolean
}

interface Props {
  fen: string
  orientation: Color
  /** Cor que pode mover agora (null = tabuleiro só de leitura). */
  movable: Color | null
  onMove: (from: Square, to: Square, promotion?: string) => void
  lastMove?: [Square, Square]
  heat?: HeatMap
  previewFor?: (from: Square) => HeatMap
  arrows?: Arrow[]
  theme: BoardTheme
  pieceSet: string
  showCoords: boolean
}

const FILES = 'abcdefgh'
const squareAt = (col: number, row: number, orientation: Color): Square =>
  (orientation === 'w' ? FILES[col] + (8 - row) : FILES[7 - col] + (row + 1)) as Square
const coordsOf = (sq: Square, orientation: Color): [number, number] => {
  const f = FILES.indexOf(sq[0])
  const r = Number(sq[1])
  return orientation === 'w' ? [f, 8 - r] : [7 - f, r - 1]
}

function heatStyle(mark: HeatMark | undefined) {
  if (!mark) return undefined
  const alpha = [0, 0.28, 0.42, 0.58][mark.level]
  const rgb = mark.color === 'red' ? '220,38,38' : '22,163,74'
  return { background: `rgba(${rgb},${alpha})`, boxShadow: `inset 0 0 0 3px rgba(${rgb},${Math.min(1, alpha + 0.3)})` }
}

export function Board({ fen, orientation, movable, onMove, lastMove, heat, previewFor, arrows, theme, pieceSet, showCoords }: Props) {
  const chess = useMemo(() => new Chess(fen), [fen])
  const boardRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<Square | null>(null)
  const [drag, setDrag] = useState<{ x: number; y: number; size: number } | null>(null)
  const [hover, setHover] = useState<Square | null>(null)
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null)
  const [lastFen, setLastFen] = useState(fen)

  if (lastFen !== fen) {
    // Nova posição: limpa seleção pendente.
    setLastFen(fen)
    setSelected(null)
    setDrag(null)
    setPromotion(null)
  }

  const canMove = movable !== null && chess.turn() === movable
  const dests = useMemo(() => (selected ? chess.moves({ square: selected, verbose: true }) : []), [chess, selected])
  const destSet = useMemo(() => new Set(dests.map((m) => m.to)), [dests])
  const preview = useMemo(() => (selected && previewFor ? previewFor(selected) : {}), [selected, previewFor])

  const squareFromPoint = (clientX: number, clientY: number): Square | null => {
    const rect = boardRef.current!.getBoundingClientRect()
    const col = Math.floor(((clientX - rect.left) / rect.width) * 8)
    const row = Math.floor(((clientY - rect.top) / rect.height) * 8)
    if (col < 0 || col > 7 || row < 0 || row > 7) return null
    return squareAt(col, row, orientation)
  }

  const tryMove = (from: Square, to: Square) => {
    const m = dests.find((d) => d.from === from && d.to === to)
    if (!m) return false
    if (m.promotion) setPromotion({ from, to })
    else {
      onMove(from, to)
      setSelected(null)
    }
    return true
  }

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!canMove || promotion) return
    const sq = squareFromPoint(e.clientX, e.clientY)
    if (!sq) return
    if (selected && destSet.has(sq)) {
      tryMove(selected, sq)
      return
    }
    const piece = chess.get(sq)
    if (piece && piece.color === movable) {
      setSelected(sq)
      const rect = boardRef.current!.getBoundingClientRect()
      setDrag({ x: e.clientX, y: e.clientY, size: rect.width / 8 })
      setHover(sq)
      boardRef.current!.setPointerCapture(e.pointerId)
    } else setSelected(null)
  }

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag) return
    setDrag({ ...drag, x: e.clientX, y: e.clientY })
    setHover(squareFromPoint(e.clientX, e.clientY))
  }

  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag) return
    setDrag(null)
    setHover(null)
    const sq = squareFromPoint(e.clientX, e.clientY)
    if (selected && sq && sq !== selected) {
      if (!tryMove(selected, sq)) setSelected(null)
    }
  }

  const checkSquare = chess.inCheck() ? chess.board().flat().find((p) => p?.type === 'k' && p.color === chess.turn())?.square : undefined
  const hoverInfo = drag && hover && hover !== selected ? preview[hover] : undefined

  const cells = []
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = squareAt(col, row, orientation)
      const light = (FILES.indexOf(sq[0]) + Number(sq[1])) % 2 === 1
      const piece = chess.get(sq)
      const isLast = lastMove && (lastMove[0] === sq || lastMove[1] === sq)
      const isDest = destSet.has(sq)
      const pv = preview[sq]
      const hidden = drag && selected === sq
      cells.push(
        <div key={sq} className="relative" style={{ background: light ? theme.light : theme.dark }}>
          {isLast && <div className="absolute inset-0" style={{ background: 'rgba(250,204,21,0.35)' }} />}
          {selected === sq && <div className="absolute inset-0" style={{ background: 'rgba(59,130,246,0.45)' }} />}
          {!selected && heat?.[sq] && <div className="absolute inset-0" style={heatStyle(heat[sq])} />}
          {checkSquare === sq && <div className="absolute inset-0" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.9) 0%, rgba(239,68,68,0.4) 45%, transparent 75%)' }} />}
          {isDest && pv && <div className="absolute inset-0" style={heatStyle(pv)} />}
          {drag && hover === sq && isDest && <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.75)' }} />}
          {piece && (
            <img
              src={pieceUrl(pieceSet, piece.color, piece.type)}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full select-none"
              style={{ opacity: hidden ? 0.3 : 1, pointerEvents: 'none' }}
            />
          )}
          {isDest && !piece && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-[30%] w-[30%] rounded-full" style={{ background: pv ? (pv.color === 'red' ? 'rgba(185,28,28,0.85)' : 'rgba(21,128,61,0.85)') : 'rgba(0,0,0,0.25)' }} />
            </div>
          )}
          {isDest && piece && <div className="absolute inset-[4%] rounded-full" style={{ boxShadow: `inset 0 0 0 5px ${pv ? (pv.color === 'red' ? 'rgba(185,28,28,0.85)' : 'rgba(21,128,61,0.85)') : 'rgba(0,0,0,0.3)'}` }} />}
          {showCoords && col === 0 && <span className="pointer-events-none absolute left-0.5 top-0 text-[10px] font-semibold sm:text-xs" style={{ color: light ? theme.dark : theme.light }}>{sq[1]}</span>}
          {showCoords && row === 7 && <span className="pointer-events-none absolute bottom-0 right-1 text-[10px] font-semibold sm:text-xs" style={{ color: light ? theme.dark : theme.light }}>{sq[0]}</span>}
        </div>,
      )
    }
  }

  const promoColor = chess.turn()
  return (
    <div className="relative w-full select-none" style={{ aspectRatio: '1 / 1', touchAction: 'none' }}>
      <div
        ref={boardRef}
        className="grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-md shadow-2xl"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        {cells}
      </div>

      {arrows && arrows.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 8 8">
          <defs>
            {arrows.map((a, i) => (
              <marker key={i} id={`ah${i}`} markerWidth="3" markerHeight="3" refX="1.5" refY="1.5" orient="auto">
                <path d="M0,0 L3,1.5 L0,3 z" fill={a.color} />
              </marker>
            ))}
          </defs>
          {arrows.map((a, i) => {
            const [x1, y1] = coordsOf(a.from, orientation)
            const [x2, y2] = coordsOf(a.to, orientation)
            const dx = x2 - x1
            const dy = y2 - y1
            const len = Math.hypot(dx, dy)
            const shorten = 0.35 / len
            return (
              <line key={i} x1={x1 + 0.5} y1={y1 + 0.5} x2={x2 + 0.5 - dx * shorten} y2={y2 + 0.5 - dy * shorten} stroke={a.color} strokeWidth="0.16" strokeLinecap="round" strokeDasharray={a.dashed ? '0.25 0.18' : undefined} markerEnd={`url(#ah${i})`} opacity={a.dashed ? 0.75 : 0.85} />
            )
          })}
        </svg>
      )}

      {hoverInfo && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full px-3 py-1 text-sm font-semibold text-white shadow-lg" style={{ background: hoverInfo.color === 'red' ? '#b91c1c' : '#15803d' }}>
          {hoverInfo.reason}
        </div>
      )}

      {drag && selected && chess.get(selected) && (
        <img
          src={pieceUrl(pieceSet, chess.get(selected)!.color, chess.get(selected)!.type)}
          alt=""
          className="pointer-events-none fixed z-50"
          style={{ width: drag.size * 1.1, height: drag.size * 1.1, left: drag.x - drag.size * 0.55, top: drag.y - drag.size * 0.55 }}
        />
      )}

      {promotion && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50" onClick={() => setPromotion(null)}>
          <div className="flex gap-2 rounded-lg bg-stone-800 p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((p) => (
              <button
                key={p}
                className="h-16 w-16 rounded-md bg-stone-700 hover:bg-stone-600"
                onClick={() => {
                  onMove(promotion.from, promotion.to, p)
                  setPromotion(null)
                  setSelected(null)
                }}
              >
                <img src={pieceUrl(pieceSet, promoColor, p)} alt={p} className="h-full w-full" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
