/*
 * background.js — intercetta l'apertura delle pagine dei negozi Amazon e, se è una pagina prodotto,
 * la sostituisce con la versione pulita (/dp/ASIN?tag=...) prima ancora che parta la richiesta:
 * una sola richiesta di rete, nessun lampeggio. cleaner.js è caricato prima (vedi manifest).
 */

let currentTags = resolveTags({});

// I tag arrivano dalle opzioni. La promessa serve a non rispondere alle prime richieste
// all'avvio del browser prima di aver letto i tag salvati.
function loadTags() {
  return browser.storage.sync
    .get(["tags", "tag"])
    .then((stored) => {
      currentTags = resolveTags(stored);
    })
    .catch(() => {
      currentTags = resolveTags({});
    });
}
const tagsReady = loadTags();

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.tags || changes.tag)) {
    loadTags();
  }
});

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    // Solo GET: un POST (per esempio "Aggiungi al carrello") trasformato in GET si romperebbe.
    if (details.method !== "GET") {
      return {};
    }
    await tagsReady;
    const redirectUrl = getRedirectUrl(details.url, currentTags);
    return redirectUrl ? { redirectUrl } : {};
  },
  { urls: AMAZON_HOSTS.map((host) => `*://${host}/*`), types: ["main_frame"] },
  ["blocking"]
);
