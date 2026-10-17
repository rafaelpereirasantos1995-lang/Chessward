// Gera desafios táticos com o Stockfish, no mesmo formato da base do Lichess.
// O motor joga partidas contra si mesmo com erros propositais; quando um lance perde a partida
// e a punição é única, a posição vira um desafio (lance do adversário + solução).
//
// Com o modo "defesa", gera o contrário: o adversário cria uma ameaça e só um lance salva a posição.
//
// Uso: node scripts/generate-puzzles.mjs <saida.jsonl> <quantidade> [semente] [ataque|defesa]
import { spawn } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { Chess } from 'chess.js'

const [out, target = '200', seedArg = '1', mode = 'ataque'] = process.argv.slice(2)
let seed = Number(seedArg) * 9973
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

class Stockfish {
  constructor() {
    this.p = spawn('node', ['node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js'])
    this.buf = ''
    this.waiters = []
    this.p.stdout.on('data', (d) => {
      this.buf += d
      const lines = this.buf.split('\n')
      this.buf = lines.pop()
      for (const l of lines) for (const w of [...this.waiters]) w(l)
    })
    this.p.stdin.write('uci\nsetoption name Hash value 32\n')
  }
  until(prefix, onLine) {
    return new Promise((resolve) => {
      const w = (l) => {
        onLine?.(l)
        if (l.startsWith(prefix)) {
          this.waiters.splice(this.waiters.indexOf(w), 1)
          resolve(l)
        }
      }
      this.waiters.push(w)
    })
  }
  /** Linhas ordenadas; score do ponto de vista de quem joga. */
  async analyze(fen, depth, multipv) {
    if (this.mpv !== multipv) {
      this.p.stdin.write(`setoption name MultiPV value ${multipv}\n`)
      this.mpv = multipv
    }
    const lines = new Map()
    const done = this.until('bestmove', (l) => {
      if (!l.startsWith('info') || !l.includes(' pv ')) return
      const t = l.split(' ')
      const i = t.indexOf('score')
      const k = t.indexOf('multipv')
      const score = t[i + 1] === 'mate' ? { mate: Number(t[i + 2]) } : { cp: Number(t[i + 2]) }
      lines.set(k >= 0 ? Number(t[k + 1]) : 1, { score, pv: t.slice(t.indexOf('pv') + 1) })
    })
    this.p.stdin.write(`position fen ${fen}\ngo depth ${depth}\n`)
    await done
    return [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
  }
}

const val = (s) => (s.mate !== undefined ? (s.mate > 0 ? 100000 - s.mate : -100000 - s.mate) : s.cp)
const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const material = (c, color) => c.board().flat().reduce((a, p) => a + (p && p.color === color ? VALUES[p.type] : 0), 0)
const balance = (c, color) => material(c, color) - material(c, color === 'w' ? 'b' : 'w')
const uciMove = (u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })

/** Constrói a solução a partir da posição depois do erro. */
async function buildSolution(sf, fenAfterBlunder) {
  const c = new Chess(fenAfterBlunder)
  const solver = c.turn()
  const start = balance(c, solver)
  const moves = []
  let mate = false
  for (let solverMoves = 0; solverMoves < 4; solverMoves++) {
    const lines = await sf.analyze(c.fen(), 14, 2)
    if (!lines.length) return null
    const [best, second] = lines
    const vb = val(best.score)
    const vs = second ? val(second.score) : -Infinity
    if (best.score.mate === 1) {
      moves.push(best.pv[0])
      mate = true
      break
    }
    let unique
    if (best.score.mate > 0) unique = !(second && second.score.mate > 0)
    else unique = vb >= 200 && (vs < 100 || vb - vs >= 350)
    if (!unique) {
      if (solverMoves === 0) return null
      // Termina na resposta anterior do jogador: tira o último lance do adversário.
      moves.pop()
      c.undo()
      break
    }
    const played = c.move(uciMove(best.pv[0]))
    moves.push(played.lan)
    if (c.isCheckmate()) {
      mate = true
      break
    }
    // Resposta do adversário (melhor defesa).
    const reply = await sf.analyze(c.fen(), 12, 1)
    if (!reply.length || c.isGameOver()) break
    const replyMove = new Chess(c.fen()).move(uciMove(reply[0].pv[0]))
    const gained = balance(c, solver) - start
    // Vantagem realizada e o adversário não recaptura: fim do desafio.
    if (!best.score.mate && gained >= 2 && !replyMove.captured) break
    c.move(uciMove(reply[0].pv[0]))
    moves.push(replyMove.lan)
  }
  // Precisa terminar num lance do jogador.
  if (moves.length % 2 === 0) {
    moves.pop()
    c.undo()
  }
  if (!moves.length) return null
  const gain = balance(c, solver) - start
  if (!mate && gain < 2) return null
  return { moves, mate, gain }
}

function themesAndRating(fenBefore, blunder, sol) {
  const c = new Chess(fenBefore)
  c.move(uciMove(blunder))
  const solverMoves = Math.ceil(sol.moves.length / 2)
  const themes = []
  let quietFirst = false
  let fork = false
  let promotion = false
  let hanging = false
  sol.moves.forEach((u, i) => {
    const m = c.move(uciMove(u))
    if (i % 2 === 0) {
      if (i === 0) {
        quietFirst = !m.captured && !c.inCheck()
        if (m.captured && solverMoves === 1) hanging = true
      }
      if (m.promotion) promotion = true
      // Garfo: a peça movida passa a atacar duas peças valiosas (ou rei + peça).
      const probe = new Chess(c.fen().replace(/ [wb] /, ` ${m.color} `).replace(/ [a-h][36] /, ' - '))
      const attacked = probe.moves({ square: m.to, verbose: true }).filter((x) => x.captured && (VALUES[x.captured] >= 3 || x.captured === 'k'))
      if (attacked.length + (c.inCheck() ? 1 : 0) >= 2 && m.piece !== 'k') fork = true
    }
  })
  if (sol.mate) themes.push('mate', `mateIn${solverMoves}`)
  if (fork && !sol.mate) themes.push('fork')
  if (hanging && !sol.mate) themes.push('hangingPiece')
  if (promotion) themes.push('promotion')
  if (quietFirst) themes.push('quietMove')
  themes.push(solverMoves === 1 ? 'oneMove' : solverMoves === 2 ? 'short' : 'long')
  const pieces = c.board().flat().filter((p) => p && p.type !== 'p' && p.type !== 'k').length
  if (pieces <= 4) themes.push('endgame')

  let rating = sol.mate ? (solverMoves === 1 ? 650 : 850) : hanging ? 450 : 800
  rating += (solverMoves - 1) * 380 + (quietFirst ? 300 : 0) + (fork ? 100 : 0)
  rating += Math.round((rnd() - 0.5) * 240)
  return { themes, rating: Math.max(400, Math.min(2400, rating)) }
}

/** Mesma posição com a vez passada (para medir a ameaça: "e se eu não fizer nada?"). */
const passTurn = (fen) => {
  const p = fen.split(' ')
  p[1] = p[1] === 'w' ? 'b' : 'w'
  p[3] = '-'
  return p.join(' ')
}

/** Desafio de defesa: só um lance evita perder; depois segue enquanto a defesa continuar única. */
async function buildDefense(sf, fenAfterMove, lastMove) {
  const c = new Chess(fenAfterMove)
  if (c.moves().length < 3) return null
  const moves = []
  let mateThreat = false
  for (let k = 0; k < 3; k++) {
    const lines = await sf.analyze(c.fen(), 14, 3)
    if (lines.length < 2) break
    const vb = val(lines[0].score)
    const vs = val(lines[1].score)
    const unique = vb >= -150 && vs <= -200 && vb - vs >= 250 && c.moves().length >= 3
    if (!unique) {
      if (k === 0) return null
      moves.pop()
      c.undo()
      break
    }
    const best = new Chess(c.fen()).move(uciMove(lines[0].pv[0]))
    if (k === 0) {
      // Recaptura óbvia não é um bom desafio de defesa (guarda poucas).
      if (lastMove.captured && best.to === lastMove.to && rnd() > 0.15) return null
      if (!c.inCheck()) {
        // Precisa existir ameaça real: se eu passasse a vez, o adversário ficaria ganhando.
        const threat = await sf.analyze(passTurn(c.fen()), 10, 1)
        if (!threat.length || val(threat[0].score) < 250) return null
        mateThreat = threat[0].score.mate > 0
      }
    }
    c.move(uciMove(lines[0].pv[0]))
    moves.push(best.lan)
    if (c.isGameOver()) break
    const reply = await sf.analyze(c.fen(), 12, 1)
    if (!reply.length) break
    moves.push(c.move(uciMove(reply[0].pv[0])).lan)
  }
  if (moves.length % 2 === 0) moves.pop()
  return moves.length ? { moves, mateThreat } : null
}

function defenseThemesAndRating(fenBefore, blunder, sol) {
  const c = new Chess(fenBefore)
  c.move(uciMove(blunder))
  const inCheck = c.inCheck()
  const first = new Chess(c.fen()).move(uciMove(sol.moves[0]))
  const solverMoves = Math.ceil(sol.moves.length / 2)
  const quiet = !first.captured && first.piece !== 'k'
  const themes = ['defensiveMove']
  if (sol.mateThreat) themes.push('defendMate')
  else if (inCheck) themes.push('defendCheck')
  else themes.push('savePiece')
  if (quiet) themes.push('quietMove')
  themes.push(solverMoves === 1 ? 'oneMove' : solverMoves === 2 ? 'short' : 'long')
  for (const u of sol.moves) c.move(uciMove(u))
  if (c.board().flat().filter((p) => p && p.type !== 'p' && p.type !== 'k').length <= 4) themes.push('endgame')
  let rating = 650 + (sol.mateThreat ? 200 : 0) + (quiet ? 250 : 0) + (solverMoves - 1) * 350
  rating += Math.round((rnd() - 0.5) * 240)
  return { themes, rating: Math.max(400, Math.min(2400, rating)) }
}

async function main() {
  const sf = new Stockfish()
  const seen = new Set()
  let made = 0
  while (made < Number(target)) {
    const c = new Chess()
    const blunderRate = 0.02 + rnd() * 0.08
    const temperature = 40 + rnd() * 80
    const openingPlies = 2 + Math.floor(rnd() * 8)
    while (!c.isGameOver() && c.history().length < 140 && made < Number(target)) {
      const fen = c.fen()
      const ply = c.history().length
      const lines = await sf.analyze(fen, ply < openingPlies ? 5 : 7, 3)
      if (!lines.length) break
      let uci
      if (ply < openingPlies) uci = lines[Math.floor(rnd() * Math.min(4, lines.length))].pv[0]
      else if (rnd() < blunderRate) {
        const legal = c.moves({ verbose: true })
        uci = legal[Math.floor(rnd() * legal.length)].lan
      } else {
        const top = val(lines[0].score)
        const w = lines.map((l) => Math.exp((Math.max(-3000, val(l.score)) - top) / temperature))
        let r = rnd() * w.reduce((a, b) => a + b, 0)
        uci = lines[w.findIndex((x) => (r -= x) <= 0)]?.pv[0] ?? lines[0].pv[0]
      }
      const beforeMover = val(lines[0].score)
      const lastMove = c.move(uciMove(uci))
      if (c.isGameOver() || ply < 6) continue
      if (mode === 'defesa') {
        // Pré-filtro rápido: só uma resposta não perde?
        const quick = await sf.analyze(c.fen(), 10, 2)
        if (quick.length < 2 || val(quick[0].score) < -150 || val(quick[1].score) > -200) continue
        const key = c.fen().split(' ').slice(0, 4).join(' ')
        if (seen.has(key)) continue
        seen.add(key)
        const sol = await buildDefense(sf, c.fen(), lastMove)
        if (!sol) continue
        const { themes, rating } = defenseThemesAndRating(fen, uci, sol)
        // Fugir com a peça atacada é o caso mais comum: guarda só uma parte.
        if (themes.includes('savePiece') && !themes.includes('quietMove') && rnd() > 0.6) continue
        const id = `d${seedArg}-${made}`
        appendFileSync(out, JSON.stringify([id, fen, [uci, ...sol.moves].join(' '), rating, themes.join(' ')]) + '\n')
        made++
        if (made % 25 === 0) console.log(`[${seedArg}] ${made} desafios de defesa`)
        continue
      }
      // O lance jogado entregou a partida? (quem joga agora fica com grande vantagem)
      const after = await sf.analyze(c.fen(), 10, 1)
      if (!after.length) continue
      const solverAdv = val(after[0].score)
      if (solverAdv < 300 || beforeMover < -120) continue
      const key = fen.split(' ').slice(0, 4).join(' ')
      if (seen.has(key)) continue
      seen.add(key)
      const sol = await buildSolution(sf, c.fen())
      if (!sol) continue
      const { themes, rating } = themesAndRating(fen, uci, sol)
      // Peças penduradas em um lance são abundantes: guarda só uma parte para equilibrar a base.
      if (themes.includes('hangingPiece') && rnd() > 0.5) continue
      const id = `g${seedArg}-${made}`
      appendFileSync(out, JSON.stringify([id, fen, [uci, ...sol.moves].join(' '), rating, themes.join(' ')]) + '\n')
      made++
      if (made % 25 === 0) console.log(`[${seedArg}] ${made} desafios`)
    }
  }
  sf.p.kill()
}

main()
