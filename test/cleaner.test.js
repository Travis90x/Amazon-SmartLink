// Prove di cleaner.js e della sua coerenza con il manifest. Si lanciano, dalla cartella del progetto, con: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  MARKETPLACES, DEFAULT_TAGS, AMAZON_HOSTS,
  parseTag, resolveTags, getMarketplace, cleanProductUrl, getRedirectUrl,
} = require("../src/cleaner.js");

const DEFAULTS = resolveTags({}); // solo amazon.it con piattaforma-21
const CLEAN = "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21";

// Pagine prodotto di amazon.it: ogni forma deve diventare /dp/ASIN?tag=...
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
  ["con frammento", "https://www.amazon.it/dp/B08QMZZ6P3?th=1#customerReviews"],
  ["Amazon rimette th e psc dopo il caricamento", "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21&th=1&psc=1"],
  ["slug con caratteri codificati", "https://www.amazon.it/Scarpe-%C3%A8-bella/dp/B08QMZZ6P3/"],
];

for (const [name, input] of productCases) {
  test(`amazon.it: ${name}`, () => {
    assert.equal(cleanProductUrl(input, DEFAULTS), CLEAN);
    assert.equal(getRedirectUrl(input, DEFAULTS), CLEAN);
  });
}

test("amazon.it senza www", () => {
  assert.equal(
    cleanProductUrl("https://amazon.it/dp/B08QMZZ6P3?th=1", DEFAULTS),
    "https://amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21"
  );
});

test("ISBN-10 che finisce con X", () => {
  assert.equal(
    cleanProductUrl("https://www.amazon.it/Titolo/dp/884520143X/?crid=1", DEFAULTS),
    "https://www.amazon.it/dp/884520143X?tag=piattaforma-21"
  );
});

// --- Tutti i negozi -------------------------------------------------------------------------

test("l'elenco dei negozi non ha doppioni e ne contiene almeno 20", () => {
  assert.equal(new Set(MARKETPLACES).size, MARKETPLACES.length);
  assert.ok(MARKETPLACES.length >= 20);
});

for (const market of MARKETPLACES) {
  test(`negozio amazon.${market}: con tag, senza tag, con e senza www`, () => {
    const dirty = (host) => `https://${host}/Titolo-lungo/dp/B08QMZZ6P3/ref=sr_1_1?th=1&psc=1&tag=altro-21`;
    const withTag = { [market]: "mio-tag-21" };
    assert.equal(cleanProductUrl(dirty(`www.amazon.${market}`), withTag), `https://www.amazon.${market}/dp/B08QMZZ6P3?tag=mio-tag-21`);
    assert.equal(cleanProductUrl(dirty(`amazon.${market}`), withTag), `https://amazon.${market}/dp/B08QMZZ6P3?tag=mio-tag-21`);
    // senza tag per quel negozio: solo pulizia, anche del tag altrui che c'era nel link
    assert.equal(cleanProductUrl(dirty(`www.amazon.${market}`), {}), `https://www.amazon.${market}/dp/B08QMZZ6P3`);
    // il tag di un altro negozio non viene mai usato
    const otherMarket = MARKETPLACES.find((m) => m !== market);
    assert.equal(cleanProductUrl(dirty(`www.amazon.${market}`), { [otherMarket]: "altro-paese-21" }), `https://www.amazon.${market}/dp/B08QMZZ6P3`);
    assert.equal(getMarketplace(`www.amazon.${market}`), market);
    assert.equal(getMarketplace(`amazon.${market}`), market);
  });
}

test("amazon.de con i tag predefiniti: ripulito senza tag (il tag italiano non si usa)", () => {
  assert.equal(cleanProductUrl("https://www.amazon.de/dp/B08QMZZ6P3?tag=piattaforma-21&th=1", DEFAULTS), "https://www.amazon.de/dp/B08QMZZ6P3");
});

test("link già pulito senza tag: nessun reindirizzamento", () => {
  assert.equal(getRedirectUrl("https://www.amazon.de/dp/B08QMZZ6P3", DEFAULTS), null);
  assert.equal(getRedirectUrl("https://www.amazon.co.uk/dp/B08QMZZ6P3", {}), null);
});

test("link con tag ma negozio senza tag: reindirizza al link senza tag", () => {
  assert.equal(getRedirectUrl("https://www.amazon.de/dp/B08QMZZ6P3?tag=x-21", {}), "https://www.amazon.de/dp/B08QMZZ6P3");
});

// --- Pagine e siti che NON vanno toccati ----------------------------------------------------

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
  "https://www.amazon.de/gp/cart/view.html",
  "https://www.amazon.cn/dp/B08QMZZ6P3",       // negozio non supportato
  "https://www.amazon.xx/dp/B08QMZZ6P3",
  "https://www.amazon.it.evil.example/dp/B08QMZZ6P3",
  "https://www.amazon.com.evil.example/dp/B08QMZZ6P3",
  "https://evilamazon.it/dp/B08QMZZ6P3",
  "https://evilamazon.com/dp/B08QMZZ6P3",
  "https://smile.amazon.it/dp/B08QMZZ6P3",
  "https://aws.amazon.com/dp/B08QMZZ6P3",
  "https://www.www.amazon.it/dp/B08QMZZ6P3",
  "https://example.com/amazon.it/dp/B08QMZZ6P3",
  "non è un url",
];

for (const input of untouched) {
  test(`non toccare: ${input.slice(0, 70)}`, () => {
    assert.equal(cleanProductUrl(input, DEFAULTS), null);
    assert.equal(getRedirectUrl(input, DEFAULTS), null);
  });
}

// --- Redirect: comportamento generale -------------------------------------------------------

test("link già pulito: nessun reindirizzamento", () => {
  assert.equal(getRedirectUrl(CLEAN, DEFAULTS), null);
});

test("link già pulito con solo il frammento in più: nessun reindirizzamento", () => {
  assert.equal(getRedirectUrl(CLEAN + "#feature-bullets", DEFAULTS), null);
});

test("idempotenza: pulire un link già pulito non cambia niente (niente cicli di redirect)", () => {
  const tagSets = [DEFAULTS, {}, Object.fromEntries(MARKETPLACES.map((m) => [m, `tag-${m.replace(/\./g, "-")}-21`]))];
  for (const tags of tagSets) {
    for (const [, input] of productCases) {
      const once = getRedirectUrl(input, tags);
      if (once !== null) {
        assert.equal(getRedirectUrl(once, tags), null, `ciclo su: ${input}`);
      }
    }
    for (const market of MARKETPLACES) {
      const once = getRedirectUrl(`https://www.amazon.${market}/x/dp/B08QMZZ6P3?th=1`, tags);
      assert.notEqual(once, null);
      assert.equal(getRedirectUrl(once, tags), null, `ciclo su amazon.${market}`);
    }
  }
});

// --- Tag ------------------------------------------------------------------------------------

test("parseTag: tag validi e non validi", () => {
  assert.equal(parseTag("  mio-tag-21 "), "mio-tag-21");
  for (const bad of ["", "   ", undefined, null, "a", "tag con spazi", "tag&x=1", "tag?x", "x".repeat(65), "tag\n21"]) {
    assert.equal(parseTag(bad), null, `tag: ${JSON.stringify(bad)}`);
  }
});

test("resolveTags: niente salvato -> solo il tag italiano predefinito", () => {
  assert.deepEqual(resolveTags({}), { it: "piattaforma-21" });
  assert.deepEqual(resolveTags(undefined), { it: "piattaforma-21" });
  assert.deepEqual(DEFAULT_TAGS, { it: "piattaforma-21" });
});

test("resolveTags: vecchio formato con un solo tag vale per amazon.it", () => {
  assert.deepEqual(resolveTags({ tag: "vecchio-it-21" }), { it: "vecchio-it-21" });
  assert.deepEqual(resolveTags({ tag: "non valido!" }), { it: "piattaforma-21" });
});

test("resolveTags: i tag salvati sostituiscono i predefiniti, anche se vuoti", () => {
  assert.deepEqual(resolveTags({ tags: { de: "mio-de-21", it: "mio-it-21" } }), { it: "mio-it-21", de: "mio-de-21" });
  assert.deepEqual(resolveTags({ tags: {} }), {});
  assert.deepEqual(resolveTags({ tags: { it: "" } }), {});
});

test("resolveTags: scarta negozi sconosciuti e tag non validi", () => {
  assert.deepEqual(resolveTags({ tags: { cn: "x-cn-21", de: "tag&x=1", fr: "mio-fr-21" } }), { fr: "mio-fr-21" });
});

// --- Coerenza con il manifest e con i file che caricano cleaner.js --------------------------

const src = path.join(__dirname, "..", "src");
const manifest = JSON.parse(fs.readFileSync(path.join(src, "manifest.json"), "utf8"));
const expectedPatterns = AMAZON_HOSTS.map((host) => `*://${host}/*`).sort();

test("manifest: i permessi sugli host coincidono con l'elenco dei negozi", () => {
  const hostPermissions = manifest.permissions.filter((p) => p.includes("://")).sort();
  assert.deepEqual(hostPermissions, expectedPatterns);
});

test("manifest: gli script di pagina girano sugli stessi host", () => {
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual([...manifest.content_scripts[0].matches].sort(), expectedPatterns);
});

test("manifest: cleaner.js è caricato prima degli script che lo usano", () => {
  assert.deepEqual(manifest.background.scripts, ["cleaner.js", "background.js"]);
  assert.deepEqual(manifest.content_scripts[0].js, ["cleaner.js", "pagecleaner.js"]);
  const options = fs.readFileSync(path.join(src, "options.html"), "utf8");
  assert.ok(options.indexOf("cleaner.js") !== -1 && options.indexOf("cleaner.js") < options.indexOf("options.js"));
});

test("manifest: le icone esistono e sono PNG delle dimensioni dichiarate", () => {
  const sizes = Object.keys(manifest.icons ?? {});
  assert.deepEqual(sizes.sort((a, b) => a - b), ["16", "32", "48", "96", "128"]);
  for (const size of sizes) {
    const bytes = fs.readFileSync(path.join(src, manifest.icons[size]));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${size}: non è un PNG`);
    assert.equal(bytes.readUInt32BE(16), Number(size), `${size}: larghezza`);
    assert.equal(bytes.readUInt32BE(20), Number(size), `${size}: altezza`);
    assert.equal(bytes[25], 6, `${size}: deve essere RGBA (con trasparenza)`);
  }
});

test("manifest: nome e permessi essenziali", () => {
  assert.equal(manifest.name, "Amazon SmartLink");
  for (const p of ["webRequest", "webRequestBlocking", "storage"]) {
    assert.ok(manifest.permissions.includes(p), p);
  }
});
