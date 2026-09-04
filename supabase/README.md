# Backend (Supabase)

Migracja `log.txt` z `localStorage` na prawdziwy backend: konta, dane w Postgresie,
nagrania w Storage, transkrypcja przez Edge Function z kluczem po stronie serwera.

## Co tu jest

| Plik | Rola |
|------|------|
| `migrations/0001_init.sql` | tabele `profiles / entries / moods / notes / tasks / voice_notes`, indeksy, RLS, trigger zakładający profil przy rejestracji |
| `migrations/0002_storage.sql` | prywatny bucket `media` na audio i zdjęcia + polityki dostępu po `user_id` |
| `functions/transcribe/index.ts` | Edge Function wołająca Groq Whisper; klucz w sekrecie `GROQ_API_KEY`, nie w przeglądarce |

## Model danych

Każdy wiersz ma `user_id` wskazujący na `auth.users`, a RLS przepuszcza wyłącznie
własne wiersze — bez zalogowania nie widać niczego. Odpowiedniki dawnego stanu
z `localStorage`:

- `state.entries` → `entries` (`tags` jako `text[]`, załączniki jako `jsonb`)
- `state.moods` → `moods` (jeden wpis na dzień wymuszony przez `unique (user_id, day)`)
- `state.notes` → `notes` (`updated_at` odświeżane triggerem w bazie)
- `state.tasks` → `tasks` (`status` pilnowany przez `check`)
- `state.voice` → `voice_notes` — tabela została tylko dla starych nagrań: przy pierwszym wczytaniu aplikacja przenosi je do `entries` (jako załącznik audio) i czyści kolekcję. Nowe nagrania od razu lądują w `entries` + plik audio w buckecie `media`

Nagrania przestają być base64 w `localStorage`, więc znika limit ~5 MB i komunikat
`local: FULL`.

## Wdrożenie

Backend jedzie z GitHuba: workflow `.github/workflows/supabase.yml` przy każdym
pushu zmieniającym `supabase/` wgrywa migracje i publikuje Edge Function. Schemat
bazy jest więc wersjonowany w repo, a nie klikany w panelu.

Do działania potrzebne są trzy sekrety repozytorium
(*Settings → Secrets and variables → Actions*):

| Sekret | Skąd |
|--------|------|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
| `SUPABASE_DB_PASSWORD` | hasło do bazy podane przy zakładaniu projektu |
| `GROQ_API_KEY` | console.groq.com/keys |

Klucz Groqa jest ustawiany **raz, w sekretach projektu Supabase** — użytkownicy
aplikacji nie konfigurują niczego. Nie trafia ani do repozytorium, ani do
przeglądarki.

Ręcznie to samo:

```bash
supabase link          # project_id bierze z config.toml
supabase db push
supabase secrets set GROQ_API_KEY=gsk_...
supabase functions deploy transcribe
```
