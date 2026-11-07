/*
 * cleaner.js — logica pura per ripulire i link prodotto di amazon.it.
 * Non usa nessuna API del browser: così si prova anche con Node (vedi test/).
 * Viene caricato come script normale dal background e dalla pagina delle opzioni.
 */

// Tag affiliato usato quando non ne è stato scelto uno (o quello salvato non è valido).
const DEFAULT_TAG = "piattaforma-21";

// Il tag è fatto solo di lettere, numeri, trattino, punto e trattino basso.
// Questa regola evita anche di mettere nell'URL caratteri che il browser potrebbe riscrivere.
const TAG_PATTERN = /^[A-Za-z0-9_.-]{3,64}$/;

// Siti su cui agisce l'addon: devono coincidere con i permessi del manifest.
const AMAZON_HOSTS = ["www.amazon.it", "amazon.it"];

// Percorsi di pagina prodotto: un segmento noto seguito dall'ASIN (10 caratteri tra lettere e numeri).
// Dopo l'ASIN deve esserci una fine percorso, "/", "?", "#" oppure "&" (quest'ultimo per i link
// scritti male tipo /dp/ASIN&tag=...).
const ASIN_PATTERN = /\/(?:dp|gp\/product|gp\/aw\/d|product|exec\/obidos\/ASIN|o\/ASIN|ASIN)\/([A-Z0-9]{10})(?=[/?#&]|$)/i;

/**
 * Restituisce un tag valido: quello dato, ripulito dagli spazi, oppure DEFAULT_TAG.
 * Non ripiega mai sul tag di qualcun altro.
 */
function normalizeTag(value) {
  const tag = String(value ?? "").trim();
  return TAG_PATTERN.test(tag) ? tag : DEFAULT_TAG;
}

/**
 * Dato un URL di una pagina prodotto di amazon.it restituisce la sua forma pulita
 * https://<host>/dp/<ASIN>?tag=<tag>. Per qualsiasi altra pagina o sito restituisce null.
 */
function cleanProductUrl(rawUrl, tag = DEFAULT_TAG) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!AMAZON_HOSTS.includes(url.hostname)) {
    return null;
  }
  const match = ASIN_PATTERN.exec(url.pathname);
  if (!match) {
    return null;
  }
  const clean = new URL(`https://${url.hostname}/dp/${match[1].toUpperCase()}`);
  clean.searchParams.set("tag", normalizeTag(tag));
  return clean.href;
}

/**
 * Restituisce l'URL verso cui reindirizzare, oppure null se non serve fare niente
 * (pagina non prodotto, sito diverso, oppure link già pulito).
 * Un eventuale #frammento non conta: se è l'unica differenza il link resta com'è.
 */
function getRedirectUrl(rawUrl, tag = DEFAULT_TAG) {
  const clean = cleanProductUrl(rawUrl, tag);
  if (clean === null) {
    return null;
  }
  const current = new URL(rawUrl);
  current.hash = "";
  return current.href === clean ? null : clean;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DEFAULT_TAG, TAG_PATTERN, normalizeTag, cleanProductUrl, getRedirectUrl };
}
