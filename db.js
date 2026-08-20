/* ═══════════════════════════════════════════════════════════════
   log.txt — warstwa danych (Supabase)

   Aplikacja renderuje z obiektu `state` trzymanego w pamięci, tak jak
   wcześniej. Zmienia się tylko to, co dzieje się po zmianie stanu:
   zamiast zapisu całości do localStorage robimy różnicę względem
   ostatnio zapisanej wersji i wysyłamy do bazy wyłącznie te wiersze,
   które faktycznie się zmieniły.

   Dzięki temu logika ekranów została nietknięta — dalej wołają
   saveState() po każdej zmianie.
   ═══════════════════════════════════════════════════════════════ */

window.LOGTXT = (() => {
  "use strict";

  const CFG = window.LOGTXT_CONFIG || {};
  // brak biblioteki (np. nieudane wczytanie pliku) nie może wysypać całej apki —
  // wtedy lepiej pokazać zrozumiały komunikat na ekranie logowania
  const libOk = !!(window.supabase && window.supabase.createClient);
  const configured = libOk && !!(CFG.url && CFG.key);

  const sb = configured
    ? window.supabase.createClient(CFG.url, CFG.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null;

  const BUCKET = "media";
  const SIGNED_TTL = 60 * 60 * 8; // 8 h — tyle żyje link do pliku w otwartej karcie

  let userId = null;

  /* ── mapowanie: obiekt w pamięci ⇄ wiersz w bazie ──
     `src` przy załącznikach to podpisany link tworzony przy każdym wczytaniu,
     więc do bazy nie trafia — zapisujemy samą ścieżkę w Storage. */

  const cleanAttachments = (list) =>
    (list || [])
      .filter((a) => !a.loading) // niedokończone wrzutki pomijamy
      .map((a) => ({
        id: a.id,
        type: a.type,
        path: a.path || "",
        url: a.path ? "" : a.src || "", // zdjęcie z linku zewnętrznego zostaje linkiem
        caption: a.caption || "",
        duration: a.duration || 0,
        peaks: a.peaks || [],
        transcript: a.transcript || "",
      }));

  const iso = (ts) => new Date(ts || Date.now()).toISOString();
  const ms = (s) => (s ? Date.parse(s) : Date.now());
  const dayOf = (ts) => {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  const MAP = {
    entries: {
      table: "entries",
      order: "created_at",
      toRow: (e) => ({
        id: e.id,
        user_id: userId,
        body: e.body || "",
        tags: e.tags || [],
        attachments: cleanAttachments(e.attachments),
        created_at: iso(e.ts),
      }),
      fromRow: (r) => ({
        id: r.id,
        ts: ms(r.created_at),
        body: r.body || "",
        tags: r.tags || [],
        attachments: r.attachments || [],
      }),
    },

    moods: {
      table: "moods",
      order: "day",
      toRow: (m) => ({
        id: m.id,
        user_id: userId,
        day: dayOf(m.ts),
        score: m.level,
        note: m.note || "",
        created_at: iso(m.ts),
      }),
      fromRow: (r) => ({ id: r.id, ts: ms(r.created_at), level: r.score, note: r.note || "" }),
    },

    notes: {
      table: "notes",
      order: "updated_at",
      toRow: (n) => ({
        id: n.id,
        user_id: userId,
        title: n.title || "",
        body: n.body || "",
        pinned: !!n.pinned,
        pinned_at: n.pinnedAt ? iso(n.pinnedAt) : null,
        attachments: cleanAttachments(n.attachments),
        created_at: iso(n.ts),
        updated_at: iso(n.updated),
      }),
      fromRow: (r) => ({
        id: r.id,
        ts: ms(r.created_at),
        updated: ms(r.updated_at),
        title: r.title || "",
        body: r.body || "",
        pinned: !!r.pinned,
        pinnedAt: r.pinned_at ? ms(r.pinned_at) : null,
        attachments: r.attachments || [],
      }),
    },

    tasks: {
      table: "tasks",
      order: "created_at",
      toRow: (t) => ({
        id: t.id,
        user_id: userId,
        text: t.text,
        status: t.status,
        sprint: t.sprint || "",
        created_at: iso(t.ts),
        done_at: t.status === "done" ? iso(t.doneAt || Date.now()) : null,
      }),
      fromRow: (r) => ({
        id: r.id,
        ts: ms(r.created_at),
        text: r.text,
        status: r.status,
        sprint: r.sprint || "",
        doneAt: r.done_at ? ms(r.done_at) : null,
      }),
    },

    voice: {
      table: "voice_notes",
      order: "created_at",
      toRow: (v) => ({
        id: v.id,
        user_id: userId,
        audio_path: v.path || "",
        duration: v.duration || 0,
        peaks: v.peaks || [],
        transcript: v.transcript || "",
        stt_error: v.sttError || "",
        created_at: iso(v.ts),
      }),
      fromRow: (r) => ({
        id: r.id,
        ts: ms(r.created_at),
        path: r.audio_path,
        duration: r.duration,
        peaks: r.peaks || [],
        transcript: r.transcript || "",
        sttError: r.stt_error || "",
        transcribing: false,
      }),
    },
  };

  const COLLECTIONS = Object.keys(MAP);

  /* ── silnik synchronizacji ──
     snapshot pamięta ostatni stan potwierdzony przez bazę; różnica względem
     niego mówi, co wysłać. Kolekcja, której nie udało się zapisać, nie
     aktualizuje snapshotu — więc następna próba powtórzy te same zmiany. */

  const snapshot = {}; // kolekcja → Map(id → JSON wiersza)
  let queue = Promise.resolve();
  let pendingTimer = null;
  let retryTimer = null;
  let onStatus = () => {};

  const RETRY_MS = 8000; // ponowienie po nieudanym zapisie

  function rowsOf(state, coll) {
    return (state[coll] || []).map((item) => MAP[coll].toRow(item));
  }

  async function syncCollection(state, coll) {
    const { table } = MAP[coll];
    const rows = rowsOf(state, coll);
    const next = new Map(rows.map((r) => [r.id, JSON.stringify(r)]));
    const prev = snapshot[coll] || new Map();

    const removed = [...prev.keys()].filter((id) => !next.has(id));
    const changed = rows.filter((r) => prev.get(r.id) !== next.get(r.id));
    if (!removed.length && !changed.length) return;

    // najpierw kasowanie: mood ma unikalność na (user_id, day), więc wstawienie
    // przed usunięciem starego wpisu tego samego dnia zderzyłoby się z bazą
    if (removed.length) {
      const { error } = await sb.from(table).delete().in("id", removed);
      if (error) throw error;
    }
    if (changed.length) {
      const { error } = await sb.from(table).upsert(changed);
      if (error) throw error;
    }
    snapshot[coll] = next;
  }

  async function syncNow(state) {
    if (!sb || !userId) return;
    onStatus("app.sync.pending");
    const failed = [];
    for (const coll of COLLECTIONS) {
      try {
        await syncCollection(state, coll);
      } catch (err) {
        failed.push(`${coll}: ${err.message || err}`);
      }
    }
    if (failed.length) {
      onStatus("app.sync.error", true);
      console.error("[logtxt] synchronizacja nieudana —", failed.join("; "));
      // snapshot nie ruszył się dla nieudanych kolekcji, więc ponowienie wyśle
      // dokładnie te same zmiany — inaczej wpis zostałby tylko w pamięci karty
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => scheduleSync(state), RETRY_MS);
      return false;
    }
    onStatus("app.sync.ok");
    return true;
  }

  // zmiany lecą seriami: kilka szybkich zapisów pod rząd daje jedno wysłanie
  function scheduleSync(state) {
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      queue = queue.then(() => syncNow(state)).catch(() => {});
    }, 400);
  }

  /* ── wczytanie wszystkiego po zalogowaniu ── */
  async function loadAll() {
    const state = { entries: [], moods: [], notes: [], tasks: [], voice: [] };
    if (!sb || !userId) return state;

    for (const coll of COLLECTIONS) {
      const { table, order } = MAP[coll];
      const { data, error } = await sb.from(table).select("*").order(order, { ascending: false });
      if (error) throw new Error(`nie udało się wczytać ${coll}: ${error.message}`);
      state[coll] = (data || []).map(MAP[coll].fromRow);
      // snapshot budujemy z tego, co właśnie przyszło — w tej samej postaci,
      // w jakiej byśmy to wysłali, żeby różnica startowała od zera
      snapshot[coll] = new Map(state[coll].map((i) => [i.id, JSON.stringify(MAP[coll].toRow(i))]));
    }

    await signMediaIn(state);
    return state;
  }

  /* ── pliki w Storage ── */
  async function uploadMedia(blob, kind, ext) {
    if (!sb || !userId) throw new Error("brak połączenia z kontem");
    const path = `${userId}/${kind}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type || undefined, upsert: false });
    if (error) throw new Error(`nie udało się wysłać pliku: ${error.message}`);
    return path;
  }

  async function signPaths(paths) {
    const out = {};
    if (!paths.length) return out;
    // Storage przyjmuje ograniczoną liczbę ścieżek naraz
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(chunk, SIGNED_TTL);
      if (error) continue; // brak podglądu jest mniej dotkliwy niż brak wpisu
      for (const row of data || []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
    }
    return out;
  }

  // uzupełnia `src` (link do odtworzenia/pokazania) na podstawie zapisanych ścieżek
  async function signMediaIn(state) {
    const paths = new Set();
    for (const v of state.voice) if (v.path) paths.add(v.path);
    for (const coll of ["entries", "notes"]) {
      for (const item of state[coll]) {
        for (const a of item.attachments || []) if (a.path) paths.add(a.path);
      }
    }
    const urls = await signPaths([...paths]);
    for (const v of state.voice) v.src = urls[v.path] || "";
    for (const coll of ["entries", "notes"]) {
      for (const item of state[coll]) {
        for (const a of item.attachments || []) a.src = a.path ? urls[a.path] || "" : a.url || "";
      }
    }
  }

  async function removeMedia(paths) {
    const list = (paths || []).filter(Boolean);
    if (!sb || !list.length) return;
    await sb.storage.from(BUCKET).remove(list);
  }

  /* ── transkrypcja przez Edge Function (klucz siedzi na serwerze) ── */
  async function transcribe(blob) {
    if (!sb) throw new Error("brak połączenia z kontem");
    const ext = (blob.type.split("/")[1] || "webm").split(";")[0];
    const fd = new FormData();
    fd.append("file", new File([blob], `memo.${ext}`, { type: blob.type || "audio/webm" }));

    const { data, error } = await sb.functions.invoke("transcribe", { body: fd });
    if (error) {
      // treść błędu z funkcji siedzi w odpowiedzi, nie w komunikacie wyjątku
      let detail = "";
      try { detail = (await error.context?.json())?.error || ""; } catch { /* nie-JSON */ }
      throw new Error(detail || "transkrypcja nieudana — spróbuj ponownie");
    }
    if (data && data.error) throw new Error(data.error);
    return String((data && data.text) || "").trim();
  }

  /* ── konta ── */
  const auth = {
    async current() {
      if (!sb) return null;
      const { data } = await sb.auth.getSession();
      const user = data.session?.user || null;
      userId = user?.id || null;
      return user;
    },

    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(authError(error));
      userId = data.user.id;
      return data.user;
    },

    // przy włączonym potwierdzaniu maila Supabase nie zwraca sesji — wtedy
    // mówimy o tym wprost zamiast udawać, że konto już działa
    async signUp(email, password, name) {
      const { data, error } = await sb.auth.signUp({
        email, password, options: { data: { name } },
      });
      if (error) throw new Error(authError(error));
      if (!data.session) return { needsConfirmation: true };
      userId = data.user.id;
      return { user: data.user };
    },

    async signOut() {
      userId = null;
      for (const coll of COLLECTIONS) delete snapshot[coll];
      if (sb) await sb.auth.signOut();
    },

    name(user) {
      return user?.user_metadata?.name || (user?.email || "").split("@")[0] || "guest";
    },
  };

  function authError(error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("invalid login")) return "nieprawidłowy email lub hasło";
    if (msg.includes("email not confirmed")) return "konto niepotwierdzone — sprawdź skrzynkę";
    if (msg.includes("already registered")) return "konto z tym adresem już istnieje";
    if (msg.includes("password")) return "hasło musi mieć min. 8 znaków";
    if (msg.includes("rate limit") || msg.includes("too many")) return "za dużo prób — odczekaj chwilę";
    if (msg.includes("fetch")) return "brak połączenia z serwerem";
    return error.message || "nie udało się zalogować";
  }

  return {
    configured,
    auth,
    loadAll,
    scheduleSync,
    syncNow,
    uploadMedia,
    removeMedia,
    signMediaIn,
    transcribe,
    onStatus: (fn) => { onStatus = fn; },
  };
})();
