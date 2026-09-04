/* ═══════════════════════════════════════════════════════════════
   log.txt — tłumaczenia (pl / en)

   Preferencja języka ma trzy stany: "auto" (za ustawieniem przeglądarki
   lub systemu), "pl", "en". Wybór trzymamy lokalnie, tak jak motyw.

   Teksty w HTML oznaczamy atrybutami:
     data-i18n        → textContent
     data-i18n-html   → innerHTML (gdy w środku są znaczniki)
     data-i18n-ph     → placeholder
     data-i18n-title  → title
     data-i18n-aria   → aria-label
   ═══════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  const LANG_KEY = "logtxt.lang";
  const SUPPORTED = ["pl", "en"];

  const STRINGS = {
    pl: {
      /* ── auth ── */
      "auth.logo.comment": "// dziennik myśli",
      "auth.login.sub": "// zaloguj się, żeby wejść do swojego dziennika",
      "auth.field.email": "email:",
      "auth.field.password": "hasło:",
      "auth.field.name": "imię:",
      "auth.field.repeat": "powtórz:",
      "auth.ph.name": "jak masz na imię?_",
      "auth.ph.password.min": "min. 8 znaków_",
      "auth.ph.password.again": "jeszcze raz_",
      "auth.login.cta": "zaloguj",
      "auth.login.switch": "nie masz konta?",
      "auth.login.switchLink": "utwórz →",
      "auth.register.sub": "// załóż konto — wpisy będą dostępne z każdego urządzenia",
      "auth.register.cta": "utwórz konto",
      "auth.register.switch": "masz już konto?",
      "auth.register.switchLink": "zaloguj →",
      "auth.err.email": "// błąd: niepoprawny adres email",
      "auth.err.password": "// błąd: wpisz hasło",
      "auth.err.name": "// błąd: podaj imię",
      "auth.err.passwordShort": "// błąd: hasło musi mieć min. 8 znaków",
      "auth.err.passwordMismatch": "// błąd: hasła się nie zgadzają",
      "auth.connecting": "// łączenie...",
      "auth.registering": "// zakładam konto...",
      "auth.confirmMail": "// konto założone — potwierdź adres linkiem z maila, potem zaloguj się",
      "auth.loggedIn": "✓ zalogowano jako {name}",
      "auth.accountCreated": "✓ konto utworzone — witaj, {name}",
      "auth.err.generic": "// błąd: {msg}",
      "auth.err.noKey": "// błąd: brak klucza do backendu — uzupełnij config.js",
      "auth.err.noClient": "// błąd: nie wczytał się klient bazy — odśwież stronę",

      /* ── szkielet aplikacji ── */
      "app.logo.comment": "// dziennik",
      "app.aria.home": "Wróć do dashboardu",
      "app.aria.sections": "Sekcje",
      "app.aria.theme": "Przełącz motyw",
      "app.aria.lang": "Zmień język",
      "app.aria.menu": "Menu",
      "app.aria.bottomNav": "Nawigacja mobilna",
      "app.aria.moreSections": "Więcej sekcji",
      "app.aria.quickActions": "Szybkie akcje",
      "app.logout": "Wyloguj się",
      "app.more": "więcej",
      "app.theme": "motyw",
      "app.crumbRoot": "~/dziennik/",
      "app.sync.dash": "sync: —",
      "app.sync.error": "sync: błąd",
      "app.sync.loading": "sync: wczytywanie...",
      "app.sync.ok": "sync: ok",
      "app.sync.pending": "sync: ...",
      "app.sync.retry": "⚠ nie udało się zapisać — ponawiam",
      "app.sync.retryOk": "✓ zapisano po ponowieniu",
      "app.undo.deleted": "usunięto",
      "app.undo.btn": "[cofnij]",
      "app.undo.restored": "↩ przywrócono ✓ restore complete",
      "app.saved": "Zapisano ✓ commit successful",

      /* ── motyw / język ── */
      "theme.auto": "auto_mode",
      "theme.light": "light_mode",
      "theme.dark": "dark_mode",
      "theme.titleAuto": "motyw: auto (systemowy → {theme}) — kliknij, aby wybrać {next}",
      "theme.title": "motyw: {mode} — kliknij, aby wybrać {next}",
      "lang.auto": "lang: auto",
      "lang.pl": "lang: pl",
      "lang.en": "lang: en",
      "lang.titleAuto": "język: auto (z przeglądarki → {lang}) — kliknij, aby wybrać {next}",
      "lang.title": "język: {lang} — kliknij, aby wybrać {next}",
      "lang.short": "język",

      /* ── dashboard ── */
      "dash.hello.night": "nocna sesja",
      "dash.hello.morning": "dzień dobry",
      "dash.hello.day": "witaj z powrotem",
      "dash.hello.evening": "dobry wieczór",
      "dash.helloLine": "// jest {time}, {weekday} · streak: {streak} {dayWord} 🔥 · commits_today: {today}",
      "dash.dayOne": "dzień",
      "dash.dayMany": "dni",
      "num.decimal": ",",
      "dash.summary": "// tydzień → wpisy: {entries} · nastrój: {mood} · aktywne dni: {days}/7 · zadania w toku: {open}",
      "dash.motto.label": "// motto dnia",
      "dash.motto.1": "małe kroki każdego dnia prowadzą do dużych zmian",
      "dash.motto.2": "zadbaj o swój spokój",
      "dash.motto.3": "dobre rzeczy potrzebują czasu",
      "dash.motto.4": "napisz to, zanim zniknie",
      "dash.motto.5": "jeden commit dziennie wystarczy",
      "dash.motto.6": "wolniej to też kierunek",
      "dash.qa.entry": "nowy wpis",
      "dash.qa.mood": "zaznacz nastrój",
      "dash.mood.open": "otwórz mood.log →",
      "dash.mood.today": "// dziś: {level}/5 — kliknij, żeby zmienić",
      "dash.mood.none": "// zaznacz, jak dziś jest",
      "dash.qa.task": "nowe zadanie",
      "dash.qa.voice": "nagraj notatkę",
      "dash.pinned.all": "zobacz wszystkie →",
      "dash.tasks.all": "zobacz wszystkie zadania →",
      "dash.more": "+{n} więcej →",
      "dash.empty.pinned": "// brak przypiętych notatek — przypnij coś ważnego",
      "dash.empty.tasksDone": "// wszystko zrobione ✓",
      "dash.empty.tasks": "// brak zadań — dodaj pierwsze",
      "dash.empty.activity": "// brak aktywności — zacznij od pierwszego commita",
      "dash.tile.lastEntry": "ostatni: „{text}”",
      "dash.tile.thisWeek": "w tym tygodniu",
      "dash.tile.fileOne": "plik",
      "dash.tile.fileMany": "plików",
      "dash.tile.recOne": "nagranie",
      "dash.tile.recMany": "nagrań",
      "dash.tile.noTrend": "// brak trendu",
      "dash.tile.lastVoice": "ostatnie: {time}",
      "dash.tile.silence": "// cisza w eterze",
      "dash.mood.item": "nastrój {level}/5",

      /* ── entries ── */
      "entries.sub": "// twoje wpisy — każdy jak osobny plik",
      "entries.newEntry": "nowy wpis →",
      "entries.newBtn": "+ nowy wpis",
      "entries.back": "Wróć do formularza nowego wpisu",
      "entries.backLabel": "lista",
      "entries.pickHint": "// wybierz wpis z listy obok albo zacznij nowy",
      "entries.file.noText": "// bez tekstu",
      "entries.file.voice": "nagranie {time}",
      "entries.day.today": "dziś",
      "entries.day.yesterday": "wczoraj",
      "entries.ph.body": "$ napisz coś...",
      "entries.ph.tags": "#refleksja #praca #pomysł",
      "entries.submit": "git commit",
      "entries.empty": "// brak wpisów{tag} — dodaj pierwszy log",
      "entries.empty.today": " dzisiaj",
      "entries.empty.tag": " z tagiem {tag}",
      "entries.moodBadge": "mood {level}/5 — nastrój z dnia wpisu",
      "entries.edit.title": "Edytuj wpis",
      "entries.edit.flag": "// tryb edycji",
      "entries.edit.save": "git commit --amend",
      "entries.edit.cancel": "anuluj",
      "entries.edit.saved": "Zapisano ✓ wpis zaktualizowany",
      "entries.edit.empty": "// wpis nie może być pusty",
      "entries.edit.busy": "// poczekaj — trwa wysyłka załącznika",

      /* ── mood ── */
      "mood.sub": "// jak się dziś czujesz? zapisz stan procesu",
      "mood.aria.scale": "Poziom nastroju",
      "mood.level.1": "Bardzo źle",
      "mood.level.2": "Słabo",
      "mood.level.3": "Neutralnie",
      "mood.level.4": "Dobrze",
      "mood.level.5": "Świetnie",
      "mood.ph.note": "// krótki kontekst, opcjonalnie",
      "mood.submit": "log mood",
      "mood.aria.range": "Zakres grafu",
      "mood.rangeLabel": "// ostatnie {days} dni",
      "mood.worse": "gorzej",
      "mood.better": "lepiej",
      "mood.saved": "Zapisano ✓ mood logged",
      "mood.updated": "Zaktualizowano ✓ mood updated",
      "mood.empty": "// brak logów nastroju — zapisz pierwszy stan",
      "mood.dayTitle": "{date} · nastrój {level}/5",
      "mood.dow": "pn,wt,śr,cz,pt,sb,nd",

      /* ── notes ── */
      "notes.sub": "// luźne notatki, markdown-friendly",
      "notes.new": "+ touch nowa.md",
      "notes.ph.title": "nazwa_notatki",
      "notes.ph.body": "# nagłówek\n\n**pogrubienie**, *kursywa*, `kod`\n\n- lista\n- [ ] checkbox",
      "notes.md.heading": "Nagłówek",
      "notes.md.bold": "Pogrubienie (Ctrl+B)",
      "notes.md.italic": "Kursywa (Ctrl+I)",
      "notes.md.code": "Kod",
      "notes.md.list": "Lista",
      "notes.md.check": "Checkbox",
      "notes.md.quote": "Cytat",
      "notes.md.codeLabel": "`kod`",
      "notes.md.listLabel": "- lista",
      "notes.save": ":w zapisz",
      "notes.pin": "// pin",
      "notes.unpin": "// unpin",
      "notes.pinned": "📌 przypięto ✓",
      "notes.unpinned": "// odpięto",
      "notes.pinTitle": "Przypnij do dashboardu",
      "notes.unpinTitle": "Odepnij",
      "notes.untitled": "bez_nazwy",
      "notes.newName": "nowa",
      "notes.empty": "// pusto — utwórz plik",
      "notes.emptyFile": "// pusty plik",

      /* ── tasks ── */
      "tasks.sub": "// zadania posegregowane wg statusu: in_progress → pending → done",
      "tasks.ph.text": "$ nowe zadanie...",
      "tasks.ph.sprint": "sprint",
      "tasks.add": "add",
      "tasks.added": "Zapisano ✓ task added → pending",
      "tasks.done": "✓ done — dobra robota",
      "tasks.empty": "// brak zadań — backlog czysty",
      "tasks.nextStatus": "Następny status",
      "tasks.changeStatus": "Zmień status",

      /* ── voice ── */
      "voice.sub": "// notatki głosowe — każde nagranie zapisuje się jako wpis w entries/",
      "voice.ready": "// gotowy",
      "voice.record": "record",
      "voice.saved": "Zapisano ✓ voice memo committed",
      "voice.empty": "// brak nagrań — naciśnij record i powiedz, co myślisz",
      "voice.openEntry": "→ wpis",
      "voice.transcribe": "transkrybuj",
      "voice.transcribeAgain": "transkrybuj ponownie",
      "voice.transcriptReady": "Transkrypcja gotowa ✓",
      "voice.noSpeech": "Nie rozpoznano mowy",
      "voice.toggleTranscript": "Pokaż całość / zwiń",
      "voice.autoStt": "// auto-transkrypcja: on",
      "voice.err.mic": "// błąd: brak dostępu do mikrofonu",

      /* ── media ── */
      "media.addPhoto": "dodaj zdjęcie",
      "media.fromUrl": "z URL",
      "media.record": "nagraj",
      "media.delete": "Usuń",
      "media.uploading": "przesyłanie zdjęcia...",
      "media.downloading": "pobieranie z URL...",
      "media.ph.caption": "// caption (opcjonalnie)",
      "media.audio": "// audio",
      "media.transcribing": "// transkrypcja w toku",
      "media.promptUrl": "Wklej link do zdjęcia (jpg/png/webp):",
      "media.err.notImage": "// błąd: to nie jest obraz",
      "media.err.generic": "// błąd: {msg}",
      "media.done": "// gotowe",
      "media.open": "Otwórz zdjęcie na cały ekran",
      "media.close": "Zamknij podgląd",
      "media.prev": "Poprzednie zdjęcie",
      "media.next": "Następne zdjęcie",
      "media.aria.viewer": "Podgląd zdjęcia",

      /* ── import starych danych ── */
      "import.prompt": "Znaleziono lokalny dziennik z tej przeglądarki: {total} wpisów ({entries} entries, {moods} mood, {notes} notatek, {tasks} zadań).\n\nPrzenieść je na konto? Nagrania głosowe nie zostaną przeniesione.",
      "import.ok": "✓ przeniesiono {total} wpisów",
      "import.partial": "⚠ część wpisów się nie zapisała",

      /* ── daty ── */
      "date.weekdaysShort": "nd,pon,wt,śr,czw,pt,sob",
      "date.weekdays": "niedziela,poniedziałek,wtorek,środa,czwartek,piątek,sobota",
    },

    en: {
      /* ── auth ── */
      "auth.logo.comment": "// journal of thoughts",
      "auth.login.sub": "// sign in to open your journal",
      "auth.field.email": "email:",
      "auth.field.password": "password:",
      "auth.field.name": "name:",
      "auth.field.repeat": "repeat:",
      "auth.ph.name": "what's your name?_",
      "auth.ph.password.min": "min. 8 characters_",
      "auth.ph.password.again": "one more time_",
      "auth.login.cta": "sign in",
      "auth.login.switch": "no account yet?",
      "auth.login.switchLink": "create →",
      "auth.register.sub": "// create an account — your entries follow you across devices",
      "auth.register.cta": "create account",
      "auth.register.switch": "already have an account?",
      "auth.register.switchLink": "sign in →",
      "auth.err.email": "// error: invalid email address",
      "auth.err.password": "// error: enter a password",
      "auth.err.name": "// error: enter your name",
      "auth.err.passwordShort": "// error: password must be at least 8 characters",
      "auth.err.passwordMismatch": "// error: passwords do not match",
      "auth.connecting": "// connecting...",
      "auth.registering": "// creating account...",
      "auth.confirmMail": "// account created — confirm the address with the link in your inbox, then sign in",
      "auth.loggedIn": "✓ signed in as {name}",
      "auth.accountCreated": "✓ account created — welcome, {name}",
      "auth.err.generic": "// error: {msg}",
      "auth.err.noKey": "// error: backend key missing — fill in config.js",
      "auth.err.noClient": "// error: database client failed to load — refresh the page",

      /* ── szkielet aplikacji ── */
      "app.logo.comment": "// journal",
      "app.aria.home": "Back to dashboard",
      "app.aria.sections": "Sections",
      "app.aria.theme": "Switch theme",
      "app.aria.lang": "Change language",
      "app.aria.menu": "Menu",
      "app.aria.bottomNav": "Mobile navigation",
      "app.aria.moreSections": "More sections",
      "app.aria.quickActions": "Quick actions",
      "app.logout": "Sign out",
      "app.more": "more",
      "app.theme": "theme",
      "app.crumbRoot": "~/journal/",
      "app.sync.dash": "sync: —",
      "app.sync.error": "sync: error",
      "app.sync.loading": "sync: loading...",
      "app.sync.ok": "sync: ok",
      "app.sync.pending": "sync: ...",
      "app.sync.retry": "⚠ could not save — retrying",
      "app.sync.retryOk": "✓ saved after retry",
      "app.undo.deleted": "deleted",
      "app.undo.btn": "[undo]",
      "app.undo.restored": "↩ restored ✓ restore complete",
      "app.saved": "Saved ✓ commit successful",

      /* ── motyw / język ── */
      "theme.auto": "auto_mode",
      "theme.light": "light_mode",
      "theme.dark": "dark_mode",
      "theme.titleAuto": "theme: auto (system → {theme}) — click to pick {next}",
      "theme.title": "theme: {mode} — click to pick {next}",
      "lang.auto": "lang: auto",
      "lang.pl": "lang: pl",
      "lang.en": "lang: en",
      "lang.titleAuto": "language: auto (from browser → {lang}) — click to pick {next}",
      "lang.title": "language: {lang} — click to pick {next}",
      "lang.short": "language",

      /* ── dashboard ── */
      "dash.hello.night": "night session",
      "dash.hello.morning": "good morning",
      "dash.hello.day": "welcome back",
      "dash.hello.evening": "good evening",
      "dash.helloLine": "// it's {time}, {weekday} · streak: {streak} {dayWord} 🔥 · commits_today: {today}",
      "dash.dayOne": "day",
      "dash.dayMany": "days",
      "num.decimal": ".",
      "dash.summary": "// this week → entries: {entries} · mood: {mood} · active days: {days}/7 · open tasks: {open}",
      "dash.motto.label": "// motto of the day",
      "dash.motto.1": "small steps everyday lead to big changes",
      "dash.motto.2": "take care of your peace",
      "dash.motto.3": "good things take time",
      "dash.motto.4": "write it down before it fades",
      "dash.motto.5": "one commit a day is enough",
      "dash.motto.6": "slower is a direction too",
      "dash.qa.entry": "new entry",
      "dash.qa.mood": "log mood",
      "dash.mood.open": "open mood.log →",
      "dash.mood.today": "// today: {level}/5 — tap to change",
      "dash.mood.none": "// mark how today feels",
      "dash.qa.task": "new task",
      "dash.qa.voice": "record a memo",
      "dash.pinned.all": "see all →",
      "dash.tasks.all": "see all tasks →",
      "dash.more": "+{n} more →",
      "dash.empty.pinned": "// nothing pinned — pin something important",
      "dash.empty.tasksDone": "// all done ✓",
      "dash.empty.tasks": "// no tasks — add the first one",
      "dash.empty.activity": "// no activity — start with your first commit",
      "dash.tile.lastEntry": "last: “{text}”",
      "dash.tile.thisWeek": "this week",
      "dash.tile.fileOne": "file",
      "dash.tile.fileMany": "files",
      "dash.tile.recOne": "recording",
      "dash.tile.recMany": "recordings",
      "dash.tile.noTrend": "// no trend yet",
      "dash.tile.lastVoice": "last: {time}",
      "dash.tile.silence": "// silence on the air",
      "dash.mood.item": "mood {level}/5",

      /* ── entries ── */
      "entries.sub": "// your entries — each one its own file",
      "entries.newEntry": "new entry →",
      "entries.newBtn": "+ new entry",
      "entries.back": "Back to the new entry form",
      "entries.backLabel": "list",
      "entries.pickHint": "// pick an entry from the list, or start a new one",
      "entries.file.noText": "// no text",
      "entries.file.voice": "recording {time}",
      "entries.day.today": "today",
      "entries.day.yesterday": "yesterday",
      "entries.ph.body": "$ write something...",
      "entries.ph.tags": "#reflection #work #idea",
      "entries.submit": "git commit",
      "entries.empty": "// no entries{tag} — add your first log",
      "entries.empty.today": " today",
      "entries.empty.tag": " tagged {tag}",
      "entries.moodBadge": "mood {level}/5 — mood on the entry's day",
      "entries.edit.title": "Edit entry",
      "entries.edit.flag": "// edit mode",
      "entries.edit.save": "git commit --amend",
      "entries.edit.cancel": "cancel",
      "entries.edit.saved": "Saved ✓ entry updated",
      "entries.edit.empty": "// an entry can't be empty",
      "entries.edit.busy": "// hold on — an attachment is still uploading",

      /* ── mood ── */
      "mood.sub": "// how do you feel today? log the process state",
      "mood.aria.scale": "Mood level",
      "mood.level.1": "Very bad",
      "mood.level.2": "Poor",
      "mood.level.3": "Neutral",
      "mood.level.4": "Good",
      "mood.level.5": "Great",
      "mood.ph.note": "// short context, optional",
      "mood.submit": "log mood",
      "mood.aria.range": "Graph range",
      "mood.rangeLabel": "// last {days} days",
      "mood.worse": "worse",
      "mood.better": "better",
      "mood.saved": "Saved ✓ mood logged",
      "mood.updated": "Updated ✓ mood updated",
      "mood.empty": "// no mood logs — record your first state",
      "mood.dayTitle": "{date} · mood {level}/5",
      "mood.dow": "mo,tu,we,th,fr,sa,su",

      /* ── notes ── */
      "notes.sub": "// loose notes, markdown-friendly",
      "notes.new": "+ touch new.md",
      "notes.ph.title": "note_name",
      "notes.ph.body": "# heading\n\n**bold**, *italic*, `code`\n\n- list\n- [ ] checkbox",
      "notes.md.heading": "Heading",
      "notes.md.bold": "Bold (Ctrl+B)",
      "notes.md.italic": "Italic (Ctrl+I)",
      "notes.md.code": "Code",
      "notes.md.list": "List",
      "notes.md.check": "Checkbox",
      "notes.md.quote": "Quote",
      "notes.md.codeLabel": "`code`",
      "notes.md.listLabel": "- list",
      "notes.save": ":w save",
      "notes.pin": "// pin",
      "notes.unpin": "// unpin",
      "notes.pinned": "📌 pinned ✓",
      "notes.unpinned": "// unpinned",
      "notes.pinTitle": "Pin to dashboard",
      "notes.unpinTitle": "Unpin",
      "notes.untitled": "untitled",
      "notes.newName": "new",
      "notes.empty": "// empty — create a file",
      "notes.emptyFile": "// empty file",

      /* ── tasks ── */
      "tasks.sub": "// tasks grouped by status: in_progress → pending → done",
      "tasks.ph.text": "$ new task...",
      "tasks.ph.sprint": "sprint",
      "tasks.add": "add",
      "tasks.added": "Saved ✓ task added → pending",
      "tasks.done": "✓ done — nice work",
      "tasks.empty": "// no tasks — backlog is clean",
      "tasks.nextStatus": "Next status",
      "tasks.changeStatus": "Change status",

      /* ── voice ── */
      "voice.sub": "// voice memos — every recording is saved as an entry in entries/",
      "voice.ready": "// ready",
      "voice.record": "record",
      "voice.saved": "Saved ✓ voice memo committed",
      "voice.empty": "// no recordings — hit record and say what's on your mind",
      "voice.openEntry": "→ entry",
      "voice.transcribe": "transcribe",
      "voice.transcribeAgain": "transcribe again",
      "voice.transcriptReady": "Transcript ready ✓",
      "voice.noSpeech": "No speech recognized",
      "voice.toggleTranscript": "Show all / collapse",
      "voice.autoStt": "// auto-transcription: on",
      "voice.err.mic": "// error: no microphone access",

      /* ── media ── */
      "media.addPhoto": "add photo",
      "media.fromUrl": "from URL",
      "media.record": "record",
      "media.delete": "Delete",
      "media.uploading": "uploading photo...",
      "media.downloading": "downloading from URL...",
      "media.ph.caption": "// caption (optional)",
      "media.audio": "// audio",
      "media.transcribing": "// transcription in progress",
      "media.promptUrl": "Paste a link to the image (jpg/png/webp):",
      "media.err.notImage": "// error: that is not an image",
      "media.err.generic": "// error: {msg}",
      "media.done": "// done",
      "media.open": "Open the photo full screen",
      "media.close": "Close the viewer",
      "media.prev": "Previous photo",
      "media.next": "Next photo",
      "media.aria.viewer": "Photo viewer",

      /* ── import starych danych ── */
      "import.prompt": "Found a local journal from this browser: {total} records ({entries} entries, {moods} mood, {notes} notes, {tasks} tasks).\n\nMove them to your account? Voice recordings will not be moved.",
      "import.ok": "✓ moved {total} records",
      "import.partial": "⚠ some records were not saved",

      /* ── daty ── */
      "date.weekdaysShort": "sun,mon,tue,wed,thu,fri,sat",
      "date.weekdays": "sunday,monday,tuesday,wednesday,thursday,friday,saturday",
    },
  };

  function detect() {
    const list = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || "en"];
    for (const tag of list) {
      const code = String(tag).toLowerCase().split("-")[0];
      if (SUPPORTED.includes(code)) return code;
    }
    return "en";
  }

  let pref = "auto";
  let lang = "en";
  const listeners = [];

  function t(key, vars) {
    const dict = STRINGS[lang] || STRINGS.en;
    let s = dict[key];
    if (s === undefined) s = STRINGS.en[key];
    if (s === undefined) return key;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (all, name) => (name in vars ? String(vars[name]) : all));
  }

  function applyDom(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAria));
    });
  }

  function setPref(next) {
    pref = SUPPORTED.includes(next) || next === "auto" ? next : "auto";
    lang = pref === "auto" ? detect() : pref;
    localStorage.setItem(LANG_KEY, pref);
    document.documentElement.lang = lang;
    document.documentElement.dataset.langPref = pref;
    applyDom();
    listeners.forEach((fn) => fn(lang, pref));
  }

  window.I18N = {
    SUPPORTED,
    t,
    applyDom,
    setPref,
    get lang() { return lang; },
    get pref() { return pref; },
    // kolejność klikania przełącznika: auto → pl → en → auto
    next() { return pref === "auto" ? "pl" : pref === "pl" ? "en" : "auto"; },
    onChange(fn) { listeners.push(fn); },
    // formatowanie liczb/dat zgodne z wybranym językiem
    locale() { return lang === "pl" ? "pl-PL" : "en-GB"; },
  };

  // ustawiamy język przed pierwszym renderem, żeby nie mrugało polskim tekstem
  pref = localStorage.getItem(LANG_KEY) || "auto";
  lang = pref === "auto" ? detect() : (SUPPORTED.includes(pref) ? pref : detect());
  document.documentElement.lang = lang;
  document.documentElement.dataset.langPref = pref;
  // skrypt ładuje się na końcu body — DOM jest już gotowy, więc tłumaczymy od razu
  if (document.body) applyDom();
  else document.addEventListener("DOMContentLoaded", () => applyDom());
})();
