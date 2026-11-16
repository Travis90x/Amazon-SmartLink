// ==UserScript==
// @name         Amazon SmartLink
// @namespace    https://github.com/Travis90x/Amazon-SmartLink
// @version      1.0.0
// @description  Cleans Amazon product links (/dp/ASIN) and adds your affiliate tag, one tag per Amazon store.
// @description:it  Ripulisce i link prodotto di Amazon (/dp/ASIN) e imposta il tuo tag affiliato, un tag per negozio.
// @author       Travis90x
// @license      MIT
// @icon         https://raw.githubusercontent.com/Travis90x/Amazon-SmartLink/main/src/icons/icon-48.png
// @homepageURL  https://github.com/Travis90x/Amazon-SmartLink
// @supportURL   https://github.com/Travis90x/Amazon-SmartLink/issues
// @downloadURL  https://raw.githubusercontent.com/Travis90x/Amazon-SmartLink/main/userscript/amazon-smartlink.user.js
// @updateURL    https://raw.githubusercontent.com/Travis90x/Amazon-SmartLink/main/userscript/amazon-smartlink.user.js
// @match        *://www.amazon.it/*
// @match        *://amazon.it/*
// @match        *://www.amazon.de/*
// @match        *://amazon.de/*
// @match        *://www.amazon.fr/*
// @match        *://amazon.fr/*
// @match        *://www.amazon.es/*
// @match        *://amazon.es/*
// @match        *://www.amazon.co.uk/*
// @match        *://amazon.co.uk/*
// @match        *://www.amazon.com/*
// @match        *://amazon.com/*
// @match        *://www.amazon.nl/*
// @match        *://amazon.nl/*
// @match        *://www.amazon.se/*
// @match        *://amazon.se/*
// @match        *://www.amazon.pl/*
// @match        *://amazon.pl/*
// @match        *://www.amazon.com.be/*
// @match        *://amazon.com.be/*
// @match        *://www.amazon.ie/*
// @match        *://amazon.ie/*
// @match        *://www.amazon.ca/*
// @match        *://amazon.ca/*
// @match        *://www.amazon.com.au/*
// @match        *://amazon.com.au/*
// @match        *://www.amazon.co.jp/*
// @match        *://amazon.co.jp/*
// @match        *://www.amazon.in/*
// @match        *://amazon.in/*
// @match        *://www.amazon.com.br/*
// @match        *://amazon.com.br/*
// @match        *://www.amazon.com.mx/*
// @match        *://amazon.com.mx/*
// @match        *://www.amazon.ae/*
// @match        *://amazon.ae/*
// @match        *://www.amazon.sa/*
// @match        *://amazon.sa/*
// @match        *://www.amazon.sg/*
// @match        *://amazon.sg/*
// @match        *://www.amazon.com.tr/*
// @match        *://amazon.com.tr/*
// @match        *://www.amazon.eg/*
// @match        *://amazon.eg/*
// @match        *://www.amazon.co.za/*
// @match        *://amazon.co.za/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @noframes
// ==/UserScript==

// FILE GENERATO: non modificarlo a mano. Si cambia userscript/template.user.js (questa logica) oppure
// src/cleaner.js (la logica comune con l'estensione) e poi si lancia: node tools/build_userscript.js

(function () {
  'use strict';

  // --- Da qui: copia di src/cleaner.js (logica comune con l'estensione) ---
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
  // --- Fine della copia di src/cleaner.js ---

  // ===================================================================
  // Impostazioni e decisioni dello userscript
  // I tag stanno nell'archivio di Tampermonkey e valgono per tutti i negozi Amazon.
  // ===================================================================
  const TAGS_KEY = 'tags';
  const LAST_RELOAD_KEY = 'amazonSmartLinkLastReload'; // sessionStorage: evita giri infiniti di ricaricamenti
  const RELOAD_COOLDOWN_MS = 10000;
  const TIDY_INTERVAL_MS = 250;
  const INVALID_TAG_MESSAGE = 'Invalid tag: use 3 to 64 characters among letters, numbers, - . _';

  function loadTags() {
    return resolveTags({ tags: GM_getValue(TAGS_KEY, undefined) });
  }

  /**
   * Decide cosa fare con l'indirizzo aperto:
   *  - 'reload': la richiesta che ha caricato la pagina non aveva il tuo tag (mancava o era di un altro):
   *    si ricarica una volta l'indirizzo pulito, così Amazon riceve il tuo tag;
   *  - 'tidy': la richiesta aveva già il tag giusto (o il negozio non ha un tag): si cambia solo
   *    l'indirizzo mostrato, senza ricaricare;
   *  - 'none': non è una pagina prodotto, è già pulita, o il ricaricamento è già stato fatto da poco.
   */
  function planNavigation(href, tags, recentTarget) {
    const target = getRedirectUrl(href, tags);
    if (target === null) {
      return { action: 'none' };
    }
    const url = new URL(href);
    const ownTag = tags[getMarketplace(url.hostname)];
    if (ownTag && url.searchParams.get('tag') !== ownTag) {
      return target === recentTarget ? { action: 'none' } : { action: 'reload', url: target };
    }
    return { action: 'tidy', url: target };
  }

  function recentReloadTarget() {
    try {
      const last = JSON.parse(sessionStorage.getItem(LAST_RELOAD_KEY) || 'null');
      return last && Date.now() - last.time < RELOAD_COOLDOWN_MS ? last.target : null;
    } catch {
      return null;
    }
  }

  function rememberReload(target) {
    try {
      sessionStorage.setItem(LAST_RELOAD_KEY, JSON.stringify({ target, time: Date.now() }));
    } catch {
      // senza sessionStorage si perde solo la protezione contro i giri infiniti
    }
  }

  /** Cambia solo l'indirizzo mostrato (history.replaceState): la pagina non si ricarica. */
  function showAddress(url) {
    const next = new URL(url);
    next.hash = location.hash;
    try {
      history.replaceState(history.state, '', next.href);
    } catch {
      // se il browser rifiuta il cambio l'indirizzo resta com'è: nessun danno
    }
  }

  // ===================================================================
  // Menu di Tampermonkey (icona dell'estensione > Amazon SmartLink)
  // ===================================================================
  let tags = loadTags();
  const market = getMarketplace(location.hostname);

  /** Controlla una mappa negozio -> tag: restituisce { tags, errors }. */
  function checkTagMap(candidate) {
    const errors = [];
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      return { tags: null, errors: ['not an object'] };
    }
    for (const [store, value] of Object.entries(candidate)) {
      if (!MARKETPLACES.includes(store)) {
        errors.push('unknown store: ' + store);
      } else if (parseTag(value) === null) {
        errors.push('invalid tag for amazon.' + store);
      }
    }
    return { tags: resolveTags({ tags: candidate }), errors };
  }

  function registerMenu() {
    if (market === null) {
      return;
    }
    GM_registerMenuCommand('Set the tag for amazon.' + market, () => {
      const answer = prompt('Affiliate tag for amazon.' + market + ' (leave empty for no tag: links are only cleaned):', tags[market] || '');
      if (answer === null) {
        return;
      }
      const value = answer.trim();
      if (value !== '' && parseTag(value) === null) {
        alert(INVALID_TAG_MESSAGE);
        return;
      }
      const next = { ...tags };
      if (value === '') {
        delete next[market];
      } else {
        next[market] = value;
      }
      GM_setValue(TAGS_KEY, next);
      tags = next;
      alert('Saved. Reload the page to apply it.');
    });

    GM_registerMenuCommand('Show all tags', () => {
      alert(MARKETPLACES.map((store) => 'amazon.' + store + ': ' + (tags[store] || '(no tag, links only cleaned)')).join('\n'));
    });

    GM_registerMenuCommand('Edit all tags (JSON)', () => {
      const answer = prompt('Tags as JSON, for example {"it": "your-tag-21", "de": "your-de-21"}. Stores not listed get no tag:', JSON.stringify(tags));
      if (answer === null) {
        return;
      }
      let candidate;
      try {
        candidate = JSON.parse(answer);
      } catch {
        alert('Not valid JSON: nothing was saved.');
        return;
      }
      const checked = checkTagMap(candidate);
      if (checked.errors.length > 0) {
        alert('Nothing was saved: ' + checked.errors.join(', '));
        return;
      }
      GM_setValue(TAGS_KEY, checked.tags);
      tags = checked.tags;
      alert('Saved. Reload the page to apply it.');
    });
  }

  // ===================================================================
  // Avvio
  // ===================================================================
  function tidy() {
    const plan = planNavigation(location.href, tags, null);
    if (plan.action === 'tidy') {
      showAddress(plan.url);
    }
  }

  registerMenu();

  const plan = planNavigation(location.href, tags, recentReloadTarget());
  if (plan.action === 'reload') {
    rememberReload(plan.url);
    location.replace(plan.url);
    return;
  }
  if (plan.action === 'tidy') {
    showAddress(plan.url);
  }
  // Amazon cambia l'indirizzo anche a diversi secondi dal caricamento (th/psc, cambio di variante) e il
  // browser non avvisa gli script di pagina: si controlla ogni quarto di secondo (confronto tra stringhe).
  setInterval(tidy, TIDY_INTERVAL_MS);
})();
