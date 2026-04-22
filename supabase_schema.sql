-- ============================================================
-- CanalStream — SQL para Supabase
-- Ejecutar en el SQL Editor de tu proyecto de Supabase
-- ============================================================

-- ── Tabla de Favoritos ────────────────────────────────────────
create table if not exists public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  tmdb_id     text not null,
  media_type  text not null check (media_type in ('movie', 'tv')),
  title       text not null,
  poster_path text,
  year        text,
  created_at  timestamptz default now(),
  unique(user_id, tmdb_id)
);

-- RLS en favorites
alter table public.favorites enable row level security;

create policy "Users can read own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "Users can insert own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- ── Tabla de Historial de Reproducción ───────────────────────
create table if not exists public.watch_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  tmdb_id      text not null,
  media_type   text not null check (media_type in ('movie', 'tv')),
  title        text not null,
  poster_path  text,
  year         text,
  progress_pct float default 0 check (progress_pct >= 0 and progress_pct <= 100),
  watched_at   timestamptz default now(),
  unique(user_id, tmdb_id)
);

-- RLS en watch_history
alter table public.watch_history enable row level security;

create policy "Users can read own history"
  on public.watch_history for select
  using (auth.uid() = user_id);

create policy "Users can upsert own history"
  on public.watch_history for insert
  with check (auth.uid() = user_id);

create policy "Users can update own history"
  on public.watch_history for update
  using (auth.uid() = user_id);

-- ── Índices para rendimiento ──────────────────────────────────
create index if not exists idx_favorites_user    on public.favorites(user_id);
create index if not exists idx_history_user      on public.watch_history(user_id);
create index if not exists idx_history_watched   on public.watch_history(watched_at desc);
