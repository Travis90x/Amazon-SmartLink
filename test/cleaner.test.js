// Prove di cleaner.js. Si lanciano, dalla cartella del progetto, con: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_TAG, normalizeTag, cleanProductUrl, getRedirectUrl } = require("../src/cleaner.js");

const CLEAN = "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21";

// Pagine prodotto: ogni forma deve diventare /dp/ASIN?tag=...
const productCases = [
  ["esempio completo con molti parametri",
    "https://www.amazon.it/Geox-SPHERICA-Scarpe-Ginnastica-C9997/dp/B08QMZZ6P3/?_encoding=UTF8&pd_rd_w=84gRT&content-id=amzn1.sym.ccd44b06-1a6a-4018-b1f2-5555960d2d62&pf_rd_p=ccd44b06-1a6a-4018-b1f2-5555960d2d62&pf_rd_r=8EC4TXA5VTSY5WADWVWF&pd_rd_wg=Lvp57&pd_rd_r=1dd0ce9c-b9d4-449b-90ab-a9e6fae258f9&ref_=pd_hp_d_r_atf_dealz_wd_cs&tag=piattaforma-21&th=1&psc=1"],
  ["senza titolo nel percorso", "https://www.amazon.it/dp/B08QMZZ6P3"],
  ["con slash finale", "https://www.amazon.it/dp/B08QMZZ6P3/"],
  ["con ref nel percorso", "https://www.amazon.it/dp/B08QMZZ6P3/ref=sr_1_3?crid=ABC&keywords=scarpe&sprefix=sc"],
  ["gp/product", "https://www.amazon.it/gp/product/B08QMZZ6P3?psc=1&th=1"],
  ["gp/product con ref", "https://www.amazon.it/gp/product/B08QMZZ6P3/ref=ox_sc_act_title_1?smid=A11IL2PNWYJU7H"],
  ["versione mobile gp/aw/d", "https://www.amazon.it/gp/aw/d/B08QMZZ6P3?pd_rd_i=B08QMZZ6P3"],
  ["product/", "https://www.amazon.it/product/B08QMZZ6P3"],
  ["exec/obidos", "https://www.amazon.it/exec/obidos/ASIN/B08QMZZ6P3/ref=nosim"],
  ["ASIN maiuscolo nel percorso", "https://www.amazon.it/gp/product/ASIN/B08QMZZ6P3"],
  ["tag di un altro già presente", "https://www.amazon.it/dp/B08QMZZ6P3?tag=altro-21&linkCode=ur2"],
  ["tag vecchio", "https://www.amazon.it/dp/B08QMZZ6P3?tag=vecchio-tag-21"],
  ["scritto con &tag al posto di ?tag", "https://www.amazon.it/dp/B08QMZZ6P3&tag=piattaforma-21"],
  ["ASIN in minuscolo", "https://www.amazon.it/dp/b08qmzz6p3"],
  ["http", "http://www.amazon.it/dp/B08QMZZ6P3?th=1"],
  ["senza www", "https://amazon.it/dp/B08QMZZ6P3?th=1"],
  ["con frammento", "https://www.amazon.it/dp/B08QMZZ6P3?th=1#customerReviews"],
  ["Amazon rimette th e psc dopo il caricamento", "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21&th=1&psc=1"],
  ["slug con caratteri codificati", "https://www.amazon.it/Scarpe-%C3%A8-bella/dp/B08QMZZ6P3/"],
];

for (const [name, input] of productCases) {
  test(`prodotto: ${name}`, () => {
    const out = name === "senza www"
      ? "https://amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21"
      : CLEAN;
    assert.equal(cleanProductUrl(input), out);
    assert.equal(getRedirectUrl(input), out);
  });
}

test("ISBN-10 che finisce con X", () => {
  assert.equal(
    cleanProductUrl("https://www.amazon.it/Titolo/dp/884520143X/?crid=1"),
    "https://www.amazon.it/dp/884520143X?tag=piattaforma-21"
  );
});

// Pagine che NON vanno toccate (ricerca, carrello, account, siti diversi, POST gestito altrove...)
const untouched = [
  "https://www.amazon.it/",
  "https://www.amazon.it/s?k=scarpe+geox&crid=1",
  "https://www.amazon.it/gp/cart/view.html?ref_=nav_cart",
  "https://www.amazon.it/gp/css/order-history",
  "https://www.amazon.it/gp/your-account/order-details",
  "https://www.amazon.it/gp/product/handle-buy-box/ref=dp_start-bbf_1_glance",
  "https://www.amazon.it/gp/offer-listing/B08QMZZ6P3",
  "https://www.amazon.it/b?node=12345",
  "https://www.amazon.it/stores/Geox/page/1234",
  "https://www.amazon.it/ap/signin?openid.return_to=https%3A%2F%2Fwww.amazon.it%2Fdp%2FB08QMZZ6P3",
  "https://www.amazon.it/dp/B08QMZZ6P",        // ASIN di 9 caratteri
  "https://www.amazon.it/dp/B08QMZZ6P3X",      // 11 caratteri
  "https://www.amazon.it/dp/",
  "https://www.amazon.com/dp/B08QMZZ6P3",
  "https://www.amazon.de/dp/B08QMZZ6P3",
  "https://www.amazon.it.evil.example/dp/B08QMZZ6P3",
  "https://evilamazon.it/dp/B08QMZZ6P3",
  "https://smile.amazon.it/dp/B08QMZZ6P3",
  "https://example.com/amazon.it/dp/B08QMZZ6P3",
  "non è un url",
];

for (const input of untouched) {
  test(`non toccare: ${input.slice(0, 70)}`, () => {
    assert.equal(cleanProductUrl(input), null);
    assert.equal(getRedirectUrl(input), null);
  });
}

test("link già pulito: nessun reindirizzamento", () => {
  assert.equal(getRedirectUrl(CLEAN), null);
});

test("link già pulito con solo il frammento in più: nessun reindirizzamento", () => {
  assert.equal(getRedirectUrl(CLEAN + "#feature-bullets"), null);
});

test("idempotenza: pulire un link già pulito non cambia niente (niente cicli di redirect)", () => {
  for (const [, input] of productCases) {
    const once = getRedirectUrl(input);
    assert.equal(getRedirectUrl(once), null, `ciclo su: ${input}`);
  }
});

test("tag personalizzato", () => {
  assert.equal(
    cleanProductUrl("https://www.amazon.it/dp/B08QMZZ6P3?th=1", "mio-tag-21"),
    "https://www.amazon.it/dp/B08QMZZ6P3?tag=mio-tag-21"
  );
});

test("tag non valido o vuoto: ripiega su piattaforma-21 e mai su altri", () => {
  for (const bad of ["", "   ", undefined, null, "a", "tag con spazi", "tag&x=1", "tag?x", "x".repeat(65), "tag\n21"]) {
    assert.equal(normalizeTag(bad), DEFAULT_TAG, `tag: ${JSON.stringify(bad)}`);
  }
  assert.equal(DEFAULT_TAG, "piattaforma-21");
});

test("il tag salvato con spazi attorno viene ripulito", () => {
  assert.equal(normalizeTag("  mio-tag-21 "), "mio-tag-21");
});
