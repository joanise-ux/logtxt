/* ═══════════════════════════════════════════════════════════════
   log.txt — konfiguracja połączenia z backendem

   Oba pola są jawne: klucz „publishable" jest z założenia widoczny
   w przeglądarce i sam w sobie nie daje dostępu do danych — o tym,
   kto co widzi, decydują reguły RLS w bazie. Sekrety (klucz Groqa,
   hasło do bazy) nigdy tu nie trafiają.

   Klucz znajdziesz w panelu Supabase:
   Project Settings → API Keys → publishable / anon public
   ═══════════════════════════════════════════════════════════════ */

window.LOGTXT_CONFIG = {
  url: "https://jxphtmrszmcyzijvjrzc.supabase.co",
  key: "", // ← wklej tutaj klucz publishable (sb_publishable_... albo eyJ...)
};
