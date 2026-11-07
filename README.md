# Amazon Clean Tag

Estensione per Firefox: quando apri una pagina prodotto di **amazon.it** la sostituisce con il link pulito e con il tuo tag affiliato.

```
https://www.amazon.it/Geox-SPHERICA-Scarpe-Ginnastica-C9997/dp/B08QMZZ6P3/?_encoding=UTF8&pd_rd_w=84gRT&...&tag=altro-21&th=1&psc=1
                                  ↓
https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21
```

Il tag va dopo `?` (non dopo `&`): con `&` finirebbe dentro il percorso e non sarebbe un parametro.

## Cosa fa e cosa non fa
- Agisce solo su `www.amazon.it` e `amazon.it`, solo sulle pagine prodotto (`/dp/ASIN`, `/gp/product/ASIN`, `/gp/aw/d/ASIN`, `/product/ASIN`, `/exec/obidos/ASIN/ASIN`) e solo sulle richieste GET.
- Toglie ogni parametro (`ref_`, `pd_rd_*`, `th`, `psc`…), il titolo nel percorso e un eventuale tag di altri; tiene solo `?tag=`.
- Il reindirizzamento avviene prima della richiesta di rete: una sola richiesta, nessun lampeggio.
- Ricerca, carrello, account, ordini e altri siti Amazon non vengono toccati.
- Dopo il caricamento Amazon rimette da solo `th=1&psc=1` nella barra degli indirizzi (e cambia l'indirizzo quando scegli una variante): un piccolo script di pagina li toglie di nuovo con `history.replaceState`. Cambia solo l'indirizzo mostrato, non ricarica e non tocca il contenuto della pagina.
- Un `#frammento` da solo non provoca reindirizzamenti.
- Se il campo del tag è vuoto o non valido si usa `piattaforma-21`, mai il tag di qualcun altro.

## Provarlo in Firefox
1. Apri `about:debugging#/runtime/this-firefox`.
2. «Carica componente aggiuntivo temporaneo…» e scegli `src\manifest.json`.
3. Resta attivo fino al riavvio di Firefox.

Un'installazione permanente su Firefox normale richiede una firma di Mozilla (pubblicazione "non elencata" su addons.mozilla.org): non è stata fatta.

## Cambiare tag
`about:addons` → Amazon Clean Tag → Preferenze. Il tag è lo stesso su tutti i tuoi Firefox se hai attivato la sincronizzazione dei componenti aggiuntivi.

## Struttura
- `src/cleaner.js` — logica pura (nessuna API del browser): riconosce la pagina prodotto e costruisce il link pulito.
- `src/background.js` — intercetta le richieste (`webRequest`, bloccante) e reindirizza.
- `src/pagecleaner.js` — script di pagina: ripulisce la barra degli indirizzi dopo il caricamento.
- `src/options.html`, `src/options.js` — pagina delle opzioni.
- `test/cleaner.test.js` — prove di `cleaner.js`: dalla cartella del progetto, `node --test`.

## Origine
L'idea viene da [AmazonAffiliateTagger](https://github.com/DorianGrey11/AmazonAffiliateTagger) (GPL v3, aggiunge solo il tag). Il codice è scritto da zero, senza copiarne.
