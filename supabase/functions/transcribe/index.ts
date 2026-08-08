// log.txt — transkrypcja nagrań głosowych
//
// Klucz Groqa leży w sekretach projektu (GROQ_API_KEY) i nigdy nie trafia do
// przeglądarki — użytkownik niczego nie konfiguruje. Funkcja wymaga ważnego JWT
// (verify_jwt), więc transkrybować może tylko zalogowana osoba.
//
// Wejście:  multipart/form-data, pole `file` (audio) + opcjonalnie `model`
// Wyjście:  { text: "..." } albo { error: "komunikat po polsku" }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODELS = ["whisper-large-v3-turbo", "whisper-large-v3"];
const MAX_BYTES = 25 * 1024 * 1024; // limit pliku po stronie Groq
const LANG = "pl";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// komunikaty lecą prosto do UI, więc po polsku i bez żargonu
function groqError(status: number, detail: string) {
  if (status === 401 || status === 403) return "klucz API serwera odrzucony — sprawdź GROQ_API_KEY";
  if (status === 413) return "nagranie za duże dla API (limit 25 MB)";
  if (status === 429) return "limit transkrypcji wyczerpany — spróbuj za chwilę";
  if (status >= 500) return "błąd po stronie Groq — spróbuj ponownie";
  return detail ? `${status}: ${detail}` : `błąd API (${status})`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "tylko POST" }, 405);

  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return json({ error: "serwer nie ma skonfigurowanego klucza transkrypcji" }, 500);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "oczekiwano multipart/form-data z polem `file`" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "brak pliku audio" }, 400);
  if (file.size === 0) return json({ error: "puste nagranie" }, 400);
  if (file.size > MAX_BYTES) return json({ error: "nagranie za duże dla API (limit 25 MB)" }, 413);

  const requested = String(form.get("model") || "");
  const model = MODELS.includes(requested) ? requested : MODELS[0];

  const out = new FormData();
  out.append("file", file, file.name || "memo.webm");
  out.append("model", model);
  out.append("language", LANG);
  out.append("response_format", "json");
  out.append("temperature", "0");

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: out,
    });
  } catch {
    return json({ error: "brak połączenia z api.groq.com" }, 502);
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message ?? "";
    } catch { /* nie-JSON */ }
    // 4xx od Groqa nie jest błędem żądania klienta — zwracamy 502 z opisem
    return json({ error: groqError(res.status, detail) }, res.status === 429 ? 429 : 502);
  }

  const data = await res.json();
  return json({ text: String(data.text ?? "").trim(), model });
});
