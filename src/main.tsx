import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { startController } from './game/controller'
import { initSync } from './state/sync'
import './index.css'

registerSW({ immediate: true })
initSync()
startController()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
