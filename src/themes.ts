export interface BoardTheme {
  id: string
  name: string
  light: string
  dark: string
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'madeira', name: 'Madeira', light: '#f0d9b5', dark: '#b58863' },
  { id: 'verde', name: 'Verde clássico', light: '#eeeed2', dark: '#769656' },
  { id: 'azul', name: 'Azul', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'marmore', name: 'Mármore', light: '#e8e6e1', dark: '#a39e93' },
  { id: 'roxo', name: 'Roxo', light: '#e9e3f5', dark: '#9d85c4' },
  { id: 'coral', name: 'Coral', light: '#f7e7d4', dark: '#d08a6d' },
  { id: 'noite', name: 'Noite', light: '#7b8794', dark: '#3e4c59' },
  { id: 'contraste', name: 'Alto contraste', light: '#ffffff', dark: '#6b6b6b' },
]

export interface PieceSet {
  id: string
  name: string
  credit: string
}

// SVGs do Lichess (public/pieces). Licenças em public/pieces/LICENSES.md.
export const PIECE_SETS: PieceSet[] = [
  { id: 'cburnett', name: 'Clássico', credit: 'Colin M.L. Burnett (GPLv2+)' },
  { id: 'merida', name: 'Merida', credit: 'Armando H. Marroquin (GPLv2+)' },
  { id: 'california', name: 'California', credit: 'Jerry S. (CC BY-NC-SA 4.0)' },
  { id: 'maestro', name: 'Maestro', credit: 'sadsnake1 (CC BY-NC-SA 4.0)' },
  { id: 'staunty', name: 'Staunty', credit: 'sadsnake1 (CC BY-NC-SA 4.0)' },
  { id: 'fantasy', name: 'Fantasia', credit: 'Maurizio Monge (MIT)' },
  { id: 'chessnut', name: 'Chessnut', credit: 'Alexis Luengas (Apache 2.0)' },
  { id: 'pixel', name: 'Pixel', credit: 'therealqtpi (AGPLv3+)' },
]

export const themeById = (id: string) => BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0]
export const pieceUrl = (set: string, color: 'w' | 'b', type: string) => `/pieces/${set}/${color}${type.toUpperCase()}.svg`
