-- log.txt — ulubione motta dnia
-- Motta to stała lista w i18n (dash.motto.1 … dash.motto.N), więc zapisujemy
-- sam numer — tekst tłumaczy się razem z językiem aplikacji. Jedno motto może
-- być w ulubionych danego konta tylko raz.

create table if not exists public.motto_favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  motto      smallint not null check (motto >= 1),
  created_at timestamptz not null default now(),
  unique (user_id, motto)
);

create index if not exists motto_favorites_user_created_idx
  on public.motto_favorites (user_id, created_at desc);

alter table public.motto_favorites enable row level security;

create policy "own motto favorites" on public.motto_favorites
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
