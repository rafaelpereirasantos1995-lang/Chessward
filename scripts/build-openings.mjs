// Gera src/data/openings.json a partir dos TSV de https://github.com/lichess-org/chess-openings (CC0).
// Uso: node scripts/build-openings.mjs <pasta-com-a.tsv..e.tsv>
import { readFileSync, writeFileSync } from 'node:fs'
import { Chess } from 'chess.js'

const dir = process.argv[2]
const out = {}
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const lines = readFileSync(`${dir}/${f}.tsv`, 'utf8').trim().split('\n').slice(1)
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t')
    const chess = new Chess()
    chess.loadPgn(pgn)
    const key = chess.fen().split(' ').slice(0, 3).join(' ')
    // Em caso de transposição, mantém o nome da linha mais curta (mais conhecido).
    if (!out[key] || out[key][2] > chess.history().length) out[key] = [eco, name, chess.history().length]
  }
}
const compact = Object.fromEntries(Object.entries(out).map(([k, [eco, name]]) => [k, [eco, name]]))
writeFileSync('src/data/openings.json', JSON.stringify(compact))
console.log(Object.keys(compact).length, 'posições')
