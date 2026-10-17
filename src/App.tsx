import { useState } from 'react'
import { AccountDialog, AppearanceDialog } from './components/Dialogs'
import { btn, GameScreen } from './components/GameScreen'
import { EvolutionScreen } from './components/EvolutionScreen'
import { PuzzleScreen } from './components/PuzzleScreen'
import type { Settings } from './state/types'
import { update, useAppState } from './state/store'
import { cloudAvailable, useSync } from './state/sync'

type Dialog = 'look' | 'account' | null

export default function App() {
  const tab = useAppState((s) => s.settings.tab)
  const profile = useAppState((s) => s.profile)
  const puzzleRating = useAppState((s) => s.puzzles.rating)
  const sync = useSync()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [newRequest, setNewRequest] = useState(0)

  const setTab = (t: Settings['tab']) => update((s) => ({ ...s, settings: { ...s.settings, tab: t } }))
  const syncDot = !cloudAvailable ? null : sync.user ? (sync.status === 'error' ? 'bg-red-500' : sync.status === 'syncing' ? 'bg-amber-400' : sync.status === 'offline' ? 'bg-stone-400' : 'bg-green-500') : 'bg-stone-500'
  const tabBtn = (active: boolean) => `flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-4 sm:text-sm ${active ? 'bg-amber-500 text-stone-900' : 'text-stone-300 hover:bg-stone-700'}`
  const TABS: [Settings['tab'], string][] = [
    ['jogar', '♟ Jogar'],
    ['testes', '🧩 Testes'],
    ['evolucao', '📈 Evolução'],
  ]

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-3 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Chessward</h1>
            <p className="text-[11px] leading-tight text-stone-400">Centro de treinamento</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="mr-1 rounded-lg bg-stone-800 px-3 py-1.5 text-center" title={tab === 'jogar' ? `${profile.wins}V ${profile.draws}E ${profile.losses}D` : 'Rating dos testes'}>
            <div className="text-[10px] uppercase tracking-wide text-stone-400">{tab === 'testes' ? 'Testes' : 'Rating'}</div>
            <div className="text-base font-bold leading-tight text-amber-400">{tab === 'testes' ? puzzleRating : profile.rating}</div>
          </div>
          {tab === 'jogar' && (
            <button className={btn} onClick={() => setNewRequest((n) => n + 1)} title="Nova partida">
              ＋<span className="ml-1 hidden sm:inline">Nova partida</span>
            </button>
          )}
          <button className={btn} onClick={() => setDialog('look')} title="Aparência">
            🎨
          </button>
          <button className={`${btn} relative`} onClick={() => setDialog('account')} title="Conta e sincronização">
            ☁️
            {syncDot && <span className={`absolute right-1 top-1 h-2 w-2 rounded-full ${syncDot}`} />}
          </button>
        </div>
      </header>

      <nav className="mb-3 flex gap-1 rounded-xl bg-stone-800 p-1 sm:self-start">
        {TABS.map(([id, label]) => (
          <button key={id} className={tabBtn(tab === id)} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'jogar' && <GameScreen newRequest={newRequest} />}
      {tab === 'testes' && <PuzzleScreen />}
      {tab === 'evolucao' && <EvolutionScreen />}

      {dialog === 'look' && <AppearanceDialog onClose={() => setDialog(null)} />}
      {dialog === 'account' && <AccountDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
