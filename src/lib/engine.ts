import type { Score } from './analysis'

export interface EngineLine {
  multipv: number
  depth: number
  /** Ponto de vista das brancas. */
  score: Score
  pv: string[]
}

export interface AnalyzeResult {
  bestmove: string
  lines: EngineLine[]
}

export interface AnalyzeOptions {
  fen: string
  depth?: number
  movetime?: number
  multipv?: number
  options?: Record<string, string | number | boolean>
}

/** Envolve o Stockfish (Web Worker) com uma fila: um pedido de análise por vez. */
export class Engine {
  private worker: Worker
  private listeners = new Set<(line: string) => void>()
  private chain: Promise<unknown>
  private current: Record<string, string> = {}
  private generation = 0

  constructor(url = '/stockfish/stockfish.js') {
    this.worker = new Worker(url)
    this.worker.onmessage = (e: MessageEvent) => {
      const line = String(e.data)
      for (const l of this.listeners) l(line)
    }
    this.chain = this.handshake()
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd)
  }

  private waitFor(prefix: string, onLine?: (line: string) => void): Promise<string> {
    return new Promise((resolve) => {
      const fn = (line: string) => {
        onLine?.(line)
        if (line.startsWith(prefix)) {
          this.listeners.delete(fn)
          resolve(line)
        }
      }
      this.listeners.add(fn)
    })
  }

  private async handshake() {
    const ok = this.waitFor('uciok')
    this.send('uci')
    await ok
    this.send('setoption name Hash value 16')
    await this.ready()
  }

  private ready() {
    const p = this.waitFor('readyok')
    this.send('isready')
    return p
  }

  /** Descarta os pedidos pendentes e interrompe o atual (o resultado dele é ignorado por quem chamou). */
  cancelAll() {
    this.generation++
    this.send('stop')
  }

  analyze(opts: AnalyzeOptions): Promise<AnalyzeResult | null> {
    const gen = this.generation
    const job = this.chain.then(() => (gen === this.generation ? this.run(opts) : null))
    this.chain = job.catch(() => null)
    return job
  }

  private async run({ fen, depth, movetime, multipv = 1, options = {} }: AnalyzeOptions): Promise<AnalyzeResult> {
    const wanted: Record<string, string> = { MultiPV: String(multipv) }
    for (const [k, v] of Object.entries(options)) wanted[k] = String(v)
    let changed = false
    for (const [k, v] of Object.entries(wanted)) {
      if (this.current[k] !== v) {
        this.send(`setoption name ${k} value ${v}`)
        this.current[k] = v
        changed = true
      }
    }
    if (changed) await this.ready()

    const whiteToMove = fen.split(' ')[1] === 'w'
    const lines = new Map<number, EngineLine>()
    this.send(`position fen ${fen}`)
    const done = this.waitFor('bestmove', (line) => {
      if (!line.startsWith('info') || !line.includes(' pv ')) return
      const parsed = parseInfo(line, whiteToMove)
      if (parsed) lines.set(parsed.multipv, parsed)
    })
    this.send(movetime ? `go movetime ${movetime}` : `go depth ${depth ?? 12}`)
    const last = await done
    const bestmove = last.split(' ')[1]
    return { bestmove, lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv) }
  }

  destroy() {
    this.worker.terminate()
  }
}

export function parseInfo(line: string, whiteToMove: boolean): EngineLine | null {
  const tokens = line.split(' ')
  const get = (key: string) => {
    const i = tokens.indexOf(key)
    return i >= 0 ? tokens[i + 1] : undefined
  }
  const scoreIdx = tokens.indexOf('score')
  const pvIdx = tokens.indexOf('pv')
  if (scoreIdx < 0 || pvIdx < 0) return null
  const kind = tokens[scoreIdx + 1]
  const raw = Number(tokens[scoreIdx + 2])
  const sign = whiteToMove ? 1 : -1
  const score: Score = kind === 'mate' ? { mate: raw * sign } : { cp: raw * sign }
  return {
    multipv: Number(get('multipv') ?? 1),
    depth: Number(get('depth') ?? 0),
    score,
    pv: tokens.slice(pvIdx + 1),
  }
}
