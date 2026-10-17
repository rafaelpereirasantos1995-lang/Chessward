import type { Color } from 'chess.js'
import { useState, type ReactNode } from 'react'
import { CLASS_INFO, moveAccuracy, type MoveClass } from '../lib/analysis'
import { BOT_LEVELS, suggestedLevel } from '../lib/bot'
import { update, useAppState } from '../state/store'
import { cloudAvailable, signIn, signOut, signUp, syncNow, useSync } from '../state/sync'
import type { GameSession, Mode, Settings } from '../state/types'
import { BOARD_THEMES, PIECE_SETS, pieceUrl } from '../themes'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-stone-800 p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full px-2 text-2xl leading-none text-stone-400 hover:text-white" aria-label="Fechar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const choice = (active: boolean) => `rounded-lg border p-3 text-left transition ${active ? 'border-amber-400 bg-amber-400/10' : 'border-stone-600 hover:border-stone-400'}`

export function NewGameDialog({ onClose, onStart }: { onClose: () => void; onStart: (o: { mode: Mode; botElo: number; playerColor: Color | 'random' }) => void }) {
  const rating = useAppState((s) => s.profile.rating)
  const current = useAppState((s) => s.current)
  const suggested = suggestedLevel(rating)
  const [mode, setMode] = useState<Mode>('treino')
  const [color, setColor] = useState<Color | 'random'>('w')
  const [elo, setElo] = useState(suggested.elo)
  const abandoning = current?.status === 'playing' && current.mode === 'desafio' && current.moves.length >= 2

  return (
    <Modal title="Nova partida" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <button className={choice(mode === 'treino')} onClick={() => setMode('treino')}>
          <div className="font-semibold">🎓 Treino</div>
          <div className="text-xs text-stone-400">Mapa vermelho/verde, dicas, desfazer e treinador ao vivo. Não vale rating.</div>
        </button>
        <button className={choice(mode === 'desafio')} onClick={() => setMode('desafio')}>
          <div className="font-semibold">🏆 Desafio</div>
          <div className="text-xs text-stone-400">Sem ajuda. Vale rating. Análise completa no final.</div>
        </button>
      </div>

      <h3 className="mb-2 mt-4 text-sm font-semibold text-stone-300">Suas peças</h3>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['w', '♔ Brancas'],
            ['random', '🎲 Sorteio'],
            ['b', '♚ Pretas'],
          ] as const
        ).map(([c, label]) => (
          <button key={c} className={choice(color === c)} onClick={() => setColor(c)}>
            <div className="text-center text-sm font-semibold">{label}</div>
          </button>
        ))}
      </div>

      <h3 className="mb-1 mt-4 text-sm font-semibold text-stone-300">Adversário</h3>
      <p className="mb-2 text-xs text-stone-400">
        Seu rating: <b>{rating}</b> — sugerido: <b>{suggested.name}</b> ({suggested.elo}).
      </p>
      <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1">
        {BOT_LEVELS.map((l) => (
          <button key={l.elo} className={choice(elo === l.elo)} onClick={() => setElo(l.elo)}>
            <div className="flex items-center justify-between text-sm font-semibold">
              {l.name} {l.elo === suggested.elo && <span className="text-[10px] text-amber-400">sugerido</span>}
            </div>
            <div className="text-xs text-stone-400">≈ {l.elo}</div>
          </button>
        ))}
      </div>

      {abandoning && <p className="mt-3 rounded bg-red-950/50 p-2 text-xs text-red-300">Você tem uma partida de Desafio em andamento. Começar outra conta como derrota.</p>}

      <button className="mt-4 w-full rounded-xl bg-amber-500 py-3 font-bold text-stone-900 hover:bg-amber-400" onClick={() => onStart({ mode, botElo: elo, playerColor: color })}>
        Começar
      </button>
    </Modal>
  )
}

function Toggle({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {desc && <span className="block text-xs text-stone-400">{desc}</span>}
      </span>
      <input type="checkbox" className="h-5 w-5 accent-amber-500" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function AppearanceDialog({ onClose }: { onClose: () => void }) {
  const settings = useAppState((s) => s.settings)
  const set = (patch: Partial<Settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  return (
    <Modal title="Aparência e ajudas" onClose={onClose}>
      <h3 className="mb-2 text-sm font-semibold text-stone-300">Tabuleiro</h3>
      <div className="grid grid-cols-4 gap-2">
        {BOARD_THEMES.map((t) => (
          <button key={t.id} onClick={() => set({ boardTheme: t.id })} className={`rounded-lg p-1 ${settings.boardTheme === t.id ? 'ring-2 ring-amber-400' : ''}`}>
            <div className="grid aspect-square grid-cols-2 overflow-hidden rounded">
              {[t.light, t.dark, t.dark, t.light].map((c, i) => (
                <div key={i} style={{ background: c }} />
              ))}
            </div>
            <div className="mt-1 truncate text-[11px] text-stone-300">{t.name}</div>
          </button>
        ))}
      </div>

      <h3 className="mb-2 mt-4 text-sm font-semibold text-stone-300">Peças</h3>
      <div className="grid grid-cols-4 gap-2">
        {PIECE_SETS.map((p) => (
          <button key={p.id} title={p.credit} onClick={() => set({ pieceSet: p.id })} className={`rounded-lg bg-stone-700 p-1 ${settings.pieceSet === p.id ? 'ring-2 ring-amber-400' : ''}`}>
            <div className="flex">
              <img src={pieceUrl(p.id, 'w', 'n')} alt="" className="h-1/2 w-1/2" />
              <img src={pieceUrl(p.id, 'b', 'q')} alt="" className="h-1/2 w-1/2" />
            </div>
            <div className="truncate text-[11px] text-stone-300">{p.name}</div>
          </button>
        ))}
      </div>

      <h3 className="mb-1 mt-4 text-sm font-semibold text-stone-300">Ajudas (modo Treino)</h3>
      <div className="divide-y divide-stone-700">
        <Toggle label="Mapa vermelho/verde" desc="Peças vulneráveis (vermelho) e alvos que você pode ganhar (verde)" value={settings.heatmap} onChange={(v) => set({ heatmap: v })} />
        <Toggle label="Pré-visualização ao segurar a peça" desc="Cada casa de destino mostra se o lance é seguro" value={settings.preview} onChange={(v) => set({ preview: v })} />
        <Toggle label="Treinador ao vivo" value={settings.coach} onChange={(v) => set({ coach: v })} />
        <Toggle label="Coordenadas" value={settings.showCoords} onChange={(v) => set({ showCoords: v })} />
        <Toggle label="Sons" value={settings.sound} onChange={(v) => set({ sound: v })} />
      </div>
    </Modal>
  )
}

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const sync = useSync()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!cloudAvailable)
    return (
      <Modal title="Sincronização" onClose={onClose}>
        <p className="text-sm text-stone-300">Seu progresso está salvo neste aparelho, inclusive a partida em andamento.</p>
        <p className="mt-2 text-sm text-stone-400">
          Para continuar a mesma partida em outro aparelho, a sincronização na nuvem precisa ser configurada uma vez (passo a passo em <code>docs/SINCRONIZACAO.md</code>).
        </p>
      </Modal>
    )

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const statusText: Record<string, string> = { syncing: 'Sincronizando…', synced: 'Sincronizado', offline: 'Sem internet — envia ao reconectar', error: 'Erro na sincronização', 'signed-out': 'Desconectado', off: '' }

  return (
    <Modal title="Conta e sincronização" onClose={onClose}>
      {sync.user ? (
        <div className="space-y-3 text-sm">
          <p>
            Conectado como <b>{sync.user.email}</b>
          </p>
          <p className="text-stone-400">
            {statusText[sync.status]}
            {sync.lastSync && ` · ${new Date(sync.lastSync).toLocaleTimeString('pt-BR')}`}
          </p>
          {sync.error && <p className="text-red-400">{sync.error}</p>}
          <p className="text-stone-400">Partidas em andamento, treinos, rating e aparência ficam iguais em todos os seus aparelhos.</p>
          <div className="flex gap-2">
            <button className="rounded-lg bg-stone-700 px-4 py-2 hover:bg-stone-600" onClick={() => void syncNow()}>
              Sincronizar agora
            </button>
            <button className="rounded-lg bg-stone-700 px-4 py-2 hover:bg-stone-600" onClick={() => void signOut()}>
              Sair
            </button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => signIn(email, password))
          }}
        >
          <p className="text-sm text-stone-400">Entre para continuar suas partidas e treinos em qualquer aparelho.</p>
          <input className="w-full rounded-lg bg-stone-700 px-3 py-2" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="w-full rounded-lg bg-stone-700 px-3 py-2" type="password" placeholder="Senha (mín. 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {msg && <p className="text-sm text-amber-300">{msg}</p>}
          <div className="flex gap-2">
            <button disabled={busy} className="flex-1 rounded-lg bg-amber-500 py-2 font-semibold text-stone-900 disabled:opacity-50">
              Entrar
            </button>
            <button
              type="button"
              disabled={busy}
              className="flex-1 rounded-lg bg-stone-700 py-2 disabled:opacity-50"
              onClick={() =>
                void run(async () => {
                  const r = await signUp(email, password)
                  if (r === 'confirm') setMsg('Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.')
                })
              }
            >
              Criar conta
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export function GameOverDialog({ game, onClose, onNew, onReview }: { game: GameSession; onClose: () => void; onNew: () => void; onReview: () => void }) {
  const player = game.playerColor
  const won = game.result === '1/2-1/2' ? null : (game.result === '1-0') === (player === 'w')
  const reviewed = Object.keys(game.reviews).length
  const analysing = reviewed < game.moves.length
  const stats = (color: 'w' | 'b') => {
    const plies = Object.entries(game.reviews).filter(([k]) => (Number(k) % 2 === 1) === (color === 'w'))
    const acc = plies.length ? plies.reduce((a, [, r]) => a + moveAccuracy(r.drop), 0) / plies.length : 0
    const counts: Partial<Record<MoveClass, number>> = {}
    for (const [, r] of plies) counts[r.cls] = (counts[r.cls] ?? 0) + 1
    return { acc, counts }
  }
  // Partidas sempre começam da posição inicial, então lances ímpares são das brancas.
  const me = stats(player)
  const bot = stats(player === 'w' ? 'b' : 'w')
  const delta = game.ratingAfter !== undefined && game.ratingBefore !== undefined ? game.ratingAfter - game.ratingBefore : null

  return (
    <Modal title={won === null ? 'Empate' : won ? 'Vitória! 🎉' : 'Derrota'} onClose={onClose}>
      <p className="text-sm text-stone-400">{game.endReason}</p>
      {delta !== null && (
        <p className="mt-2 text-lg">
          Rating: <b>{game.ratingAfter}</b>{' '}
          <span className={delta >= 0 ? 'text-green-400' : 'text-red-400'}>
            ({delta >= 0 ? '+' : ''}
            {delta})
          </span>
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          ['Você', me],
          ['Máquina', bot],
        ].map(([label, s]) => {
          const st = s as ReturnType<typeof stats>
          return (
            <div key={label as string} className="rounded-xl bg-stone-900/60 p-3">
              <div className="text-sm text-stone-400">{label as string}</div>
              <div className="text-2xl font-bold">{analysing && !st.acc ? '…' : `${st.acc.toFixed(1)}%`}</div>
              <div className="text-xs text-stone-500">precisão</div>
              <div className="mt-2 space-y-0.5 text-xs">
                {(Object.keys(CLASS_INFO) as MoveClass[])
                  .filter((c) => st.counts[c])
                  .map((c) => (
                    <div key={c} className="flex justify-between">
                      <span style={{ color: CLASS_INFO[c].color }}>
                        {CLASS_INFO[c].symbol} {CLASS_INFO[c].label}
                      </span>
                      <span>{st.counts[c]}</span>
                    </div>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
      {analysing && <p className="mt-2 text-xs text-stone-500">Analisando lances… ({reviewed}/{game.moves.length})</p>}
      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded-xl bg-stone-700 py-3 font-semibold hover:bg-stone-600" onClick={onReview}>
          Revisar partida
        </button>
        <button className="flex-1 rounded-xl bg-amber-500 py-3 font-bold text-stone-900 hover:bg-amber-400" onClick={onNew}>
          Nova partida
        </button>
      </div>
    </Modal>
  )
}
