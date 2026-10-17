// Gera os dados da aba Treinos:
//  - src/data/master-games.json: partidas fortes do Lichess (CC0) para "Adivinhe o lance";
//  - src/data/opening-lines.json: linhas de abertura (lichess-org/chess-openings, CC0) por família.
// Uso: node scripts/build-trainers.mjs <strong.json> <pasta-com-a.tsv..e.tsv>
import { readFileSync, writeFileSync } from 'node:fs'
import { Chess } from 'chess.js'

const [gamesFile, ecoDir] = process.argv.slice(2)

const games = JSON.parse(readFileSync(gamesFile, 'utf8'))
  .map((g) => {
    const c = new Chess()
    try {
      for (const san of g.san) c.move(san)
    } catch {
      return null
    }
    const uci = c.history({ verbose: true }).map((m) => m.lan)
    return [g.White, g.Black, Number(g.WhiteElo), Number(g.BlackElo), g.Date, g.Result, uci.join(' '), g.Site]
  })
  .filter(Boolean)
writeFileSync('src/data/master-games.json', JSON.stringify(games))
console.log(games.length, 'partidas')

// Famílias treináveis: [nome em inglês no TSV, cor sugerida].
const FAMILIES = [
  ['Italian Game', 'w'],
  ['Ruy Lopez', 'w'],
  ['Scotch Game', 'w'],
  ["Queen's Gambit Declined", 'w'],
  ['London System', 'w'],
  ['English Opening', 'w'],
  ['Sicilian Defense', 'b'],
  ['French Defense', 'b'],
  ['Caro-Kann Defense', 'b'],
  ['Scandinavian Defense', 'b'],
  ["King's Indian Defense", 'b'],
  ['Slav Defense', 'b'],
]
const rows = []
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  for (const line of readFileSync(`${ecoDir}/${f}.tsv`, 'utf8').trim().split('\n').slice(1)) {
    const [, name, pgn] = line.split('\t')
    rows.push({ name, pgn })
  }
}
const out = []
for (const [family, color] of FAMILIES) {
  const lines = rows
    .filter((r) => r.name === family || r.name.startsWith(family + ':'))
    .map((r) => {
      const c = new Chess()
      c.loadPgn(r.pgn)
      return { name: r.name, uci: c.history({ verbose: true }).map((m) => m.lan) }
    })
    .filter((l) => l.uci.length >= 6 && l.uci.length <= 14)
    // Prefere variantes principais (nomes curtos) e evita duplicatas de prefixo.
    .sort((a, b) => a.name.split(',').length - b.name.split(',').length || a.uci.length - b.uci.length)
  const picked = []
  for (const l of lines) {
    if (picked.some((p) => p.uci.join() === l.uci.join())) continue
    picked.push(l)
    if (picked.length >= 12) break
  }
  out.push({ family, color, lines: picked.map((l) => [l.name, l.uci.join(' ')]) })
  console.log(family, picked.length, 'linhas')
}
writeFileSync('src/data/opening-lines.json', JSON.stringify(out))
