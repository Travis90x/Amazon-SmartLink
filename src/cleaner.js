/*
 * cleaner.js — logica pura per ripulire i link prodotto dei negozi Amazon.
 * Non usa nessuna API del browser: così si prova anche con Node (vedi test/).
 * Viene caricato come script normale da background, script di pagina e pagina delle opzioni.
 */

// Negozi Amazon supportati (dopo "amazon."). Se cambia questo elenco vanno aggiornati anche i
// permessi e i content_scripts del manifest: lo controlla test/cleaner.test.js.
const MARKETPLACES = [
  "it", "de", "fr", "es", "co.uk", "com", "nl", "se", "pl", "com.be", "ie", "ca",
  "com.au", "co.jp", "in", "com.br", "com.mx", "ae", "sa", "sg", "com.tr", "eg", "co.za",
];

// Tag affiliati predefiniti, per negozio. Un negozio senza tag viene solo ripulito.
const DEFAULT_TAGS = { it: "piattaforma-21" };

// Il tag è fatto solo di lettere, numeri, trattino, punto e trattino basso.
// Questa regola evita anche di mettere nell'URL caratteri che il browser potrebbe riscrivere.
const TAG_PATTERN = /^[A-Za-z0-9_.-]{3,64}$/;

// Host su cui agisce l'addon: con e senza "www.", per ogni negozio.
const AMAZON_HOSTS = MARKETPLACES.flatMap((market) => [`www.amazon.${market}`, `amazon.${market}`]);

// Percorsi di pagina prodotto: un segmento noto seguito dall'ASIN (10 caratteri tra lettere e numeri).
// Dopo l'ASIN deve esserci una fine percorso, "/", "?", "#" oppure "&" (quest'ultimo per i link
// scritti male tipo /dp/ASIN&tag=...).
const ASIN_PATTERN = /\/(?:dp|gp\/product|gp\/aw\/d|product|exec\/obidos\/ASIN|o\/ASIN|ASIN)\/([A-Z0-9]{10})(?=[/?#&]|$)/i;

/**
 * Restituisce il tag ripulito dagli spazi se è valido, altrimenti null (nessun tag).
 * Non ripiega mai sul tag di qualcun altro.
 */
function parseTag(value) {
  const tag = String(value ?? "").trim();
  return TAG_PATTERN.test(tag) ? tag : null;
}

/**
 * Dal contenuto dello storage ({tags: {it: "...", de: "..."}}, più il vecchio {tag: "..."} di una
 * versione precedente) alla mappa negozio -> tag. Contiene solo negozi noti con tag valido.
 * Se non è mai stato salvato niente valgono i tag predefiniti.
 */
function resolveTags(stored) {
  const legacy = parseTag(stored?.tag);
  const hasSaved = typeof stored?.tags === "object" && stored.tags !== null;
  const source = hasSaved ? stored.tags : { ...DEFAULT_TAGS, ...(legacy ? { it: legacy } : {}) };
  const tags = {};
  for (const market of MARKETPLACES) {
    const tag = parseTag(source[market]);
    if (tag) {
      tags[market] = tag;
    }
  }
  return tags;
}

/** Dato un nome host restituisce il negozio ("it", "co.uk"...) oppure null se non è Amazon. */
function getMarketplace(hostname) {
  if (!AMAZON_HOSTS.includes(hostname)) {
    return null;
  }
  const bare = hostname.startsWith("www.") ? hostname.slice("www.".length) : hostname;
  return bare.slice("amazon.".length);
}

/**
 * Dato l'URL di una pagina prodotto di un negozio Amazon supportato restituisce la sua forma pulita
 * https://<host>/dp/<ASIN>, con ?tag=<tag del negozio> se quel negozio ha un tag.
 * Per qualsiasi altra pagina o sito restituisce null.
 */
function cleanProductUrl(rawUrl, tags = resolveTags({})) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const market = getMarketplace(url.hostname);
  if (market === null) {
    return null;
  }
  const match = ASIN_PATTERN.exec(url.pathname);
  if (!match) {
    return null;
  }
  const clean = new URL(`https://${url.hostname}/dp/${match[1].toUpperCase()}`);
  const tag = parseTag(tags?.[market]);
  if (tag) {
    clean.searchParams.set("tag", tag);
  }
  return clean.href;
}

/**
 * Restituisce l'URL verso cui reindirizzare, oppure null se non serve fare niente
 * (pagina non prodotto, sito diverso, oppure link già pulito).
 * Un eventuale #frammento non conta: se è l'unica differenza il link resta com'è.
 */
function getRedirectUrl(rawUrl, tags = resolveTags({})) {
  const clean = cleanProductUrl(rawUrl, tags);
  if (clean === null) {
    return null;
  }
  const current = new URL(rawUrl);
  current.hash = "";
  return current.href === clean ? null : clean;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MARKETPLACES, DEFAULT_TAGS, TAG_PATTERN, AMAZON_HOSTS,
    parseTag, resolveTags, getMarketplace, cleanProductUrl, getRedirectUrl,
  };
}
