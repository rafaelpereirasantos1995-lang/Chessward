# Chessward — Centro de Treinamento de Xadrez

App pessoal de treino de xadrez para web e celular (PWA instalável, funciona offline).

- **Jogar contra a máquina** (Stockfish no próprio aparelho), 14 níveis — do Novato (~250) ao Campeão (~2800).
- **Modo Treino**: mapa vermelho/verde (peças vulneráveis × peças que você ganha), pré-visualização ao
  segurar uma peça (cada destino colorido conforme o resultado), dica do melhor lance e desfazer.
- **Modo Desafio**: sem ajuda, vale rating. O rating começa em 400 e sobe conforme você vence.
- **Treinador ao vivo** (regras): classificação de cada lance (brilhante, ótimo, melhor… capivarada),
  aberturas e gambitos em português, princípios, estrutura de peões, peça mais ativa e alertas táticos.
- **Testes (desafios táticos)**: posições sorteadas perto do seu nível, sem nenhuma ajuda. Cada lance certo
  faz o adversário responder e o desafio continua até você resolver ou errar (estilo Lichess). Rating próprio
  (começa em 400), sequência de acertos e filtro por tema. Modos **⚔️ Ataque** (encontrar a combinação vencedora),
  **🛡️ Defesa** (o adversário ameaça algo e só um lance salva) ou **🎲 Misto** (sorteia entre os dois).
- **Mapa dinâmico** (Treino): o motor mostra o plano da máquina para os próximos lances com setas tracejadas.
- **Opções de partida**: relógio (5+3, 10, 15+10, 30 — pausa ao sair do app), **às cegas** (com "espiar") e **Xadrez 960** (sem roque).
- **Treinos**: finais essenciais contra o Stockfish (11 posições conferidas pelo motor), **aberturas** de 12 famílias com
  repetição espaçada e **adivinhe o lance** em 60 partidas de jogadores 2300+ do Lichess.
- **Evolução**: gráfico do rating (partidas e testes), aberturas com pontuação e precisão, temas táticos mais fracos,
  qualidade dos lances e **revisão dos seus erros** (cada erro grave vira um desafio com repetição espaçada).
- **Resumo da partida**: precisão sua e da máquina, contagem por tipo de lance e revisão lance a lance com o melhor lance indicado.
- **Aparência**: 8 tabuleiros e 8 conjuntos de peças.
- **Progresso salvo sempre**: a partida em andamento continua de onde parou; com Supabase configurado,
  continua em outro aparelho ([docs/SINCRONIZACAO.md](docs/SINCRONIZACAO.md)).

Visão completa e próximas fases: [docs/VISAO.md](docs/VISAO.md).

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes da lógica (táticas, análise, rating, treinador)
npm run build    # gera dist/ (PWA)
```

## Deploy (Vercel)

Importe o repositório na Vercel com a raiz do projeto apontando para a raiz do repositório.
O `vercel.json` já define build e rotas. Para sincronização, adicione as variáveis do `.env.example`.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/lib` | Lógica pura: táticas/mapa de calor, classificação de lances, motor, bot, treinador, aberturas, rating |
| `src/game/controller.ts` | Orquestra partida, máquina, análise e comentários |
| `src/state` | Estado persistente e sincronização (Supabase) |
| `src/components` | Tabuleiro, painéis e diálogos |
| `src/game/puzzles.ts` | Fluxo dos testes (lance certo/errado, resposta do adversário, rating) |
| `src/game/trainers.ts` | Finais, aberturas e "adivinhe o lance" |
| `scripts` | Cópia do motor, base de aberturas e base de desafios |

## Dados dos treinos

`scripts/build-trainers.mjs` gera `src/data/opening-lines.json` (linhas do `lichess-org/chess-openings`, CC0) e
`src/data/master-games.json` (partidas rápidas/clássicas com ambos 2300+, do arquivo mensal do Lichess, CC0).

## Base de desafios

`public/puzzles.json` (~8.400 desafios) é montado por `scripts/build-puzzles.mjs`:

- **Base oficial do Lichess** (CC0, 6 milhões de desafios com rating medido por jogadores reais): amostra
  estratificada por faixa de 100 pontos de rating e por tipo (ataque/defesa), só desafios bem avaliados.
- **Desafios gerados com o Stockfish** (`scripts/generate-puzzles.mjs`) completam o que o Lichess quase não
  tem: defesas abaixo de 700. O gerador joga partidas do motor contra si mesmo; no modo `ataque`, um erro
  cuja punição é única vira desafio; no modo `defesa`, uma ameaça real que só um lance neutraliza.

Para refazer (pede ~300 MB de download, processados em streaming):

```bash
curl -sS https://database.lichess.org/lichess_db_puzzle.csv.zst | zstd -dc \
  | node scripts/build-puzzles.mjs gerados-defesa.jsonl /dev/stdin
```

Créditos: Stockfish (GPLv3), aberturas e desafios do Lichess (CC0), peças do Lichess (ver `public/pieces/LICENSES.md`).
