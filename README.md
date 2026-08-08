# log.txt — dziennik w stylu terminala

> `// miejsce na refleksję, nie gadżet`

**log.txt** to aplikacja do prowadzenia dziennika, która łączy dziennik myśli, tracker nastroju, notatnik, checklisty i notatki głosowe — a cały interfejs nawiązuje do świata programowania. Zapisujesz dzień jak commit, a myśli jak logi.

## Sekcje

| Sekcja       | Co robi |
|--------------|---------|
| `~/dashboard` | Chronologiczny log całej aktywności w stylu `git log`, ze statystykami (commits_today, day_streak) |
| `entries/`   | Wpisy dziennika — każdy jak osobny plik z datownikiem (`2026-07-11_23-42.md`) i tagami (`#refleksja`, `#praca`) |
| `mood.log`   | Szybki tracker nastroju (1–5) wizualizowany jak GitHub contribution graph, z polem na kontekst |
| `notes/`     | Luźne notatki markdown-friendly z podglądem `edit / preview` jak w IDE |
| `tasks.todo` | Checklisty `- [ ] / - [~] / - [x]` ze statusami `pending / in_progress / done`, grupowane w sprinty |
| `voice/`     | Notatki głosowe z oscyloskopem na żywo, ASCII-waveform (`▁▂▅▇█`) i automatyczną transkrypcją (Web Speech API albo Groq Whisper — patrz niżej) |

## Motywy

- **dark** (domyślny, „terminal") — głębokie tło `#0d0f12`, neonowa zieleń `#4ade80`, fiolet `#a78bfa`, cyjan `#22d3ee`, subtelne poświaty jak w dobrym IDE
- **light** („dziennik") — ciepłe pudrowe tło `#faf7f2`, szałwiowa zieleń, pudrowy róż, błękit mgły — bardziej intymnie, ta sama struktura

Przełącznik `light_mode / dark_mode` w lewym dolnym rogu.

## Uruchomienie

Zero zależności, zero build stepu — czysty HTML/CSS/JS:

```bash
# dowolny statyczny serwer, np.:
python3 -m http.server 8000
# → http://localhost:8000
```

Albo po prostu otwórz `index.html` w przeglądarce (nagrywanie głosu wymaga `https://` lub `localhost`).

## Transkrypcja

Dwa silniki, przełączane obecnością klucza API w panelu `whisper --config` w sekcji `voice/`:

| Silnik | Kiedy działa | Jakość | Co wychodzi z urządzenia |
|--------|--------------|--------|--------------------------|
| **Web Speech API** (domyślnie) | brak klucza; wymaga Chrome/Edge/Safari | średnia, tylko w trakcie nagrywania | w Chrome audio leci przez serwery Google |
| **Groq Whisper** | po wpisaniu klucza | wysoka, także dla starych nagrań | plik audio → `api.groq.com` |

**Konfiguracja Groq:** klucz z [console.groq.com/keys](https://console.groq.com/keys) (darmowy tier z limitem zapytań) wklejasz w `voice/ → whisper --config`. Do wyboru `whisper-large-v3-turbo` (szybszy) i `whisper-large-v3` (dokładniejszy). Przycisk `test` sprawdza klucz bez wysyłania audio.

Z aktywnym kluczem rozpoznawanie w przeglądarce jest wyłączane, a transkrybowany jest gotowy plik po zakończeniu nagrania — dzięki czemu każde nagranie (również wcześniejsze) można przepuścić ponownie przyciskiem `↻ transkrybuj`.

Kilka uwag:

- Klucz leży w `localStorage` tej przeglądarki i wędruje wyłącznie do Groq — aplikacja nie ma backendu, więc nie ma gdzie go schować. Na wspólnym komputerze lepiej go po sesji usunąć (`usuń klucz`).
- Limit pliku po stronie API to 25 MB.
- Endpoint jest zgodny z OpenAI, więc przejście na OpenAI albo własne proxy to podmiana `STT_URL` w `app.js`.

## Dane

Wszystko trzymane lokalnie w `localStorage` przeglądarki — bez backendu i bez konta. Nagrania głosowe zapisywane są jako base64, więc przy dłuższych nagraniach limit `localStorage` (~5 MB) może się wyczerpać — aplikacja wtedy o tym poinformuje (`local: FULL`).

Jedyne, co opuszcza urządzenie, to audio wysyłane do transkrypcji — i tylko wtedy, gdy sam(a) skonfigurujesz klucz API. Bez klucza nic nie wychodzi na zewnątrz.

## Stack

- HTML + CSS (custom properties, dwa motywy) + vanilla JS
- Typografia: **JetBrains Mono** (akcenty, nagłówki, datowniki) + **Inter** (dłuższe treści)
- Ikony: inline SVG w stylu Lucide/Feather
- Audio: `MediaRecorder` + `AnalyserNode` (oscyloskop), `SpeechRecognition` (transkrypcja pl-PL)
- Transkrypcja opcjonalnie przez Groq Whisper (endpoint zgodny z OpenAI, wołany prosto z przeglądarki)
