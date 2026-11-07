/*
 * pagecleaner.js — pagine prodotto di amazon.it: dopo il caricamento Amazon rimette da solo nella
 * barra degli indirizzi parametri come th=1 e psc=1 (e cambia l'indirizzo quando scegli una variante).
 * Questo script li toglie di nuovo, così "copia indirizzo" dà sempre il link pulito.
 * Cambia solo l'indirizzo mostrato (history.replaceState): la pagina non si ricarica
 * e il suo contenuto non viene toccato. cleaner.js è caricato prima (vedi manifest).
 */

let pageTag = DEFAULT_TAG;

function tidyAddressBar() {
  const target = getRedirectUrl(location.href, pageTag);
  if (target === null) {
    return;
  }
  const next = new URL(target);
  next.hash = location.hash;
  try {
    history.replaceState(history.state, "", next.href);
  } catch {
    // Se il browser rifiuta il cambio l'indirizzo resta com'è: nessun danno.
  }
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.tag) {
    pageTag = normalizeTag(changes.tag.newValue);
  }
});

browser.storage.sync
  .get("tag")
  .then((stored) => {
    pageTag = normalizeTag(stored.tag);
  })
  .catch(() => {
    pageTag = DEFAULT_TAG;
  })
  .then(() => {
    tidyAddressBar();
    // Amazon cambia l'indirizzo anche dopo il caricamento: un controllo al secondo costa pochissimo
    // (confronto tra due stringhe) e copre sia th/psc sia il cambio di variante.
    setInterval(tidyAddressBar, 1000);
  });
