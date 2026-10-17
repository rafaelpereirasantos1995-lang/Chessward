import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { startController } from './game/controller'
import { startPuzzleController } from './game/puzzles'
import { startTrainers } from './game/trainers'
import { initSync } from './state/sync'
import './index.css'

registerSW({ immediate: true })
initSync()
startController()
startPuzzleController()
startTrainers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
