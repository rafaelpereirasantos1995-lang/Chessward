// Monta public/puzzles.json a partir de:
//  - arquivos .jsonl do gerador (scripts/generate-puzzles.mjs), e/ou
//  - a base oficial do Lichess (lichess_db_puzzle.csv, já descompactada com `zstd -d`), CC0:
//    https://database.lichess.org/#puzzles
// Uso: node scripts/build-puzzles.mjs <arquivo1> [arquivo2 ...]
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

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
  for await (const line of rl) {
    if (line.startsWith('PuzzleId')) continue
    const [id, fen, moves, rating, deviation, popularity, plays, themes] = line.split(',')
    if (Number(popularity) < 85 || Number(plays) < 300 || Number(deviation) > 90) continue
    const defense = /\b(defensiveMove|equality)\b/.test(themes)
    const bucket = `${Math.floor(Number(rating) / 100)}:${defense ? 'd' : 'a'}`
    const n = buckets.get(bucket) ?? 0
    if (n >= PER_BUCKET) continue
    buckets.set(bucket, n + 1)
    out.set(fen, [id, fen, moves, Number(rating), themes])
  }
}

const rows = [...out.values()].sort((a, b) => a[3] - b[3])
writeFileSync('public/puzzles.json', JSON.stringify(rows))
const hist = {}
for (const r of rows) hist[Math.floor(r[3] / 200) * 200] = (hist[Math.floor(r[3] / 200) * 200] ?? 0) + 1
const defense = rows.filter((r) => /\b(defensiveMove|equality)\b/.test(r[4])).length
console.log(rows.length, 'desafios', `(${rows.length - defense} ataque, ${defense} defesa)`, hist)
