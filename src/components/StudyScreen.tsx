import type { Square } from 'chess.js'
import { Chess } from 'chess.js'
import { useEffect, useMemo, useState } from 'react'
import { KIND_LABEL, LEVELS, STUDIES, type Side, type Study, type StudyKind, type StudyLine } from '../data/studies'
import { newGame } from '../game/controller'
import { suggestedLevel } from '../lib/bot'
import { uciOf } from '../lib/puzzle'
import { playMoveSound } from '../lib/sound'
import type { HeatMap } from '../lib/tactics'
import { getState, update, useAppState } from '../state/store'
import { themeById } from '../themes'
import { Board, type Arrow } from './Board'
import { btn } from './GameScreen'

// Seção Estudos: lições do nível mais fraco ao mais forte. Cada lição ensina a desenvolver a
// abertura/estratégia lance a lance, explica o porquê e mostra como se defender dela.

const sideName = (s: Side) => (s === 'w' ? 'Brancas' : 'Pretas')

/** Posições e lances (UCI) de uma linha. */
function playLine(line: StudyLine) {
  const c = new Chess(line.fen)
  const fens = [c.fen()]
  const moves = line.steps.map(([san]) => {
    const m = c.move(san)
    fens.push(c.fen())
    return { uci: m.lan, from: m.from, to: m.to, san: m.san, color: m.color, captured: !!m.captured }
  })
  return { fens, moves }
}

export function StudyScreen() {
  const [openId, setOpenId] = useState<string | null>(null)
  const study = STUDIES.find((s) => s.id === openId)
  if (study) return <LessonView study={study} onBack={() => setOpenId(null)} />
  return <StudyList onOpen={setOpenId} />
}

function StudyList({ onOpen }: { onOpen: (id: string) => void }) {
  const rating = useAppState((s) => s.profile.rating)
  const progress = useAppState((s) => s.studies)
  const [kind, setKind] = useState<StudyKind | 'all'>('all')
  const myLevel = (Object.entries(LEVELS).find(([, l]) => rating >= l.min && rating < l.max)?.[0] ?? '1') as unknown as Study['level']
  const filtered = STUDIES.filter((s) => kind === 'all' || s.kind === kind)
  const done = STUDIES.filter((s) => progress[s.id]?.develop && progress[s.id]?.defend).length

  return (
    <main className="space-y-4">
      <div className="rounded-xl bg-stone-800 p-4 text-sm text-stone-300">
        <p>
          Escolha uma lição: o app ensina <b>como desenvolver</b> lance a lance, <b>por que</b> cada lance é jogado e <b>como se defender</b> — e depois você pratica contra a máquina a partir da posição estudada.
        </p>
        <p className="mt-1 text-xs text-stone-400">
          {done}/{STUDIES.length} lições concluídas · seu nível: <b>{LEVELS[myLevel].name}</b> (rating {rating})
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'abertura', 'gambito', 'armadilha', 'estrategia'] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-xs ${kind === k ? 'bg-amber-500 font-semibold text-stone-900' : 'bg-stone-800 hover:bg-stone-700'}`}>
            {k === 'all' ? 'Todas' : `${KIND_LABEL[k].icon} ${KIND_LABEL[k].label}s`}
          </button>
        ))}
      </div>
      {([1, 2, 3, 4, 5] as const).map((lvl) => {
        const items = filtered.filter((s) => s.level === lvl)
        if (!items.length) return null
        return (
          <section key={lvl}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-300">
              Nível {lvl} — {LEVELS[lvl].name} <span className="font-normal text-stone-500">({LEVELS[lvl].range})</span>
              {lvl === Number(myLevel) && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">seu nível</span>}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((s) => {
                const p = progress[s.id] ?? {}
                return (
                  <button key={s.id} onClick={() => onOpen(s.id)} className="rounded-xl bg-stone-800 p-3 text-left transition hover:bg-stone-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold">
                        {KIND_LABEL[s.kind].icon} {s.title}
                      </div>
                      <span className="shrink-0 text-xs text-stone-400">{sideName(s.side)}</span>
                    </div>
                    <div className="mt-1 text-xs text-stone-400">{s.summary}</div>
                    <div className="mt-2 flex gap-2 text-[11px]">
                      <span className={p.develop ? 'text-green-400' : 'text-stone-500'}>{p.develop ? '✓' : '○'} desenvolver</span>
                      <span className={p.defend ? 'text-green-400' : 'text-stone-500'}>{p.defend ? '✓' : '○'} defesa</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </main>
  )
}

type Part = 'develop' | 'why' | 'defend' | 'practice'

function LessonView({ study, onBack }: { study: Study; onBack: () => void }) {
  const [part, setPart] = useState<Part>('develop')
  const tabs: [Part, string][] = [
    ['develop', '1. Como desenvolver'],
    ['why', '2. Por quê'],
    ['defend', '3. Como se defender'],
    ['practice', '4. Praticar'],
  ]
  return (
    <main>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className={btn} onClick={onBack}>
          ← Estudos
        </button>
        <div>
          <div className="font-semibold">
            {KIND_LABEL[study.kind].icon} {study.title}
          </div>
          <div className="text-xs text-stone-400">
            Nível {study.level} — {LEVELS[study.level].name} · {KIND_LABEL[study.kind].label} das {sideName(study.side)}
          </div>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-stone-800 p-1 sm:inline-grid sm:grid-cols-4">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setPart(id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold sm:text-sm ${part === id ? 'bg-amber-500 text-stone-900' : 'text-stone-300 hover:bg-stone-700'}`}>
            {label}
          </button>
        ))}
      </div>
      {part === 'develop' && <LineTrainer key={`${study.id}-develop`} study={study} which="develop" />}
      {part === 'defend' && <LineTrainer key={`${study.id}-defend`} study={study} which="defend" />}
      {part === 'why' && <WhyView study={study} />}
      {part === 'practice' && <PracticeView study={study} />}
    </main>
  )
}

function useLook() {
  const settings = useAppState((s) => s.settings)
  return { theme: themeById(settings.boardTheme), pieceSet: settings.pieceSet, showCoords: settings.showCoords, sound: settings.sound }
}

/** Assistir a linha lance a lance, ou jogá-la no modo quiz. */
function LineTrainer({ study, which }: { study: Study; which: 'develop' | 'defend' }) {
  const line = study[which]
  const { fens, moves } = useMemo(() => playLine(line), [line])
  const look = useLook()
  const [mode, setMode] = useState<'watch' | 'quiz'>('watch')
  const [ply, setPly] = useState(0)
  const [wrong, setWrong] = useState<string | null>(null)
  const [mistakes, setMistakes] = useState(0)
  const student = line.student
  const finished = ply >= moves.length
  const studentTurn = !finished && moves[ply].color === student

  // No quiz, os lances do outro lado são jogados automaticamente.
  useEffect(() => {
    if (mode !== 'quiz' || finished || studentTurn) return
    const t = setTimeout(() => {
      if (look.sound) playMoveSound(moves[ply].captured ? 'capture' : 'move')
      setPly((p) => p + 1)
    }, 600)
    return () => clearTimeout(t)
  }, [mode, ply, finished, studentTurn, moves, look.sound])

  // Ao terminar o quiz, registra o progresso da lição.
  useEffect(() => {
    if (mode === 'quiz' && finished) update((s) => ({ ...s, studies: { ...s.studies, [study.id]: { ...s.studies[study.id], [which]: true } } }))
  }, [mode, finished, study.id, which])

  const restart = (m: 'watch' | 'quiz') => {
    setMode(m)
    setPly(0)
    setWrong(null)
    setMistakes(0)
  }

  const onMove = (from: Square, to: Square, promotion?: string) => {
    if (!studentTurn) return
    const uci = uciOf({ from, to, promotion })
    if (uci === moves[ply].uci) {
      if (look.sound) playMoveSound(moves[ply].captured ? 'capture' : 'move')
      setWrong(null)
      setPly(ply + 1)
    } else {
      setWrong(uci)
      setMistakes((n) => n + 1)
      if (look.sound) playMoveSound('check')
    }
  }

  const arrows: Arrow[] = []
  const heat: HeatMap = {}
  if (mode === 'watch' && !finished) arrows.push({ from: moves[ply].from, to: moves[ply].to, color: '#60a5fa', dashed: true })
  if (mode === 'quiz' && wrong) {
    arrows.push({ from: moves[ply].from, to: moves[ply].to, color: '#22c55e' })
    heat[wrong.slice(2, 4) as Square] = { color: 'red', level: 3, reason: '' }
  }
  const last = ply > 0 ? moves[ply - 1] : null
  const explained = last ? line.steps[ply - 1][1] : ''
  const moveNo = (i: number) => {
    const startBlack = new Chess(line.fen).turn() === 'b'
    const n = Math.floor((i + (startBlack ? 1 : 0)) / 2) + 1
    return moves[i].color === 'w' ? `${n}.` : `${n}...`
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="mx-auto w-full max-w-[min(100%,calc(100vh-14rem))] lg:max-w-[calc(100vh-11rem)]">
        <Board
          fen={fens[ply]}
          orientation={student}
          movable={mode === 'quiz' && studentTurn ? student : null}
          onMove={onMove}
          lastMove={last ? [last.from as Square, last.to as Square] : undefined}
          arrows={arrows}
          heat={heat}
          theme={look.theme}
          pieceSet={look.pieceSet}
          showCoords={look.showCoords}
        />
        {mode === 'watch' && (
          <div className="mt-2 flex gap-1.5">
            <button className={btn} disabled={ply === 0} onClick={() => setPly(0)} aria-label="Início">
              ⏮
            </button>
            <button className={btn} disabled={ply === 0} onClick={() => setPly(ply - 1)} aria-label="Anterior">
              ◀
            </button>
            <button className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-stone-900 disabled:opacity-40" disabled={finished} onClick={() => setPly(ply + 1)}>
              Próximo lance ▶
            </button>
            <button className={btn} disabled={finished} onClick={() => setPly(moves.length)} aria-label="Fim">
              ⏭
            </button>
          </div>
        )}
      </section>

      <aside className="flex min-w-0 flex-col gap-3">
        <div className="rounded-xl bg-stone-800 p-3 text-sm text-stone-300">{line.intro}</div>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-800 p-1 text-xs">
          <button onClick={() => restart('watch')} className={`rounded-md py-1.5 font-semibold ${mode === 'watch' ? 'bg-stone-600' : 'hover:bg-stone-700'}`}>
            👀 Assistir
          </button>
          <button onClick={() => restart('quiz')} className={`rounded-md py-1.5 font-semibold ${mode === 'quiz' ? 'bg-stone-600' : 'hover:bg-stone-700'}`}>
            ✋ Jogar você ({sideName(student)})
          </button>
        </div>

        {mode === 'quiz' && (
          <div className={`rounded-xl border-l-4 p-3 text-sm font-semibold ${wrong ? 'border-red-500 bg-red-900/40' : finished ? 'border-green-500 bg-green-900/40' : 'border-amber-500 bg-stone-800'}`}>
            {wrong
              ? `✗ Não é esse. A seta verde mostra o lance da lição (${moves[ply].san}) — jogue-o.`
              : finished
                ? `✓ Linha concluída${mistakes ? ` com ${mistakes} ${mistakes === 1 ? 'erro' : 'erros'}` : ' sem erros'}!`
                : studentTurn
                  ? `Sua vez: qual é o lance das ${sideName(student)}?`
                  : '…'}
          </div>
        )}

        {last && (
          <div className="rounded-xl bg-stone-800 p-3 text-sm">
            <div className="font-semibold">
              {moveNo(ply - 1)} {last.san}
            </div>
            {explained && <div className="mt-1 text-stone-300">{explained}</div>}
          </div>
        )}
        {!last && mode === 'watch' && <div className="rounded-xl bg-stone-800 p-3 text-sm text-stone-400">Toque em "Próximo lance" para começar. A seta azul tracejada mostra o próximo lance.</div>}

        <div className="flex flex-wrap gap-1 rounded-xl bg-stone-800 p-2 font-mono text-xs">
          {moves.map((m, i) => (
            <button
              key={i}
              disabled={mode === 'quiz'}
              onClick={() => setPly(i + 1)}
              className={`rounded px-1 py-0.5 ${i === ply - 1 ? 'bg-stone-600 text-white' : i < ply ? 'text-stone-200' : 'text-stone-500'} ${m.color === student ? 'font-bold' : ''}`}
            >
              {(m.color === 'w' || i === 0) && <span className="text-stone-500">{moveNo(i)} </span>}
              {mode === 'quiz' && i >= ply ? '…' : m.san}
            </button>
          ))}
        </div>
        {finished && mode === 'watch' && (
          <button className="rounded-lg bg-amber-500 py-2 text-sm font-bold text-stone-900" onClick={() => restart('quiz')}>
            Agora jogue você ✋
          </button>
        )}
      </aside>
    </div>
  )
}

function WhyView({ study }: { study: Study }) {
  const look = useLook()
  const { fens } = useMemo(() => playLine(study.develop), [study])
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="mx-auto w-full max-w-[min(100%,calc(100vh-14rem))] lg:max-w-[calc(100vh-11rem)]">
        <Board fen={fens[fens.length - 1]} orientation={study.side} movable={null} onMove={() => {}} theme={look.theme} pieceSet={look.pieceSet} showCoords={look.showCoords} />
        <p className="mt-1 text-xs text-stone-500">Posição ao final da linha "Como desenvolver".</p>
      </section>
      <aside className="flex flex-col gap-2">
        {study.why.map((w, i) => (
          <div key={i} className="rounded-xl border-l-4 border-sky-600 bg-stone-800 p-3 text-sm">
            💡 {w}
          </div>
        ))}
      </aside>
    </div>
  )
}

function PracticeView({ study }: { study: Study }) {
  const rating = useAppState((s) => s.profile.rating)
  const level = suggestedLevel(rating)
  const start = (which: 'develop' | 'defend') => {
    const line = study[which]
    const { fens } = playLine(line)
    const color = which === 'develop' ? study.side : line.student
    newGame({ mode: 'treino', botElo: level.elo, playerColor: color, startFen: fens[fens.length - 1], lesson: study.title })
    update((s) => ({ ...s, settings: { ...s.settings, tab: 'jogar' } }))
  }
  const current = getState().current
  const hasGame = current?.status === 'playing'
  const ratedGame = hasGame && current?.mode === 'desafio' && current.moves.length >= 2
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <p className="text-sm text-stone-300">
        Continue a partida contra a máquina a partir da posição estudada, no modo <b>Treino</b> (com mapa de vulnerabilidades, dicas e comentários). Adversário: <b>{level.name}</b> (≈ {level.elo}), o nível sugerido para o seu rating.
      </p>
      <button className="w-full rounded-xl bg-amber-500 p-4 text-left font-bold text-stone-900 hover:bg-amber-400" onClick={() => start('develop')}>
        ⚔️ Jogar a abertura com as {sideName(study.side)}
        <div className="text-xs font-normal">A partir do fim da linha "Como desenvolver".</div>
      </button>
      <button className="w-full rounded-xl bg-stone-700 p-4 text-left font-bold hover:bg-stone-600" onClick={() => start('defend')}>
        🛡️ Jogar a defesa com as {sideName(study.defend.student)}
        <div className="text-xs font-normal text-stone-300">A partir do fim da linha "Como se defender".</div>
      </button>
      {hasGame && <p className="text-xs text-stone-500">Isso substitui a partida em andamento na aba Jogar{ratedGame ? ' — como ela é do modo Desafio, conta como derrota' : ''}.</p>}
    </div>
  )
}
