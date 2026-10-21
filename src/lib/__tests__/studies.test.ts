import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { STUDIES } from '../../data/studies'

describe('studies', () => {
  it('ids are unique and every line is legal with the student matching the side to move pattern', () => {
    const ids = new Set(STUDIES.map((s) => s.id))
    expect(ids.size).toBe(STUDIES.length)
    for (const s of STUDIES) {
      for (const key of ['develop', 'defend'] as const) {
        const line = s[key]
        const c = new Chess(line.fen)
        for (const [san] of line.steps) {
          try {
            c.move(san)
          } catch {
            throw new Error(`${s.id}/${key}: lance ilegal ${san} após ${c.history().join(' ')}`)
          }
        }
        // O aluno precisa ter pelo menos um lance na linha.
        const first = new Chess(line.fen).turn()
        const studentMoves = line.steps.filter((_, i) => (i % 2 === 0 ? first : first === 'w' ? 'b' : 'w') === line.student)
        expect(studentMoves.length, `${s.id}/${key}`).toBeGreaterThan(0)
      }
    }
  })
})
