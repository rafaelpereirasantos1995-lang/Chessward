// Monta public/puzzles.json a partir de:
//  - arquivos .jsonl do gerador (scripts/generate-puzzles.mjs), e/ou
//  - a base oficial do Lichess (lichess_db_puzzle.csv, já descompactada com `zstd -d`), CC0:
//    https://database.lichess.org/#puzzles
// Uso: node scripts/build-puzzles.mjs <arquivo1> [arquivo2 ...]
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { Chess } from 'chess.js'

const PER_BUCKET = 120 // desafios do Lichess por faixa de 100 pontos de rating e por tipo (ataque/defesa)
const out = new Map()
const buckets = new Map()

for (const file of process.argv.slice(2)) {
  if (file.endsWith('.jsonl')) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue
      const row = JSON.parse(line)
      out.set(row[1], row) // chave = FEN, evita repetidos
    }
    continue
  }
  // CSV do Lichess: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
  const rl = createInterface({ input: createReadStream(file) })
  let read = 0
  for await (const line of rl) {
    read++
    if (line.startsWith('PuzzleId')) continue
    const [id, fen, moves, rating, deviation, popularity, plays, themes] = line.split(',')
    // Na faixa de iniciante há menos desafios populares: filtros mais leves e mais desafios por faixa.
    const beginner = Number(rating) < 1000
    if (Number(popularity) < (beginner ? 60 : 85) || Number(plays) < (beginner ? 50 : 300) || Number(deviation) > 90) continue
    const defense = /\b(defensiveMove|equality)\b/.test(themes)
    const bucket = `${Math.floor(Number(rating) / 100)}:${defense ? 'd' : 'a'}`
    const n = buckets.get(bucket) ?? 0
    if (n >= (beginner ? PER_BUCKET * 2.5 : PER_BUCKET)) continue
    buckets.set(bucket, n + 1)
    let tags = themes
    if (defense) {
      // Marca as defesas que começam saindo de um xeque (filtro "Saída de xeque").
      const c = new Chess(fen)
      const m = moves.split(' ')[0]
      c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] })
      if (c.inCheck()) tags += ' defendCheck'
    }
    out.set(fen, [id, fen, moves, Number(rating), tags])
  }
  console.log(read, 'linhas lidas de', file)
}

const rows = [...out.values()].sort((a, b) => a[3] - b[3])
writeFileSync('public/puzzles.json', JSON.stringify(rows))
const hist = {}
for (const r of rows) hist[Math.floor(r[3] / 200) * 200] = (hist[Math.floor(r[3] / 200) * 200] ?? 0) + 1
const defense = rows.filter((r) => /\b(defensiveMove|equality)\b/.test(r[4])).length
console.log(rows.length, 'desafios', `(${rows.length - defense} ataque, ${defense} defesa)`, hist)
