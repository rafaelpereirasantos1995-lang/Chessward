# Chessward — Centro de Treinamento de Xadrez Pessoal

> Documento de visão. Serve para amadurecer a ideia antes de escrever código.

## 1. Conceito em uma frase

Um tabuleiro que **pensa junto com você**: enquanto você joga contra a máquina ou
treina, ele mostra em tempo real onde você está vulnerável (vermelho), onde está
acertando (verde) e explica o que está acontecendo na partida como um treinador.

## 2. Módulos

### 2.1 Jogar contra a máquina
- Motor **Stockfish** rodando no próprio navegador/celular (WebAssembly) — funciona offline, sem custo de servidor.
- Níveis de força (ex.: 800 a 2800 de rating aproximado) e "personalidades" (agressivo, posicional, defensivo).
- Escolher abertura inicial, cor, controle de tempo, desfazer lance (no modo treino).

### 2.2 Mapa de calor tático (o diferencial)
Duas camadas, que podem ser ligadas/desligadas:

| Camada | O que mostra | Como calcula |
|---|---|---|
| **Estática (instantânea)** | Casas/peças atacadas e mal defendidas, peças penduradas, cravadas, casas fracas | Mapa de ataques e defesas + troca estática (SEE) — sem motor, imediato |
| **Dinâmica (próximos lances)** | Ameaças que surgem em 1–3 lances, casas-alvo do melhor plano | Linhas principais do Stockfish (multi-PV) |

- 🔴 **Vermelho** — peça ou casa onde você perde material/posição agora ou nos próximos lances.
- 🟢 **Verde** — casas que seu lance passa a controlar, ameaças que você cria, alvos do melhor plano.
- **Pré-visualização ao arrastar**: enquanto você segura a peça, cada casa de destino já fica colorida conforme a qualidade daquele lance. Você vê a consequência *antes* de soltar.
- Intensidade da cor proporcional à gravidade (ex.: perder um peão = vermelho claro; perder a dama = vermelho forte).
- Setas mostrando a ameaça ("se você jogar isso, o cavalo dele vai para f7").

### 2.3 Treinador ao vivo (comentários a cada lance)
- **Classificação do lance**: brilhante (!!), ótimo (!), melhor, bom, imprecisão (?!), erro (?), capivarada (??) — baseada na queda de probabilidade de vitória.
- **Reconhecimento de abertura e gambitos** (base ECO aberta do Lichess): "Você está no Gambito da Dama Recusado. Planos típicos: …".
- **Peça mais forte / mais fraca do momento** (mobilidade + contribuição na avaliação).
- **Plano sugerido** conforme estrutura de peões (ataque na ala do rei, minoria, ruptura central…).
- **Barra de avaliação** e gráfico da partida.
- Começa com comentários por regras/templates; numa fase posterior, opcionalmente uma IA de linguagem para explicações mais naturais.

### 2.4 Práticas e testes
- **Posições aleatórias**: o sistema gera/escolhe uma posição e você precisa achar o melhor lance (com nota).
- **Puzzles táticos** (base pública do Lichess, milhões de puzzles, licença livre) filtrados por tema: garfo, cravada, mate em 2, sacrifício…
- **Treino de aberturas** com repetição espaçada (estilo Anki): o app repete as linhas que você erra.
- **Finais essenciais**: rei e peão, torre, mates básicos contra o motor.
- **Adivinhe o lance** em partidas de mestres.
- **Visualização / às cegas**: peças somem e você joga de memória.
- **Xadrez 960** para sair da teoria decorada.

### 2.5 Revisão e evolução
- Análise pós-partida automática com os principais erros.
- Estatísticas: aberturas onde mais erra, tipos de tática que mais perde, rating de treino por módulo.
- Cada erro grave vira automaticamente um puzzle para revisar depois.

### 2.6 Personalização
- Temas de tabuleiro (madeira, mármore, verde clássico, azul, escuro, alto contraste…).
- Conjuntos de peças (vários disponíveis com licença livre) e upload de temas próprios.
- Sons, coordenadas, animações, destaque do último lance, modo canhoto/rotação.
- Níveis de ajuda: **Treino** (tudo ligado) → **Desafio** (só após o lance) → **Prova** (nada, só análise no final). Assim a ajuda não vira muleta.

## 3. Web e celular

**Recomendação: um único código** que roda nos dois.

1. **PWA** (Progressive Web App): abre no navegador e pode ser "instalado" no celular pela tela inicial, funciona offline. Rápido de entregar.
2. Depois, se quiser lojas (Play Store / App Store), empacotar o mesmo código com **Capacitor**.

## 4. Stack técnica proposta

| Parte | Escolha | Motivo |
|---|---|---|
| Interface | React + TypeScript + Vite + Tailwind | Já usado no outro projeto do repositório; ecossistema grande |
| Regras do xadrez | `chess.js` | Lances legais, xeque, mate, PGN/FEN |
| Tabuleiro | `chessground` (o do Lichess) ou `react-chessboard` | Arrastar, setas, destaque de casas, temas |
| Motor | Stockfish WASM (Web Worker) | Forte, gratuito, offline |
| Dados locais | IndexedDB | Partidas, progresso, puzzles sem precisar de servidor |
| Sincronização (opcional) | Supabase | Mesmo progresso no PC e no celular |
| Hospedagem | Vercel | Grátis para uso pessoal |

## 5. Roteiro (fases)

1. **MVP** — tabuleiro + jogar contra Stockfish + barra de avaliação + classificação do lance + 3 temas de tabuleiro/peças. PWA instalável.
2. **Diferencial** — mapa de calor (estático, depois dinâmico) + pré-visualização ao arrastar.
3. **Treinador** — aberturas/gambitos, peça mais forte, planos, análise pós-partida.
4. **Centro de treino** — puzzles, posições aleatórias, finais, aberturas com repetição espaçada.
5. **Evolução** — estatísticas, sincronização entre aparelhos, app nas lojas, comentários com IA.

## 6. Decisões tomadas

- **Rating**: começa no nível mais baixo (400) e sobe nas partidas do modo Desafio; na Fase 4 os treinos (puzzles, posições) também passam a contar.
- **Sincronização completa**: além do progresso, a partida/treino em andamento é salva a cada lance e pode ser retomada em outro aparelho ou outro dia (Supabase).
- **Comentários por regras** por enquanto (sem IA de linguagem).
- **Modos**: Treino (todas as ajudas, não vale rating) e Desafio (sem ajudas, vale rating, análise no final).
- O projeto ocupa este repositório (o antigo `contabilidade-interativa-vercel` foi removido).

## 7. Status

- ✅ Fase 1 completa (tabuleiro, máquina com 14 níveis, avaliação, classificação, temas, PWA, rating, sincronização).
- ✅ Parte da Fase 2: mapa estático vermelho/verde e pré-visualização ao segurar a peça.
- ✅ Parte da Fase 3: aberturas/gambitos, peça mais ativa, princípios, estrutura de peões, resumo pós-partida.
- ✅ Testes (desafios táticos aleatórios estilo Lichess): sem ajuda, continua a cada lance certo, rating próprio, sequência e filtros por tema; modos Ataque, Defesa ou Misto, com acertos separados por tipo.
- ⏭️ Próximo: trocar/ampliar a base de desafios pela do Lichess, camada dinâmica do mapa (ameaças em 2–3 lances via motor), finais e aberturas com repetição espaçada.

## 8. Perguntas em aberto

- Quer publicar nas lojas ou o PWA instalado é suficiente?
