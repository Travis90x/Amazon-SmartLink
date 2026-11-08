# Amazon SmartLink

[English version → README.md](README.md)

Estensione per Firefox: quando apri una pagina prodotto di un negozio Amazon (amazon.it, amazon.de, amazon.fr, amazon.co.uk, amazon.com e altri) la sostituisce con il link pulito e, se hai impostato un tag per quel negozio, con il tuo tag affiliato.

```
https://www.amazon.it/Geox-SPHERICA-Scarpe-Ginnastica-C9997/dp/B08QMZZ6P3/?_encoding=UTF8&pd_rd_w=84gRT&...&tag=altro-21&th=1&psc=1
                                  ↓
https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21
```

Il tag va dopo `?` (non dopo `&`): con `&` finirebbe dentro il percorso e non sarebbe un parametro.

## Negozi supportati
amazon.it, .de, .fr, .es, .co.uk, .com, .nl, .se, .pl, .com.be, .ie, .ca, .com.au, .co.jp, .in, .com.br, .com.mx, .ae, .sa, .sg, .com.tr, .eg, .co.za (con e senza `www.`).

## Un tag per negozio
I tag affiliati sono legati al singolo paese: il tag di amazon.it non vale su amazon.de. Nelle opzioni c'è un campo per ogni negozio.
- amazon.it parte con `piattaforma-21`; gli altri negozi partono vuoti.
- Un negozio con il campo vuoto viene solo ripulito (`https://www.amazon.de/dp/ASIN`), senza nessun tag: non viene mai messo il tag di un altro paese o di qualcun altro.
- Un tag già presente nel link viene sempre sostituito dal tuo, o tolto se per quel negozio non ne hai impostato uno.
- Osservato nelle prove (4 su 4, dall'Italia, con tag di prova): aprendo un link `amazon.de` che ha un tag, è Amazon a rimandare su `amazon.it`, e lì l'estensione applica il tag di amazon.it. È un comportamento di Amazon, non dell'estensione, e non è garantito. Senza tag per quel negozio Amazon resta su `amazon.de`.

## Cosa fa e cosa non fa
- Agisce solo sulle pagine prodotto (`/dp/ASIN`, `/gp/product/ASIN`, `/gp/aw/d/ASIN`, `/product/ASIN`, `/exec/obidos/ASIN/ASIN`) e solo sulle richieste GET.
- Toglie ogni parametro (`ref_`, `pd_rd_*`, `th`, `psc`…) e il titolo nel percorso; tiene solo `?tag=`.
- Il reindirizzamento avviene prima della richiesta di rete: una sola richiesta, nessun lampeggio.
- Dopo il caricamento Amazon rimette da solo `th=1&psc=1` nella barra degli indirizzi (e cambia l'indirizzo quando scegli una variante): un piccolo script di pagina li toglie di nuovo con `history.replaceState`, controllando ogni 250 ms. Cambia solo l'indirizzo mostrato, non ricarica e non tocca il contenuto della pagina.
- Ricerca, carrello, account, ordini e altri siti non vengono toccati.
- Un `#frammento` da solo non provoca reindirizzamenti.

## Provarlo in Firefox
1. Apri `about:debugging#/runtime/this-firefox`.
2. «Carica componente aggiuntivo temporaneo…» e scegli `src\manifest.json`.
3. Resta attivo fino al riavvio di Firefox.

Le opzioni sono in `about:addons` → Amazon SmartLink → Preferenze. I tag sono gli stessi su tutti i tuoi Firefox se hai attivato la sincronizzazione dei componenti aggiuntivi.

## Perché non è sullo store di Firefox
Le Add-on Policies di Mozilla (sezione 7, Monetization) non permettono di modificare i contenuti web o fare reindirizzamenti per inserire tag affiliati, e valgono anche per le estensioni distribuite fuori dallo store. Firefox normale installa solo estensioni firmate da Mozilla, quindi un'installazione permanente non è prevista. Alternative: Firefox Developer Edition, Nightly o ESR con `xpinstall.signatures.required` a `false` in `about:config`.

## Struttura
- `src/cleaner.js` — logica pura (nessuna API del browser): elenco dei negozi, riconosce la pagina prodotto e costruisce il link pulito.
- `src/background.js` — intercetta le richieste (`webRequest`, bloccante) e reindirizza.
- `src/pagecleaner.js` — script di pagina: ripulisce la barra degli indirizzi dopo il caricamento.
- `src/options.html`, `src/options.js` — pagina delle opzioni (in inglese).
- `src/icons/` — icone (PNG 16, 32, 48, 96, 128 e sorgente SVG), generate da `tools/make_icons.py` (`python -I tools/make_icons.py`, senza librerie esterne).
- `test/cleaner.test.js` — prove di `cleaner.js` e coerenza con il manifest: dalla cartella del progetto, `node --test`.

## Origine
L'idea viene da [AmazonAffiliateTagger](https://github.com/DorianGrey11/AmazonAffiliateTagger) (GPL v3, aggiunge solo il tag). Il codice è scritto da zero, senza copiarne.

## Licenza
[MIT](LICENSE).
