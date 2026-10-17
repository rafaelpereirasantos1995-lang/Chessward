// Reconhecimento de aberturas (base CC0 do Lichess) com nomes em português para as famílias mais comuns.

let db: Record<string, [string, string]> | null = null

export async function loadOpenings() {
  if (!db) db = (await import('../data/openings.json')).default as unknown as Record<string, [string, string]>
  return db
}

export const openingsLoaded = () => db !== null

export const positionKey = (fen: string) => fen.split(' ').slice(0, 3).join(' ')

export interface OpeningInfo {
  eco: string
  name: string
  family: string
  gambit: boolean
}

/** Só funciona depois de loadOpenings() ter terminado; antes disso retorna null. */
export function lookupOpening(fen: string): OpeningInfo | null {
  const hit = db?.[positionKey(fen)]
  if (!hit) return null
  const [eco, name] = hit
  const [familyEn, variation] = name.split(/:(.*)/s)
  const family = translateFamily(familyEn.trim())
  return {
    eco,
    family,
    name: variation ? `${family} — ${translateVariation(variation.trim())}` : family,
    gambit: /gambit/i.test(name),
  }
}

const FAMILIES: Record<string, string> = {
  'Sicilian Defense': 'Defesa Siciliana',
  'Ruy Lopez': 'Ruy López (Espanhola)',
  "Queen's Gambit Declined": 'Gambito da Dama Recusado',
  "Queen's Gambit Accepted": 'Gambito da Dama Aceito',
  "Queen's Gambit": 'Gambito da Dama',
  'French Defense': 'Defesa Francesa',
  'Italian Game': 'Partida Italiana',
  'English Opening': 'Abertura Inglesa',
  "King's Gambit Accepted": 'Gambito do Rei Aceito',
  "King's Gambit Declined": 'Gambito do Rei Recusado',
  "King's Gambit": 'Gambito do Rei',
  "King's Indian Defense": 'Defesa Índia do Rei',
  "King's Indian Attack": 'Ataque Índio do Rei',
  'Caro-Kann Defense': 'Defesa Caro-Kann',
  'Nimzo-Indian Defense': 'Defesa Nimzo-Índia',
  "Queen's Pawn Game": 'Jogo do Peão da Dama',
  "King's Pawn Game": 'Jogo do Peão do Rei',
  'Semi-Slav Defense': 'Defesa Semi-Eslava',
  'Slav Defense': 'Defesa Eslava',
  'Dutch Defense': 'Defesa Holandesa',
  'Benoni Defense': 'Defesa Benoni',
  'Grünfeld Defense': 'Defesa Grünfeld',
  "Queen's Indian Defense": 'Defesa Índia da Dama',
  'Alekhine Defense': 'Defesa Alekhine',
  'Scotch Game': 'Partida Escocesa',
  'Indian Defense': 'Defesa Índia',
  "Petrov's Defense": 'Defesa Petrov',
  'Four Knights Game': 'Partida dos Quatro Cavalos',
  'Three Knights Opening': 'Abertura dos Três Cavalos',
  'Scandinavian Defense': 'Defesa Escandinava',
  'Philidor Defense': 'Defesa Philidor',
  'Vienna Game': 'Partida Vienense',
  'Vienna Gambit': 'Gambito Vienense',
  "Bishop's Opening": 'Abertura do Bispo',
  'Modern Defense': 'Defesa Moderna',
  'Pirc Defense': 'Defesa Pirc',
  'Catalan Opening': 'Abertura Catalã',
  'Bird Opening': 'Abertura Bird',
  'Tarrasch Defense': 'Defesa Tarrasch',
  'Polish Opening': 'Abertura Polonesa',
  'Bogo-Indian Defense': 'Defesa Bogo-Índia',
  'Center Game': 'Partida do Centro',
  'Latvian Gambit': 'Gambito Letão',
  'Englund Gambit': 'Gambito Englund',
  'Benko Gambit': 'Gambito Benko',
  'Danish Gambit': 'Gambito Dinamarquês',
  'Evans Gambit': 'Gambito Evans',
  'Blackmar-Diemer Gambit': 'Gambito Blackmar-Diemer',
  'Old Indian Defense': 'Defesa Índia Antiga',
  'Owen Defense': 'Defesa Owen',
  'Réti Opening': 'Abertura Réti',
  'Zukertort Opening': 'Abertura Zukertort',
  'London System': 'Sistema Londres',
  'Trompowsky Attack': 'Ataque Trompowsky',
  'Torre Attack': 'Ataque Torre',
  'Hungarian Opening': 'Abertura Húngara',
  'Grob Opening': 'Abertura Grob',
  'Ponziani Opening': 'Abertura Ponziani',
  'Nimzowitsch Defense': 'Defesa Nimzowitsch',
  'Elephant Gambit': 'Gambito Elefante',
  'Rat Defense': 'Defesa do Rato',
  "King's Knight Opening": 'Abertura do Cavalo do Rei',
  "Queen's Knight Opening": 'Abertura do Cavalo da Dama',
  'Van Geet Opening': 'Abertura Van Geet',
  "Van't Kruijs Opening": "Abertura Van't Kruijs",
  'Mieses Opening': 'Abertura Mieses',
  'Saragossa Opening': 'Abertura Saragoça',
  'Nimzo-Larsen Attack': 'Ataque Nimzo-Larsen',
  'Horwitz Defense': 'Defesa Horwitz',
  'Mexican Defense': 'Defesa Mexicana',
  'Borg Defense': 'Defesa Borg',
  'St. George Defense': 'Defesa São Jorge',
  'Carr Defense': 'Defesa Carr',
  'Barnes Defense': 'Defesa Barnes',
  'Ware Defense': 'Defesa Ware',
  'Pterodactyl Defense': 'Defesa Pterodáctilo',
}

const WORDS: [RegExp, string][] = [
  [/\bAccepted\b/g, 'Aceito'],
  [/\bDeclined\b/g, 'Recusado'],
  [/\bVariation\b/g, 'Variante'],
  [/\bAttack\b/g, 'Ataque'],
  [/\bGambit\b/g, 'Gambito'],
  [/\bDefense\b/g, 'Defesa'],
  [/\bSystem\b/g, 'Sistema'],
  [/\bLine\b/g, 'Linha'],
  [/\bMain\b/g, 'Principal'],
  [/\bExchange\b/g, 'das Trocas'],
  [/\bAdvance\b/g, 'do Avanço'],
  [/\bClassical\b/g, 'Clássica'],
  [/\bModern\b/g, 'Moderna'],
  [/\bOpening\b/g, 'Abertura'],
]

function translateFamily(en: string): string {
  if (FAMILIES[en]) return FAMILIES[en]
  // Ex.: "Vienna Gambit, with Max Lange Defense"
  const base = Object.keys(FAMILIES).find((k) => en.startsWith(k))
  if (base) return FAMILIES[base] + en.slice(base.length)
  return translateVariation(en)
}

/** Nome completo ("Família: Variante") traduzido. */
export function translateName(name: string): string {
  const [fam, variation] = name.split(/:(.*)/s)
  const family = translateFamily(fam.trim())
  return variation ? `${family} — ${translateVariation(variation.trim())}` : family
}

const SUFFIXES: Record<string, string> = { Variation: 'Variante', Attack: 'Ataque', Gambit: 'Gambito', Defense: 'Defesa', System: 'Sistema', Line: 'Linha', Opening: 'Abertura', Game: 'Partida' }

function translateVariation(en: string): string {
  // "Declined Variation" → "Variante Declined" → "Variante Recusado": em português o tipo vem antes do nome.
  const reordered = en
    .split(', ')
    .map((part) => {
      const m = part.match(/^(.+) (Variation|Attack|Gambit|Defense|System|Line|Opening|Game)$/)
      return m ? `${SUFFIXES[m[2]]} ${m[1]}` : part
    })
    .join(', ')
  return WORDS.reduce((s, [re, pt]) => s.replace(re, pt), reordered)
}

/** Ideias típicas por família, mostradas pelo treinador ao entrar na abertura. */
export const OPENING_TIPS: [RegExp, string][] = [
  [/Siciliana/, 'As pretas lutam pelo centro de forma assimétrica (c5 contra e4). Jogo dinâmico: as brancas costumam atacar na ala do rei, as pretas na ala da dama.'],
  [/Francesa/, 'Cadeia de peões e6–d5 sólida. O bispo de casas brancas das pretas fica preso: planeje liberá-lo (…b6/…Ba6 ou ruptura …c5/…f6).'],
  [/Caro-Kann/, 'Sólida: o bispo das pretas sai antes de …e6. Espere um jogo posicional; as brancas buscam espaço.'],
  [/Ruy López/, 'O bispo em b5 pressiona o cavalo que defende e5. Plano clássico: c3 e d4 para construir um centro forte.'],
  [/Italiana/, 'Bispo em c4 mirando f7. Desenvolva rápido, faça roque e prepare d4 (com c3) para disputar o centro.'],
  [/Gambito da Dama/, 'As brancas oferecem o peão c4 para desviar o peão d5 do centro. Normalmente o material é recuperado.'],
  [/Índia do Rei/, 'As pretas cedem o centro e depois o atacam com …e5 ou …c5. Ataques em alas opostas são comuns.'],
  [/Nimzo-Índia/, 'O bispo em b4 crava o cavalo de c3 e controla e4. As pretas aceitam ceder o par de bispos por estrutura.'],
  [/Escandinava/, 'A dama sai cedo para d5 e será atacada: as pretas perdem tempo, mas ganham uma posição simples.'],
  [/Inglesa/, 'Abertura flexível: as brancas controlam d5 pelo flanco e podem transpor para várias estruturas.'],
  [/Holandesa/, '…f5 controla e4 e prepara ataque na ala do rei, mas enfraquece a diagonal e8–h5.'],
  [/Escocesa/, 'As brancas abrem o centro cedo com d4. Jogo aberto e de desenvolvimento rápido.'],
  [/Petrov/, 'As pretas espelham as brancas atacando e4. Cuidado: copiar os lances por muito tempo costuma ser perigoso.'],
  [/Londres/, 'Sistema sólido: d4, Bf4, e3, c3. Fácil de jogar e com planos claros.'],
  [/Vienense/, 'Nc3 antes de Nf3 prepara f4, num estilo parecido com o Gambito do Rei.'],
]
