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
- `state.voice` → `voice_notes` + plik audio w buckecie `media`

Nagrania przestają być base64 w `localStorage`, więc znika limit ~5 MB i komunikat
`local: FULL`.

## Wdrożenie

Migracje są w repo, żeby dało się je odtworzyć na czystym projekcie:

```bash
supabase link --project-ref <ref>
supabase db push
supabase functions deploy transcribe
supabase secrets set GROQ_API_KEY=gsk_...
```

Klucz Groqa ustawia się **raz, w sekretach projektu** — użytkownicy aplikacji nie
konfigurują niczego. Sekret nigdy nie trafia do repozytorium ani do przeglądarki.
