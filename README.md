# log.txt — dziennik w stylu terminala

> `// miejsce na refleksję, nie gadżet`

**log.txt** to aplikacja do prowadzenia dziennika, która łączy dziennik myśli, tracker nastroju, notatnik, checklisty i notatki głosowe — a cały interfejs nawiązuje do świata programowania. Zapisujesz dzień jak commit, a myśli jak logi.

## Sekcje

| Sekcja       | Co robi |
|--------------|---------|
| `~/dashboard` | Układ kafelkowy (bento): powitanie, szybkie akcje, motto dnia, log aktywności w stylu `git log`, przypięte notatki, otwarte zadania i skróty do sekcji — ze statystykami (commits_today, day_streak) |
| `entries/`   | Wpisy dziennika — każdy jak osobny plik z datownikiem (`2026-07-11_23-42.md`) i tagami (`#refleksja`, `#praca`) |
| `mood.log`   | Szybki tracker nastroju (1–5) wizualizowany jak GitHub contribution graph, z polem na kontekst |
| `notes/`     | Luźne notatki markdown-friendly z podglądem `edit / preview` jak w IDE |
| `tasks.todo` | Checklisty `- [ ] / - [~] / - [x]` ze statusami `pending / in_progress / done`, grupowane w sprinty |
| `voice/`     | Notatki głosowe z oscyloskopem na żywo, ASCII-waveform (`▁▂▅▇█`) i automatyczną transkrypcją (Groq Whisper po stronie serwera — patrz niżej) |

## Motywy

- **dark** (domyślny, „terminal") — głębokie tło `#0d0f12`, neonowa zieleń `#4ade80`, fiolet `#a78bfa`, cyjan `#22d3ee`, subtelne poświaty jak w dobrym IDE
- **light** („dziennik") — ciepłe pudrowe tło `#faf7f2`, szałwiowa zieleń, pudrowy róż, błękit mgły — bardziej intymnie, ta sama struktura

Przełącznik `light_mode / dark_mode` w lewym dolnym rogu.

## Serwer lokalny

Zero build stepu — czysty HTML/CSS/JS:

```bash
# dowolny statyczny serwer, np.:
python3 -m http.server 8000
# → http://localhost:8000
```

Nagrywanie głosu wymaga `https://` albo `localhost`, więc otwarcie pliku przez `file://` nie wystarczy.

## Transkrypcja

Po zakończeniu nagrania plik trafia do funkcji `transcribe` po stronie Supabase, a ta woła **Groq Whisper** kluczem trzymanym w sekretach projektu. Użytkownik nie konfiguruje niczego i nigdy nie widzi żadnego klucza.

Rozpoznawanie mowy wbudowane w przeglądarkę (Web Speech API) działa nadal w trakcie nagrywania i daje tekst od ręki — służy jako zapas, gdyby transkrypcja po stronie serwera nie odpowiedziała. Każde nagranie, również starsze, można przepuścić ponownie przyciskiem `↻ transkrybuj`.

Limit pliku po stronie API to 25 MB. Endpoint Groqa jest zgodny z OpenAI, więc zmiana dostawcy to podmiana adresu w `supabase/functions/transcribe/index.ts`.

## Dane

Wszystko żyje w **Supabase**: wpisy w Postgresie, nagrania i zdjęcia w prywatnym magazynie plików, konta w Supabase Auth. Dziennik jest więc dostępny z każdego urządzenia po zalogowaniu, a limit `localStorage` (~5 MB), o który obijały się dłuższe nagrania, przestał obowiązywać.

Reguły RLS w bazie pilnują, że zalogowana osoba widzi i zmienia **wyłącznie swoje** wiersze — nie zależy to od poprawności kodu w przeglądarce. Lokalnie zostaje tylko wybrany motyw i zakres wykresu nastroju.

Zapis jest optymistyczny: ekran odświeża się natychmiast, a wysyłka leci w tle. Pasek boczny pokazuje stan (`sync: ok` / `sync: błąd`); nieudany zapis jest ponawiany automatycznie i sygnalizowany komunikatem.

Szczegóły schematu i wdrożenia: [`supabase/README.md`](supabase/README.md).

## Uruchomienie

Aplikacja potrzebuje adresu projektu i klucza publishable w [`config.js`](config.js):

```js
window.LOGTXT_CONFIG = {
  url: "https://<ref>.supabase.co",
  key: "sb_publishable_...",
};
```

Oba są jawne — klucz publishable z założenia trafia do przeglądarki, a o dostępie do danych decyduje RLS, nie on. Sekrety (klucz Groqa, hasło do bazy) trzymane są w sekretach Supabase i GitHuba.

## Stack

- HTML + CSS (custom properties, dwa motywy) + vanilla JS
- Typografia: **JetBrains Mono** (akcenty, nagłówki, datowniki) + **Inter** (dłuższe treści)
- Ikony: inline SVG w stylu Lucide/Feather
- Audio: `MediaRecorder` + `AnalyserNode` (oscyloskop), `SpeechRecognition` (tekst zapasowy)
- Backend: Supabase (Postgres + RLS, Auth, Storage, Edge Functions)
- Klient Supabase leży w `vendor/` zamiast na CDN-ie — jedna zależność mniej, która mogłaby położyć apkę
