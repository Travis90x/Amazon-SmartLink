// ==UserScript==
// @name         Amazon SmartLink
// @namespace    https://github.com/Travis90x/Amazon-SmartLink
// @version      @@VERSION@@
// @description  Cleans Amazon product links (/dp/ASIN) and adds your affiliate tag, one tag per Amazon store.
// @description:it  Ripulisce i link prodotto di Amazon (/dp/ASIN) e imposta il tuo tag affiliato, un tag per negozio.
// @author       Travis90x
// @license      MIT
// @icon         https://raw.githubusercontent.com/Travis90x/Amazon-SmartLink/main/src/icons/icon-48.png
// @homepageURL  https://github.com/Travis90x/Amazon-SmartLink
// @supportURL   https://github.com/Travis90x/Amazon-SmartLink/issues
// @downloadURL  https://raw.githubusercontent.com/Travis90x/Amazon-SmartLink/main/userscript/amazon-smartlink.user.js
// @updateURL    https://raw.githubusercontent.com/Travis90x/Amazon-SmartLink/main/userscript/amazon-smartlink.user.js
// @@MATCHES@@
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
  // @@CLEANER@@
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
