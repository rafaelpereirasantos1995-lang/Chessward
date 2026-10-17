import type { Square } from 'chess.js'
import { Chess } from 'chess.js'
import { useMemo, useState } from 'react'
import { scoreAfterMove, uciToMove } from '../game/controller'
import { CLASS_INFO, povWin, type MoveClass } from '../lib/analysis'
import { themeLabel, uciOf } from '../lib/puzzle'
import { isDue, MASTERED_BOX, reviewCard } from '../lib/srs'
import type { MistakeCard } from '../lib/stats'
import type { HeatMap } from '../lib/tactics'
import { update, useAppState } from '../state/store'
import { themeById } from '../themes'
import { Board, type Arrow } from './Board'
import { btn } from './GameScreen'

// Cores das séries validadas para o fundo escuro (stone-800): partidas = âmbar, testes = azul.
const SERIES = [
  { key: 'games', label: 'Partidas (Desafio)', color: '#c27c0e' },
  { key: 'puzzles', label: 'Testes', color: '#0284c7' },
] as const

export function EvolutionScreen() {
  const stats = useAppState((s) => s.stats)
  const profile = useAppState((s) => s.profile)
  const puzzles = useAppState((s) => s.puzzles)
  const mistakes = useAppState((s) => s.mistakes)
  const [reviewing, setReviewing] = useState(false)

  const due = mistakes.filter((m) => isDue(m))
  const mastered = mistakes.filter((m) => m.box >= MASTERED_BOX).length

  if (reviewing) return <MistakeReview onExit={() => setReviewing(false)} />

  const openings = Object.entries(stats.openings).sort((a, b) => b[1].games - a[1].games)
  const themes = Object.entries(stats.byTheme)
    .filter(([, v]) => v.played >= 3)
    .map(([k, v]) => ({ k, ...v, pct: v.solved / v.played }))
    .sort((a, b) => a.pct - b.pct)
  const classTotal = Object.values(stats.moveClasses).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <main className="grid gap-4 lg:grid-cols-2">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:col-span-2">
        <Tile label="Rating partidas" value={profile.rating} sub={`recorde ${profile.peak}`} />
        <Tile label="Rating testes" value={puzzles.rating} sub={`recorde ${puzzles.peak}`} />
        <Tile label="Partidas valendo" value={`${profile.wins}V ${profile.draws}E ${profile.losses}D`} sub={`${profile.ratedGames} no total`} />
        <Tile label="Testes" value={`${puzzles.solved}/${puzzles.played}`} sub={puzzles.played ? `${Math.round((puzzles.solved / puzzles.played) * 100)}% de acerto` : 'nenhum ainda'} />
      </section>

      <Card title="Evolução do rating" className="lg:col-span-2">
        <RatingChart games={stats.ratingHistory} puzzles={stats.puzzleHistory} />
      </Card>

      <Card title="🔁 Revisar meus erros">
        <p className="text-sm text-stone-300">
          Cada erro ou capivarada das suas partidas vira um desafio. Acertou, ele volta mais tarde (1, 3, 7, 21 e 60 dias); errou, volta amanhã.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <Mini label="Para hoje" value={due.length} />
          <Mini label="Na fila" value={mistakes.length - mastered} />
          <Mini label="Dominados" value={mastered} />
        </div>
        <button className="mt-3 w-full rounded-lg bg-amber-500 py-2 font-bold text-stone-900 disabled:opacity-40" disabled={!due.length} onClick={() => setReviewing(true)}>
          {due.length ? `Revisar ${due.length} ${due.length === 1 ? 'erro' : 'erros'}` : mistakes.length ? 'Nada para hoje 🎉' : 'Jogue partidas para gerar revisões'}
        </button>
      </Card>

      <Card title="Qualidade dos seus lances">
        {classTotal === 0 ? (
          <Empty text="Aparece depois da primeira partida analisada." />
        ) : (
          <div className="space-y-1.5">
            {(Object.keys(CLASS_INFO) as MoveClass[])
              .filter((c) => stats.moveClasses[c])
              .map((c) => {
                const n = stats.moveClasses[c] ?? 0
                return (
                  <div key={c} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-sm" title={`${CLASS_INFO[c].label}: ${n} lances`}>
                    <span className="text-stone-300">
                      <span style={{ color: CLASS_INFO[c].color }}>{CLASS_INFO[c].symbol}</span> {CLASS_INFO[c].label}
                    </span>
                    <div className="h-2.5 rounded bg-stone-700">
                      <div className="h-full rounded" style={{ width: `${(n / classTotal) * 100}%`, background: CLASS_INFO[c].color }} />
                    </div>
                    <span className="text-right text-stone-400">{Math.round((n / classTotal) * 100)}%</span>
                  </div>
                )
              })}
          </div>
        )}
      </Card>

      <Card title="Suas aberturas">
        {openings.length === 0 ? (
          <Empty text="Aparece depois das primeiras partidas." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-stone-400">
              <tr>
                <th className="pb-1 font-medium">Abertura</th>
                <th className="pb-1 text-right font-medium">Partidas</th>
                <th className="pb-1 text-right font-medium">Pontos</th>
                <th className="pb-1 text-right font-medium">Precisão</th>
              </tr>
            </thead>
            <tbody>
              {openings.slice(0, 10).map(([name, o]) => (
                <tr key={name} className="border-t border-stone-700">
                  <td className="py-1.5 pr-2">{name}</td>
                  <td className="py-1.5 text-right">{o.games}</td>
                  <td className="py-1.5 text-right">{Math.round(((o.wins + o.draws / 2) / o.games) * 100)}%</td>
                  <td className="py-1.5 text-right">{o.accN ? `${(o.accSum / o.accN).toFixed(0)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Temas táticos (do mais fraco ao mais forte)">
        {themes.length === 0 ? (
          <Empty text="Resolva pelo menos 3 testes de um tema para ele aparecer aqui." />
        ) : (
          <div className="space-y-1.5">
            {themes.slice(0, 12).map((t) => (
              <div key={t.k} className="grid grid-cols-[8rem_1fr_4.5rem] items-center gap-2 text-sm" title={`${themeLabel(t.k)}: ${t.solved} de ${t.played}`}>
                <span className="truncate text-stone-300">{themeLabel(t.k)}</span>
                <div className="h-2.5 rounded bg-stone-700">
                  <div className="h-full rounded bg-sky-600" style={{ width: `${t.pct * 100}%` }} />
                </div>
                <span className="text-right text-stone-400">
                  {Math.round(t.pct * 100)}% <span className="text-[10px]">({t.played})</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  )
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-xl bg-stone-800 p-3">
      <div className="text-[10px] uppercase tracking-wide text-stone-400">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-stone-500">{sub}</div>
    </div>
  )
}

const Mini = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg bg-stone-900/60 py-1.5">
    <div className="text-lg font-bold">{value}</div>
    <div className="text-[11px] text-stone-400">{label}</div>
  </div>
)

const Empty = ({ text }: { text: string }) => <p className="text-sm text-stone-500">{text}</p>

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl bg-stone-800 p-4 ${className}`}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  )
}

type Point = { t: number; r: number }

function RatingChart({ games, puzzles }: { games: Point[]; puzzles: Point[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const series = [
    { ...SERIES[0], data: games },
    { ...SERIES[1], data: puzzles },
  ].filter((s) => s.data.length > 0)
  const all = series.flatMap((s) => s.data)
  if (all.length < 2) return <Empty text="O gráfico aparece depois de algumas partidas valendo rating ou testes." />

  const W = 640
  const H = 220
  const pad = { l: 40, r: 12, t: 10, b: 24 }
  const t0 = Math.min(...all.map((p) => p.t))
  const t1 = Math.max(...all.map((p) => p.t))
  const rMin = Math.floor((Math.min(...all.map((p) => p.r)) - 20) / 50) * 50
  const rMax = Math.ceil((Math.max(...all.map((p) => p.r)) + 20) / 50) * 50
  const x = (t: number) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r)
  const y = (r: number) => pad.t + (1 - (r - rMin) / Math.max(1, rMax - rMin)) * (H - pad.t - pad.b)
  const ticks = [rMin, Math.round((rMin + rMax) / 2), rMax]
  const nearest = (data: Point[], t: number) => data.reduce((b, p) => (Math.abs(p.t - t) < Math.abs(b.t - t) ? p : b))
  const hoverT = hover !== null ? t0 + ((hover - pad.l) / (W - pad.l - pad.r)) * (t1 - t0) : null
  const fmt = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-stone-300">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - rect.left) / rect.width) * W
          setHover(px >= pad.l && px <= W - pad.r ? px : null)
        }}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Rating ao longo do tempo"
      >
        {ticks.map((r) => (
          <g key={r}>
            <line x1={pad.l} x2={W - pad.r} y1={y(r)} y2={y(r)} stroke="#44403c" strokeWidth="1" />
            <text x={pad.l - 6} y={y(r) + 4} textAnchor="end" fontSize="11" fill="#a8a29e">
              {r}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} fontSize="11" fill="#a8a29e">
          {fmt(t0)}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize="11" fill="#a8a29e" textAnchor="end">
          {fmt(t1)}
        </text>
        {series.map((s) => (
          <polyline key={s.key} points={s.data.map((p) => `${x(p.t)},${y(p.r)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {series.map((s) => {
          const last = s.data[s.data.length - 1]
          return <circle key={s.key} cx={x(last.t)} cy={y(last.r)} r="4" fill={s.color} stroke="#292524" strokeWidth="2" />
        })}
        {hoverT !== null && (
          <g>
            <line x1={hover!} x2={hover!} y1={pad.t} y2={H - pad.b} stroke="#78716c" strokeDasharray="3 3" />
            {series.map((s) => {
              const p = nearest(s.data, hoverT)
              return <circle key={s.key} cx={x(p.t)} cy={y(p.r)} r="5" fill={s.color} stroke="#292524" strokeWidth="2" />
            })}
          </g>
        )}
      </svg>
      <div className="h-5 text-xs text-stone-300">
        {hoverT !== null &&
          series.map((s) => {
            const p = nearest(s.data, hoverT)
            return (
              <span key={s.key} className="mr-4">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label}: <b>{p.r}</b> <span className="text-stone-500">({fmt(p.t)})</span>
              </span>
            )
          })}
      </div>
    </div>
  )
}

/** Revisão dos erros: encontre o lance que você deveria ter jogado. */
function MistakeReview({ onExit }: { onExit: () => void }) {
  const settings = useAppState((s) => s.settings)
  const all = useAppState((s) => s.mistakes)
  // A fila é fixada ao abrir, para os cartões revisados não sumirem no meio.
  const [queue] = useState(() => all.filter((m) => isDue(m)).map((m) => m.id))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'solve' | 'checking' | 'right' | 'alt' | 'wrong'>('solve')
  const [tried, setTried] = useState<string | null>(null)
  const card = all.find((m) => m.id === queue[index]) as MistakeCard | undefined
  const chess = useMemo(() => (card ? new Chess(card.fen) : null), [card])

  if (!card || !chess) {
    return (
      <main className="mx-auto max-w-md rounded-xl bg-stone-800 p-6 text-center">
        <p className="text-lg font-semibold">Revisão concluída! 🎉</p>
        <p className="mt-1 text-sm text-stone-400">Os erros voltam na data certa para fixar o aprendizado.</p>
        <button className="mt-4 rounded-lg bg-amber-500 px-4 py-2 font-bold text-stone-900" onClick={onExit}>
          Voltar
        </button>
      </main>
    )
  }

  const color = chess.turn()
  const san = (u: string) => {
    try {
      return new Chess(card.fen).move(uciToMove(u)).san
    } catch {
      return u
    }
  }
  const finish = (correct: boolean) => update((s) => ({ ...s, mistakes: s.mistakes.map((m) => (m.id === card.id ? reviewCard(m, correct) : m)) }))

  const onMove = async (from: Square, to: Square, promotion?: string) => {
    const u = uciOf({ from, to, promotion })
    setTried(u)
    const after = new Chess(card.fen)
    after.move({ from, to, promotion })
    if (u === card.bestUci || after.isCheckmate()) {
      setPhase('right')
      finish(true)
      return
    }
    setPhase('checking')
    const score = await scoreAfterMove(card.fen, u)
    // Aceita alternativas que mantêm quase a mesma chance de vitória do melhor lance.
    const ok = score !== null && povWin(card.bestScore, color) - povWin(score, color) < 5
    setPhase(ok ? 'alt' : 'wrong')
    finish(ok)
  }

  const next = () => {
    setIndex(index + 1)
    setPhase('solve')
    setTried(null)
  }

  const arrows: Arrow[] = []
  const heat: HeatMap = {}
  if (phase === 'wrong' || phase === 'right' || phase === 'alt') {
    const b = uciToMove(card.bestUci)
    arrows.push({ from: b.from, to: b.to, color: '#22c55e' })
  }
  if (phase === 'wrong' && tried) heat[tried.slice(2, 4) as Square] = { color: 'red', level: 3, reason: '' }
  const played = uciToMove(card.playedUci)

  return (
    <main className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="mx-auto w-full max-w-[min(100%,calc(100vh-12rem))] lg:max-w-[calc(100vh-9rem)]">
        <Board
          fen={card.fen}
          orientation={color}
          movable={phase === 'solve' ? color : null}
          onMove={(f, t, p) => void onMove(f, t, p)}
          heat={heat}
          arrows={phase === 'solve' ? [{ from: played.from, to: played.to, color: '#ef4444' }] : arrows}
          theme={themeById(settings.boardTheme)}
          pieceSet={settings.pieceSet}
          showCoords={settings.showCoords}
        />
      </section>
      <aside className="flex flex-col gap-3">
        <div className="text-xs text-stone-400">
          Erro {index + 1} de {queue.length} · {new Date(card.date).toLocaleDateString('pt-BR')}
        </div>
        <div className="rounded-xl bg-stone-800 p-4 text-sm">
          <p>
            Nesta posição você jogou <b className="text-red-400">{san(card.playedUci)}</b> ({CLASS_INFO[card.cls].label.toLowerCase()}, seta vermelha).
          </p>
          <p className="mt-1 text-stone-300">Encontre um lance melhor para as {color === 'w' ? 'Brancas' : 'Pretas'}.</p>
        </div>
        {phase === 'checking' && <div className="rounded-xl bg-stone-800 p-3 text-sm">Analisando seu lance…</div>}
        {phase === 'right' && <div className="rounded-xl border-l-4 border-green-500 bg-green-900/40 p-3 text-sm font-semibold">✓ Isso! {san(card.bestUci)} era o melhor lance.</div>}
        {phase === 'alt' && (
          <div className="rounded-xl border-l-4 border-green-500 bg-green-900/40 p-3 text-sm font-semibold">
            ✓ {tried && san(tried)} também serve! O motor preferia {san(card.bestUci)} (seta verde).
          </div>
        )}
        {phase === 'wrong' && (
          <div className="rounded-xl border-l-4 border-red-500 bg-red-900/40 p-3 text-sm font-semibold">✗ Ainda não. O melhor era {san(card.bestUci)} (seta verde). Ele volta amanhã.</div>
        )}
        <div className="flex gap-2">
          <button className={btn} onClick={onExit}>
            ← Sair
          </button>
          {phase !== 'solve' && phase !== 'checking' && (
            <button className="flex-1 rounded-lg bg-amber-500 py-2 font-bold text-stone-900" onClick={next}>
              Próximo ▶
            </button>
          )}
        </div>
      </aside>
    </main>
  )
}
