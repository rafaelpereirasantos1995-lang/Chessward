// Copia o Stockfish (build "lite single-thread", não exige cabeçalhos COOP/COEP) para public/.
import { copyFileSync, mkdirSync } from 'node:fs'

const src = 'node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232'
mkdirSync('public/stockfish', { recursive: true })
copyFileSync(`${src}.js`, 'public/stockfish/stockfish.js')
copyFileSync(`${src}.wasm`, 'public/stockfish/stockfish.wasm')
