-- Tabela de sincronização do Chessward: uma linha por usuário com o estado completo do app.
create table if not exists public.chessward_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.chessward_state enable row level security;

create policy "dono lê" on public.chessward_state for select using (auth.uid() = user_id);
create policy "dono cria" on public.chessward_state for insert with check (auth.uid() = user_id);
create policy "dono altera" on public.chessward_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
