# Sincronização entre aparelhos (Supabase)

Sem configurar nada, o Chessward já salva tudo **no próprio aparelho** — inclusive a partida em
andamento: fechar o app e voltar outro dia retoma do mesmo lance.

Para continuar a mesma partida/treino **em outro aparelho** (PC ↔ celular), configure uma vez
um projeto gratuito no [Supabase](https://supabase.com):

1. Crie uma conta e um projeto novo no Supabase (plano gratuito).
2. No painel do projeto, abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](../supabase/schema.sql) e rode.
   Isso cria a tabela `chessward_state` com segurança por usuário (cada um só vê os próprios dados).
3. Em **Authentication → Providers → Email**, deixe o login por e-mail ativo. Se quiser entrar sem
   confirmar o e-mail, desligue *Confirm email*.
4. Em **Project Settings → API**, copie a *Project URL* e a chave *anon public*.
5. Configure as variáveis de ambiente:
   - Localmente: copie `.env.example` para `.env` e preencha.
   - Na Vercel: **Settings → Environment Variables** → `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, depois faça um novo deploy.
6. No app, toque em ☁️ → **Criar conta** (uma vez) → **Entrar** em cada aparelho com o mesmo e-mail.

## Como funciona

- O estado completo (rating, configurações, partida em andamento com lances, análises e comentários,
  histórico) fica numa linha por usuário.
- Cada alteração é enviada à nuvem em menos de 1 segundo; ao abrir o app ou voltar para ele, a versão
  mais recente é baixada. Vence a cópia alterada por último.
- Sem internet, tudo continua funcionando e a sincronização acontece ao reconectar.
- O ponto colorido no botão ☁️ mostra o estado: verde = sincronizado, amarelo = enviando,
  cinza = sem internet/desconectado, vermelho = erro.
