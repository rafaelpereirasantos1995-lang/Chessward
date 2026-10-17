# Chessward — Centro de Treinamento de Xadrez

App pessoal de treino de xadrez para web e celular (PWA instalável, funciona offline).

- **Jogar contra a máquina** (Stockfish no próprio aparelho), 14 níveis — do Novato (~250) ao Campeão (~2800).
- **Modo Treino**: mapa vermelho/verde (peças vulneráveis × peças que você ganha), pré-visualização ao
  segurar uma peça (cada destino colorido conforme o resultado), dica do melhor lance e desfazer.
- **Modo Desafio**: sem ajuda, vale rating. O rating começa em 400 e sobe conforme você vence.
- **Treinador ao vivo** (regras): classificação de cada lance (brilhante, ótimo, melhor… capivarada),
  aberturas e gambitos em português, princípios, estrutura de peões, peça mais ativa e alertas táticos.
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
| `scripts` | Cópia do motor e geração da base de aberturas |

Créditos: Stockfish (GPLv3), base de aberturas do Lichess (CC0), peças do Lichess (ver `public/pieces/LICENSES.md`).
