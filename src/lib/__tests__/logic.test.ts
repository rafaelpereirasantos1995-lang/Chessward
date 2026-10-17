import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { see, positionHeat, previewMoves, judgeMove } from '../tactics'
import { classify, winPct, moveAccuracy } from '../analysis'
import { newRating, START_RATING } from '../rating'
import { parseInfo } from '../engine'
import { pawnStructure, positionMessages } from '../coach'
import { loadOpenings, lookupOpening } from '../openings'
import { suggestedLevel } from '../bot'

describe('tactics', () => {
  it('SEE: undefended piece is won', () => {
    // Brancas jogam: Bxe5? não; cavalo preto em e5 indefeso atacado pelo cavalo de f3.
    const c = new Chess('4k3/8/8/4n3/8/5N2/8/4K3 w - - 0 1')
    expect(see(c, 'e5')).toBe(3)
  })
  it('SEE: defended pawn attacked by queen is not won', () => {
    const c = new Chess('4k3/8/3p4/4p3/8/8/4Q3/4K3 w - - 0 1')
    expect(see(c, 'e5')).toBe(0)
  })
  it('heat marks own hanging piece red and enemy hanging piece green', () => {
    const heat = positionHeat('4k3/8/8/4n3/8/5N2/8/4K3 w - - 0 1', 'w')
    expect(heat.e5?.color).toBe('green')
    expect(heat.f3?.color).toBe('red') // o cavalo de e5 também ataca f3
  })
  it('preview: moving queen into a defended square is red, capturing free piece is green', () => {
    const fen = 'r3k3/8/8/8/8/8/8/Q3K3 w - - 0 1'
    const heat = previewMoves(fen, 'a1')
    expect(heat.a8?.color).toBe('green') // captura a torre indefesa
    const fen2 = '4k3/3p4/8/8/8/8/8/3QK3 w - - 0 1'
    const heat2 = previewMoves(fen2, 'd1')
    expect(heat2.e6).toBeUndefined()
    expect(previewMoves('4k3/8/2p5/8/8/8/8/3QK3 w - - 0 1', 'd1').d5?.color).toBe('red')
  })
  it('judge detects mate', () => {
    const c = new Chess('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1')
    expect(judgeMove(c, { from: 'a1', to: 'a8' })?.mate).toBe(true)
  })
})

describe('analysis', () => {
  it('win% is symmetric and bounded', () => {
    expect(winPct({ cp: 0 })).toBeCloseTo(50)
    expect(winPct({ mate: 3 })).toBe(100)
    expect(winPct({ cp: 300 }) + winPct({ cp: -300 })).toBeCloseTo(100)
  })
  it('classifies blunder and best', () => {
    const before = { best: { cp: 50 }, bestUci: 'e2e4', depth: 12 }
    expect(classify({ before, after: { best: { cp: -600 }, depth: 12 }, mover: 'w', playedUci: 'f2f3', sacrifice: false, inBook: false }).cls).toBe('blunder')
    expect(classify({ before, after: { best: { cp: 45 }, depth: 12 }, mover: 'w', playedUci: 'e2e4', sacrifice: false, inBook: false }).cls).toBe('best')
    expect(classify({ before: { best: { cp: -50 }, bestUci: 'e7e5', depth: 12 }, after: { best: { cp: -40 }, depth: 12 }, mover: 'b', playedUci: 'e7e5', sacrifice: true, inBook: false }).cls).toBe('brilliant')
  })
  it('accuracy is 100 with no drop', () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 0)
  })
})

describe('rating', () => {
  it('beating a stronger bot gains more than a weaker one', () => {
    expect(newRating(START_RATING, 700, 1, 0)).toBeGreaterThan(newRating(START_RATING, 250, 1, 0))
    expect(newRating(120, 1000, 0, 0)).toBeGreaterThanOrEqual(100)
  })
  it('suggests the lowest level for a new player', () => {
    expect(suggestedLevel(START_RATING).elo).toBe(400)
  })
})

describe('engine parsing', () => {
  it('converts scores to white POV', () => {
    const l = parseInfo('info depth 10 seldepth 12 multipv 2 score cp 35 nodes 1 pv e7e5 g1f3', false)
    expect(l).toMatchObject({ multipv: 2, depth: 10, score: { cp: -35 }, pv: ['e7e5', 'g1f3'] })
  })
})

describe('coach', () => {
  it('finds passed and isolated pawns', () => {
    const c = new Chess('4k3/8/8/8/8/8/P3P3/4K3 w - - 0 1')
    const ps = pawnStructure(c, 'w')
    expect(ps.passed.sort()).toEqual(['a2', 'e2'])
    expect(ps.isolated.sort()).toEqual(['a2', 'e2'])
  })
  it('warns about an undeveloped position', () => {
    const c = new Chess()
    for (const m of ['a4', 'a5', 'h4', 'h5', 'Ra3', 'Ra6', 'Rhh3', 'Rhh6', 'b3', 'b6', 'g3', 'g6']) c.move(m)
    const msgs = positionMessages(c, 'w', c.history().length, { tactics: false })
    expect(msgs.some((m) => m.key === 'dev')).toBe(true)
  })
  it('recognizes and translates openings', async () => {
    await loadOpenings()
    const c = new Chess()
    for (const m of ['e4', 'c5']) c.move(m)
    expect(lookupOpening(c.fen())?.name).toBe('Defesa Siciliana')
    const g = new Chess()
    for (const m of ['d4', 'd5', 'c4', 'e6']) g.move(m)
    expect(lookupOpening(g.fen())?.name).toContain('Gambito da Dama Recusado')
  })
})

describe('opening names', () => {
  it('puts the variation type first in Portuguese', async () => {
    await loadOpenings()
    const c = new Chess()
    for (const m of ['e4', 'Nc6', 'Nf3']) c.move(m)
    expect(lookupOpening(c.fen())?.name).toBe('Defesa Nimzowitsch — Variante Recusado')
  })
  it('explains which piece is left hanging', () => {
    // Cavalo de f3 atacado pelo peão de e4: mexer a dama deixa o cavalo cair.
    const heat = previewMoves('r1bqkbnr/ppp1pppp/2n5/8/2B1p3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4', 'd1')
    expect(heat.e2?.reason).toContain('Cavalo em f3')
  })
})

import { reviewCard, isDue, MASTERED_BOX } from '../srs'
import { harvestGame } from '../stats'

describe('srs', () => {
  it('moves cards through boxes and resets on error', () => {
    const now = 1_000_000
    let c = { box: 0, due: now }
    expect(isDue(c, now)).toBe(true)
    c = reviewCard(c, true, now)
    expect(c.box).toBe(1)
    expect(isDue(c, now)).toBe(false)
    expect(isDue(c, now + 2 * 86400000)).toBe(true)
    c = reviewCard(reviewCard(reviewCard(reviewCard(c, true, now), true, now), true, now), true, now)
    expect(c.box).toBe(MASTERED_BOX)
    expect(isDue(c, now + 1e12)).toBe(false)
    expect(reviewCard(c, false, now).box).toBe(0)
  })
})

describe('harvest', () => {
  it('collects player classes, accuracy and mistakes', () => {
    const start = new Chess().fen()
    const g = {
      id: 'g1',
      startFen: start,
      moves: ['e2e4', 'e7e5', 'f1c4', 'd8h4'],
      playerColor: 'w' as const,
      evals: { 0: { best: { cp: 30 }, bestUci: 'e2e4', depth: 12 }, 2: { best: { cp: 40 }, bestUci: 'g1f3', depth: 12 } },
      reviews: { 1: { cls: 'best' as const, drop: 0 }, 2: { cls: 'good' as const, drop: 3 }, 3: { cls: 'mistake' as const, drop: 12 }, 4: { cls: 'blunder' as const, drop: 30 } },
    }
    const h = harvestGame(g, (fen) => (fen.startsWith('rnbqkbnr/pppppppp/8/8/4P3') ? 'Jogo do Peão do Rei' : null), 5)
    expect(h.classes).toEqual({ best: 1, mistake: 1 })
    expect(h.family).toBe('Jogo do Peão do Rei')
    expect(h.mistakes).toHaveLength(1)
    expect(h.mistakes[0]).toMatchObject({ playedUci: 'f1c4', bestUci: 'g1f3', fen: expect.stringContaining(' w ') })
    expect(h.accuracy).toBeGreaterThan(50)
  })
})

describe('opening family names', () => {
  it('translates common beginner openings and reorders unknown ones', async () => {
    await loadOpenings()
    const c = new Chess()
    for (const m of ['e4', 'e5', 'Nf3']) c.move(m)
    expect(lookupOpening(c.fen())?.family).toBe('Abertura do Cavalo do Rei')
    const g = new Chess()
    g.move('g4')
    expect(lookupOpening(g.fen())?.family).toBe('Abertura Grob')
  })
})

import { isRealThreat } from '../analysis'
describe('threats', () => {
  it('flags a threat only when passing would cost real winning chances', () => {
    expect(isRealThreat({ cp: 0 }, { cp: 300 }, 'w')).toBe(true) // brancas ameaçam
    expect(isRealThreat({ cp: 0 }, { cp: 40 }, 'w')).toBe(false)
    expect(isRealThreat({ cp: 50 }, { mate: -2 }, 'b')).toBe(true) // pretas ameaçam mate
  })
})
