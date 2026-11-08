/*
 * pagecleaner.js — pagine prodotto dei negozi Amazon: dopo il caricamento Amazon rimette da solo nella
 * barra degli indirizzi parametri come th=1 e psc=1 (e cambia l'indirizzo quando scegli una variante).
 * Questo script li toglie di nuovo, così "copia indirizzo" dà sempre il link pulito.
 * Cambia solo l'indirizzo mostrato (history.replaceState): la pagina non si ricarica
 * e il suo contenuto non viene toccato. cleaner.js è caricato prima (vedi manifest).
 */

let pageTags = resolveTags({});

function tidyAddressBar() {
  const target = getRedirectUrl(location.href, pageTags);
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

function loadTags() {
  return browser.storage.sync
    .get(["tags", "tag"])
    .then((stored) => {
      pageTags = resolveTags(stored);
    })
    .catch(() => {
      pageTags = resolveTags({});
    });
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.tags || changes.tag)) {
    loadTags();
  }
});

loadTags().then(() => {
  tidyAddressBar();
  // Amazon cambia l'indirizzo anche a diversi secondi dal caricamento (th/psc, cambio di variante)
  // e il browser non avvisa gli script di pagina: si controlla ogni quarto di secondo.
  // Costa pochissimo (confronto tra due stringhe) e lascia l'indirizzo sporco al massimo per un istante.
  setInterval(tidyAddressBar, 250);
});
