import { describe, expect, it } from 'vitest'
import { checkPuzzleMove, fromRow, pickPuzzle, puzzlePosition, type PuzzleRow } from '../puzzle'

// Lance do adversário (Qe2?) e depois a solução: o jogador ganha a dama com a torre.
const row: PuzzleRow = ['t1', '3k4/p2bn2r/2p1p2p/4Npp1/1r1P4/6P1/P3RP1P/R4BK1 w - - 4 24', 'e2b2 b4b2', 480, 'hangingPiece oneMove']
// Mate em 2 com resposta forçada.
const mate: PuzzleRow = ['t2', '6k1/5ppp/8/8/8/8/5PPP/R2R2K1 b - - 0 1', 'g8f8 d1d8 f8e7 a1a7', 900, 'mate mateIn2']

describe('puzzles', () => {
  it('parses rows', () => {
    const p = fromRow(row)
    expect(p.moves).toEqual(['e2b2', 'b4b2'])
    expect(p.themes).toContain('oneMove')
  })
  it('position after the opponent move has the solver to move', () => {
    const p = fromRow(row)
    expect(puzzlePosition(p, 1).turn()).toBe('b')
  })
  it('accepts the right move and rejects others', () => {
    const p = fromRow(row)
    expect(checkPuzzleMove(p, 1, 'b4b2')).toBe('solved')
    expect(checkPuzzleMove(p, 1, 'b4b3')).toBe('wrong')
    expect(checkPuzzleMove(p, 1, 'zzzz')).toBe('wrong')
  })
  it('multi-step: correct then continues', () => {
    const p = fromRow(mate)
    expect(checkPuzzleMove(p, 1, 'd1d8')).toBe('correct')
    expect(checkPuzzleMove(p, 3, 'a1a2')).toBe('wrong')
    expect(checkPuzzleMove(p, 3, 'a1a7')).toBe('solved')
  })
  it('accepts an alternative checkmate on the last move', () => {
    const p = fromRow(['t3', '6k1/5ppp/8/8/8/8/5PPP/R2R2K1 b - - 0 1', 'g8h8 a1a8', 600, 'mateIn1'])
    expect(checkPuzzleMove(p, 1, 'd1d8')).toBe('solved')
  })
  it('picks near the rating and avoids seen ones', () => {
    const list = [fromRow(row), fromRow(mate), fromRow(['t4', row[1], row[2], 2000, ''])]
    expect(pickPuzzle(list, 450, new Set(), 'random', () => 0)?.id).toBe('t1')
    expect(pickPuzzle(list, 450, new Set(['t1']), 'random', () => 0)?.id).toBe('t2')
    expect(pickPuzzle(list, 450, new Set(), 'mateLong', () => 0)?.id).toBe('t2')
  })
})
