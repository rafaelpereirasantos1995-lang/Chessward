// Posição inicial do Xadrez 960 (Fischer Random): bispos em cores opostas, rei entre as torres.
// O chess.js não implementa o roque do 960, então as partidas são jogadas sem roque.

export function chess960Fen(rnd = Math.random): string {
  const row: (string | null)[] = Array(8).fill(null)
  const free = () => row.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0)
  const place = (piece: string, options: number[]) => {
    const i = options[Math.floor(rnd() * options.length)]
    row[i] = piece
  }
  place('b', [0, 2, 4, 6])
  place('b', [1, 3, 5, 7])
  place('q', free())
  place('n', free())
  place('n', free())
  const [a, k, c] = free()
  row[a] = 'r'
  row[k] = 'k'
  row[c] = 'r'
  const black = row.join('')
  return `${black}/pppppppp/8/8/8/8/PPPPPPPP/${black.toUpperCase()} w - - 0 1`
}
