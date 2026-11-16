🇬🇧 [Read the README in English](README.md)

# Amazon SmartLink

Ripulisce i link di Amazon e imposta il tuo tag affiliato. Quando apri una pagina prodotto di un negozio Amazon (amazon.it, amazon.de, amazon.fr, amazon.co.uk, amazon.com e altri) l'indirizzo diventa un link pulito e, se hai impostato un tag per quel negozio, porta il tuo tag affiliato.

```
https://www.amazon.it/Geox-SPHERICA-Scarpe-Ginnastica-C9997/dp/B08QMZZ6P3/?_encoding=UTF8&pd_rd_w=84gRT&...&tag=altro-21&th=1&psc=1
                                  ↓
https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21
```

Il tag va dopo `?` (non dopo `&`): con `&` finirebbe dentro il percorso e non sarebbe un parametro.

Ci sono due forme, con le stesse regole di pulizia:

1. **Userscript per [Tampermonkey](https://www.tampermonkey.net/) (consigliato).** Resta installato con gli aggiornamenti e i riavvii di Firefox.
2. **Estensione per Firefox.** Riscrive l'indirizzo prima che parta la richiesta, ma su Firefox normale si può caricare solo in modo temporaneo e sparisce a ogni riavvio (vedi «Perché l'estensione non è sullo store di Firefox»).

> **Stato: versione 1.0.0.** La logica di pulizia ha test automatici. L'estensione è stata provata in un Firefox vero su amazon.it e amazon.de. Lo userscript è stato provato in un Firefox vero con un sostituto delle funzioni `GM_*` di Tampermonkey e poi installato in Tampermonkey, dove l'autore ha confermato che funziona.

## Installare lo userscript (consigliato)

1. Installa [Tampermonkey](https://www.tampermonkey.net/) in Firefox.
2. Installa lo script in uno di questi due modi.

**Dal link (il più semplice).** Apri [`amazon-smartlink.user.js`](userscript/amazon-smartlink.user.js) nella vista «Raw» (o l'indirizzo qui sotto) e conferma l'installazione in Tampermonkey. Se lo script è già installato, Tampermonkey propone l'aggiornamento.

**Con «Installa da URL» (utile quando il link non apre la pagina di installazione).**
1. Apri Tampermonkey e vai in **Utilità**.
2. Incolla questo indirizzo nel campo **Installa da URL**:
   `https://raw.githubusercontent.com/Travis90x/Amazon-SmartLink/main/userscript/amazon-smartlink.user.js`
3. Clicca **Installa** e conferma.

Tampermonkey cerca gli aggiornamenti allo stesso indirizzo.

**Tag.** Clicca l'icona di Tampermonkey mentre sei su un negozio Amazon: sotto *Amazon SmartLink* ci sono tre comandi (i nomi dei comandi sono in inglese).

| Comando | Cosa fa |
| --- | --- |
| **Set the tag for amazon.&lt;negozio&gt;** | Imposta (o, se lo lasci vuoto, toglie) il tag del negozio in cui ti trovi. |
| **Show all tags** | Elenca il tag di ogni negozio. |
| **Edit all tags (JSON)** | Modifica tutti i tag insieme, per esempio `{"it": "tuo-tag-21", "de": "tuo-de-21"}`. |

Una modifica vale dopo aver ricaricato la pagina. I tag li conserva Tampermonkey.

**Come funziona.** Lo script parte appena la pagina comincia a caricarsi, guarda l'indirizzo di una pagina prodotto e decide:
- la pagina è stata caricata **senza il tuo tag** (mancava, o era di un altro): la ricarica una volta all'indirizzo pulito `/dp/ASIN?tag=TUO-TAG`, così Amazon riceve il tuo tag;
- la pagina è stata caricata **già con il tuo tag**, oppure il negozio **non ha un tag**: cambia solo l'indirizzo mostrato nella barra, senza ricaricare;
- dopo controlla l'indirizzo ogni 250 ms, perché Amazon rimette `th=1&psc=1` a pagina caricata e cambia l'indirizzo quando scegli una variante.

Non ricarica mai due volte allo stesso indirizzo entro 10 secondi, quindi non può andare in ciclo.

## Installare l'estensione per Firefox

1. Apri `about:debugging#/runtime/this-firefox`.
2. Clicca «Carica componente aggiuntivo temporaneo…» e scegli `src\manifest.json` (da un clone di questo repository), oppure lo zip che scarichi dalla pagina delle [Release](https://github.com/Travis90x/Amazon-SmartLink/releases) (senza decomprimerlo).
3. Resta attiva fino al riavvio di Firefox.

Le opzioni sono in `about:addons` → Amazon SmartLink → Preferenze. I tag sono gli stessi su tutti i tuoi Firefox se hai attivato la sincronizzazione dei componenti aggiuntivi.

### Perché l'estensione non è sullo store di Firefox
Le Add-on Policies di Mozilla (sezione 7, Monetization) non permettono di modificare i contenuti web o fare reindirizzamenti per inserire tag affiliati, e valgono anche per le estensioni distribuite fuori dallo store. Firefox normale installa solo estensioni firmate da Mozilla, quindi un'installazione permanente non è prevista. Alternative: Firefox Developer Edition, Nightly o ESR con `xpinstall.signatures.required` a `false` in `about:config`, oppure lo userscript qui sopra.

## Negozi supportati
amazon.it, .de, .fr, .es, .co.uk, .com, .nl, .se, .pl, .com.be, .ie, .ca, .com.au, .co.jp, .in, .com.br, .com.mx, .ae, .sa, .sg, .com.tr, .eg, .co.za (con e senza `www.`).

## Un tag per negozio
I tag affiliati sono legati al singolo paese: il tag di amazon.it non vale su amazon.de. Entrambe le forme tengono un tag per negozio.
- amazon.it parte con `piattaforma-21`; gli altri negozi partono vuoti.
- Un negozio senza tag viene solo ripulito (`https://www.amazon.de/dp/ASIN`): il progetto non mette mai su un link il tag di un altro paese o di qualcun altro.
- Un tag già presente nel link viene sostituito dal tuo; per un negozio senza tag viene tolto dall'indirizzo.
- Osservato nelle prove (4 su 4 dell'estensione, dall'Italia, con tag di prova): aprendo un link `amazon.de` che ha un tag, è Amazon a rimandare su `amazon.it`, e lì si applica il tag di amazon.it. È un comportamento di Amazon, non del progetto, e non è garantito. Senza tag per quel negozio Amazon resta su `amazon.de`.

## Cosa fa e cosa non fa
- Agisce solo sulle pagine prodotto (`/dp/ASIN`, `/gp/product/ASIN`, `/gp/aw/d/ASIN`, `/product/ASIN`, `/exec/obidos/ASIN/ASIN`).
- Toglie ogni parametro (`ref_`, `pd_rd_*`, `th`, `psc`…) e il titolo nel percorso; tiene solo `?tag=`.
- Ricerca, carrello, account, ordini e altri siti non vengono toccati.
- Un `#frammento` da solo non provoca reindirizzamenti.

| | Userscript | Estensione |
| --- | --- | --- |
| Resta con gli aggiornamenti e i riavvii di Firefox | Sì | No (temporanea), tranne su Developer Edition, Nightly o ESR |
| Richiesta che porta il tag | Un ricaricamento quando manca il tuo tag: la prima richiesta parte con il link originale | Una sola richiesta: l'indirizzo è riscritto prima che parta |
| Quali richieste tratta | La pagina che si sta caricando (gira dentro la pagina) | Solo navigazioni GET: le richieste POST non vengono mai toccate |
| Tag e impostazioni | Menu di Tampermonkey | Pagina delle opzioni |

## Struttura
- `userscript/amazon-smartlink.user.js` — lo userscript per Tampermonkey. È generato: non modificarlo a mano.
- `userscript/template.user.js` — la logica propria dello userscript (intestazione, menu, decisioni); `tools/build_userscript.js` la unisce a `src/cleaner.js` e scrive lo userscript (`node tools/build_userscript.js`, oppure `--check` per verificare che sia aggiornato).
- `src/cleaner.js` — logica pura comune alle due forme (nessuna API del browser): elenco dei negozi, riconosce la pagina prodotto e costruisce il link pulito.
- `src/background.js` — estensione: intercetta le richieste (`webRequest`, bloccante) e reindirizza.
- `src/pagecleaner.js` — script di pagina dell'estensione: ripulisce la barra degli indirizzi dopo il caricamento.
- `src/options.html`, `src/options.js` — pagina delle opzioni dell'estensione (in inglese).
- `src/icons/` — icone (PNG 16, 32, 48, 96, 128 e sorgente SVG), generate da `tools/make_icons.py` (`python -I tools/make_icons.py`, senza librerie esterne).
- `test/` — prove di `cleaner.js`, del manifest e dello userscript: dalla cartella del progetto, `node --test`.

## Origine
L'idea viene da [AmazonAffiliateTagger](https://github.com/DorianGrey11/AmazonAffiliateTagger) (GPL v3, aggiunge solo il tag). Il codice è scritto da zero, senza copiarne.

## Licenza
[MIT](LICENSE).
