/*
 * background.js — intercetta l'apertura delle pagine amazon.it e, se è una pagina prodotto,
 * la sostituisce con la versione pulita (/dp/ASIN?tag=...) prima ancora che parta la richiesta:
 * una sola richiesta di rete, nessun lampeggio. cleaner.js è caricato prima (vedi manifest).
 */

let currentTag = DEFAULT_TAG;

// Il tag arriva dalle opzioni. La promessa serve a non rispondere alle prime richieste
// all'avvio del browser prima di aver letto il tag salvato.
const tagReady = browser.storage.sync
  .get("tag")
  .then((stored) => {
    currentTag = normalizeTag(stored.tag);
  })
  .catch(() => {
    currentTag = DEFAULT_TAG;
  });

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.tag) {
    currentTag = normalizeTag(changes.tag.newValue);
  }
});

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    // Solo GET: un POST (per esempio "Aggiungi al carrello") trasformato in GET si romperebbe.
    if (details.method !== "GET") {
      return {};
    }
    await tagReady;
    const redirectUrl = getRedirectUrl(details.url, currentTag);
    return redirectUrl ? { redirectUrl } : {};
  },
  { urls: ["*://www.amazon.it/*", "*://amazon.it/*"], types: ["main_frame"] },
  ["blocking"]
);
