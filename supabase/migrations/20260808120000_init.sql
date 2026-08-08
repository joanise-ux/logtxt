-- log.txt — schemat startowy
-- Każda tabela należy do zalogowanego użytkownika (auth.users) i jest odcięta
-- politykami RLS: bez zalogowania nie widać niczego, a zalogowany widzi wyłącznie
-- własne wiersze. Dane wcześniej trzymane w localStorage mapują się 1:1.

/* ── profil (nazwa pokazywana w pasku bocznym) ── */
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  created_at timestamptz not null default now()
);

/* ── entries/ ── */
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  body        text not null default '',
  tags        text[] not null default '{}',
  attachments jsonb  not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

/* ── mood.log — jeden wpis na dzień, stąd unikalność (user_id, day) ── */
create table if not exists public.moods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  score      smallint not null check (score between 1 and 5),
  note       text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

/* ── notes/ ── */
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default '',
  body        text not null default '',
  pinned      boolean not null default false,
  pinned_at   timestamptz,
  attachments jsonb  not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

/* ── tasks.todo ── */
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  text       text not null,
  status     text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  sprint     text not null default '',
  created_at timestamptz not null default now(),
  done_at    timestamptz
);

/* ── voice/ — samo audio ląduje w Storage, tu tylko metadane i ścieżka ── */
create table if not exists public.voice_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  audio_path text not null,
  duration   integer not null default 0,
  peaks      real[]  not null default '{}',
  transcript text not null default '',
  stt_error  text not null default '',
  created_at timestamptz not null default now()
);

/* ── indeksy pod listowanie „od najnowszych" ── */
create index if not exists entries_user_created_idx     on public.entries     (user_id, created_at desc);
create index if not exists moods_user_day_idx           on public.moods       (user_id, day desc);
create index if not exists notes_user_updated_idx       on public.notes       (user_id, updated_at desc);
create index if not exists tasks_user_created_idx       on public.tasks       (user_id, created_at desc);
create index if not exists voice_notes_user_created_idx on public.voice_notes (user_id, created_at desc);

/* ── RLS: właściciel widzi i zmienia wyłącznie swoje wiersze ──
   auth.uid() opakowane w (select ...), żeby Postgres policzył je raz na zapytanie,
   a nie dla każdego wiersza osobno. */
alter table public.profiles    enable row level security;
alter table public.entries     enable row level security;
alter table public.moods       enable row level security;
alter table public.notes       enable row level security;
alter table public.tasks       enable row level security;
alter table public.voice_notes enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "own entries" on public.entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own moods" on public.moods
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own notes" on public.notes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own tasks" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own voice notes" on public.voice_notes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

/* ── profil zakładany automatycznie przy rejestracji ── */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- `updated_at` ustawia klient (pokazuje je w liście notatek), więc celowo
-- nie ma tu triggera nadpisującego tę wartość czasem serwera.
