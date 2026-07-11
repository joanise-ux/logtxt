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
| `voice/`     | Notatki głosowe z oscyloskopem na żywo, ASCII-waveform (`▁▂▅▇█`) i automatyczną transkrypcją (Web Speech API, jeśli przeglądarka wspiera) |

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

## Dane

Wszystko trzymane lokalnie w `localStorage` przeglądarki — bez backendu, bez konta, bez wysyłania czegokolwiek na serwer. Nagrania głosowe zapisywane są jako base64, więc przy dłuższych nagraniach limit `localStorage` (~5 MB) może się wyczerpać — aplikacja wtedy o tym poinformuje (`local: FULL`).

## Stack

- HTML + CSS (custom properties, dwa motywy) + vanilla JS
- Typografia: **JetBrains Mono** (akcenty, nagłówki, datowniki) + **Inter** (dłuższe treści)
- Ikony: inline SVG w stylu Lucide/Feather
- Audio: `MediaRecorder` + `AnalyserNode` (oscyloskop), `SpeechRecognition` (transkrypcja pl-PL)
