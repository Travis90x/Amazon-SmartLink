// Prove dello userscript Tampermonkey: il file generato viene eseguito in un contesto Node (modulo vm)
// con finti location, history, sessionStorage e GM_*. Si lanciano, dalla cartella del progetto, con: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { MARKETPLACES, AMAZON_HOSTS } = require("../src/cleaner.js");
const { build, outputPath } = require("../tools/build_userscript.js");

const SOURCE = fs.readFileSync(outputPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "manifest.json"), "utf8"));
const LAST_KEY = "amazonSmartLinkLastReload";
const CLEAN_IT = "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21";

/** Esegue lo userscript su un indirizzo e restituisce tutto quello che ha fatto. */
function run({ href, saved, session = {}, answers = [] }) {
  const url = new URL(href);
  const calls = { replace: [], replaceState: [], alerts: [], prompts: [], menu: [], intervals: [] };
  const storage = saved === undefined ? {} : { tags: JSON.parse(JSON.stringify(saved)) };
  const sessionStore = { ...session };
  const location = { href: url.href, hostname: url.hostname, hash: url.hash, replace: (u) => calls.replace.push(u) };
  const sandbox = {
    URL,
    location,
    history: { state: null, replaceState: (state, title, u) => calls.replaceState.push(u) },
    sessionStorage: {
      getItem: (key) => (key in sessionStore ? sessionStore[key] : null),
      setItem: (key, value) => { sessionStore[key] = String(value); },
    },
    GM_getValue: (key, fallback) => (key in storage ? storage[key] : fallback),
    GM_setValue: (key, value) => { storage[key] = JSON.parse(JSON.stringify(value)); },
    GM_registerMenuCommand: (label, fn) => calls.menu.push({ label, fn }),
    prompt: (message, defaultValue) => { calls.prompts.push({ message, defaultValue }); return answers.length ? answers.shift() : null; },
    alert: (message) => calls.alerts.push(message),
    setInterval: (fn, ms) => { calls.intervals.push({ fn, ms }); return calls.intervals.length; },
  };
  vm.runInNewContext(SOURCE, sandbox);
  return { calls, storage, sessionStore, location };
}

// --- Cosa fa con l'indirizzo aperto ---------------------------------------------------------

test("tag mancante: ricarica una volta l'indirizzo pulito con il tuo tag", () => {
  const r = run({ href: "https://www.amazon.it/Geox/dp/B08QMZZ6P3/?_encoding=UTF8&ref_=pd_hp&th=1&psc=1" });
  assert.deepEqual(r.calls.replace, [CLEAN_IT]);
  assert.equal(r.calls.replaceState.length, 0);
  assert.equal(r.calls.intervals.length, 0, "dopo il ricaricamento la pagina viene sostituita: niente controllo periodico");
  assert.equal(JSON.parse(r.sessionStore[LAST_KEY]).target, CLEAN_IT);
});

test("tag di un altro: ricarica con il tuo tag", () => {
  const r = run({ href: "https://www.amazon.it/dp/B08QMZZ6P3?tag=altro-21&th=1" });
  assert.deepEqual(r.calls.replace, [CLEAN_IT]);
});

test("richiesta già col tuo tag e parametri in più: nessun ricaricamento, si cambia solo l'indirizzo mostrato", () => {
  const r = run({ href: "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21&th=1&psc=1" });
  assert.equal(r.calls.replace.length, 0);
  assert.deepEqual(r.calls.replaceState, [CLEAN_IT]);
  assert.equal(r.calls.intervals.length, 1);
  assert.equal(r.calls.intervals[0].ms, 250);
});

test("indirizzo già pulito: non fa niente (ma controlla periodicamente)", () => {
  const r = run({ href: CLEAN_IT });
  assert.equal(r.calls.replace.length, 0);
  assert.equal(r.calls.replaceState.length, 0);
  assert.equal(r.calls.intervals.length, 1);
});

test("negozio senza tag: nessun ricaricamento, indirizzo ripulito anche del tag altrui", () => {
  const r = run({ href: "https://www.amazon.de/Titel/dp/B0CFPWLGF2/?th=1&tag=piattaforma-21&psc=1" });
  assert.equal(r.calls.replace.length, 0);
  assert.deepEqual(r.calls.replaceState, ["https://www.amazon.de/dp/B0CFPWLGF2"]);
});

test("tag salvati: amazon.de con tag si ricarica, amazon.it senza tag viene solo ripulito", () => {
  const saved = { de: "mio-de-21" };
  const de = run({ href: "https://www.amazon.de/dp/B0CFPWLGF2?th=1", saved });
  assert.deepEqual(de.calls.replace, ["https://www.amazon.de/dp/B0CFPWLGF2?tag=mio-de-21"]);
  const it = run({ href: "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21&th=1", saved });
  assert.equal(it.calls.replace.length, 0);
  assert.deepEqual(it.calls.replaceState, ["https://www.amazon.it/dp/B08QMZZ6P3"]);
});

test("il #frammento resta nell'indirizzo mostrato", () => {
  const r = run({ href: "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21&th=1#customerReviews" });
  assert.deepEqual(r.calls.replaceState, [CLEAN_IT + "#customerReviews"]);
});

test("protezione contro i giri infiniti: dopo un ricaricamento recente allo stesso indirizzo non si ricarica di nuovo", () => {
  const recent = JSON.stringify({ target: CLEAN_IT, time: Date.now() - 1000 });
  const blocked = run({ href: "https://www.amazon.it/dp/B08QMZZ6P3?tag=altro-21&th=1", session: { [LAST_KEY]: recent } });
  assert.equal(blocked.calls.replace.length, 0);
  assert.equal(blocked.calls.replaceState.length, 0, "non deve nemmeno mostrare un tag che la richiesta non aveva");
  const old = JSON.stringify({ target: CLEAN_IT, time: Date.now() - 60000 });
  const allowed = run({ href: "https://www.amazon.it/dp/B08QMZZ6P3?tag=altro-21&th=1", session: { [LAST_KEY]: old } });
  assert.deepEqual(allowed.calls.replace, [CLEAN_IT]);
});

test("pagine che non sono prodotti: non tocca niente", () => {
  for (const href of [
    "https://www.amazon.it/s?k=scarpe&crid=1",
    "https://www.amazon.it/gp/cart/view.html",
    "https://www.amazon.it/gp/product/handle-buy-box/ref=dp_start-bbf_1_glance",
    "https://www.amazon.it/",
  ]) {
    const r = run({ href });
    assert.equal(r.calls.replace.length, 0, href);
    assert.equal(r.calls.replaceState.length, 0, href);
    r.calls.intervals[0].fn();
    assert.equal(r.calls.replaceState.length, 0, href);
  }
});

test("controllo periodico: ripulisce se Amazon rimette th e psc, ma non ricarica mai", () => {
  const r = run({ href: CLEAN_IT });
  const tick = r.calls.intervals[0].fn;
  r.location.href = "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21&th=1&psc=1";
  tick();
  assert.deepEqual(r.calls.replaceState, [CLEAN_IT]);
  r.location.href = "https://www.amazon.it/dp/B08QMZZ6P3?tag=altro-21&th=1";
  tick();
  assert.equal(r.calls.replace.length, 0);
  assert.equal(r.calls.replaceState.length, 1, "con un tag diverso dal tuo non cambia l'indirizzo");
  r.location.href = "https://www.amazon.it/dp/B0CFPWLGF2/ref=twister?tag=piattaforma-21";
  tick();
  assert.deepEqual(r.calls.replaceState[1], "https://www.amazon.it/dp/B0CFPWLGF2?tag=piattaforma-21");
});

// --- Menu di Tampermonkey -------------------------------------------------------------------

test("menu: tre comandi, il primo con il nome del negozio aperto", () => {
  const r = run({ href: "https://www.amazon.de/dp/B0CFPWLGF2" });
  assert.deepEqual(r.calls.menu.map((m) => m.label), ["Set the tag for amazon.de", "Show all tags", "Edit all tags (JSON)"]);
});

test("menu: imposta il tag del negozio aperto", () => {
  const r = run({ href: "https://www.amazon.de/dp/B0CFPWLGF2", answers: ["  nuovo-de-21 "] });
  r.calls.menu[0].fn();
  assert.deepEqual(r.storage.tags, { it: "piattaforma-21", de: "nuovo-de-21" });
  assert.deepEqual(r.calls.alerts, ["Saved. Reload the page to apply it."]);
  assert.equal(r.calls.prompts[0].defaultValue, "");
});

test("menu: tag non valido o annullato non cambiano niente", () => {
  const bad = run({ href: "https://www.amazon.de/dp/B0CFPWLGF2", answers: ["tag&x=1"] });
  bad.calls.menu[0].fn();
  assert.equal("tags" in bad.storage, false);
  assert.deepEqual(bad.calls.alerts, ["Invalid tag: use 3 to 64 characters among letters, numbers, - . _"]);
  const cancelled = run({ href: "https://www.amazon.de/dp/B0CFPWLGF2", answers: [null] });
  cancelled.calls.menu[0].fn();
  assert.equal("tags" in cancelled.storage, false);
  assert.equal(cancelled.calls.alerts.length, 0);
});

test("menu: campo vuoto toglie il tag di quel negozio", () => {
  const r = run({ href: "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21", answers: [""] });
  assert.equal(r.calls.prompts.length, 0);
  r.calls.menu[0].fn();
  assert.equal(r.calls.prompts[0].defaultValue, "piattaforma-21");
  assert.deepEqual(r.storage.tags, {});
});

test("menu: mostra tutti i tag, uno per negozio", () => {
  const r = run({ href: "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21", saved: { it: "mio-it-21" } });
  r.calls.menu[1].fn();
  const lines = r.calls.alerts[0].split("\n");
  assert.equal(lines.length, MARKETPLACES.length);
  assert.equal(lines[0], "amazon.it: mio-it-21");
  assert.equal(lines[1], "amazon.de: (no tag, links only cleaned)");
});

test("menu: modifica di tutti i tag in JSON", () => {
  const ok = run({ href: "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21", answers: [JSON.stringify({ de: "mio-de-21", it: "mio-it-21" })] });
  ok.calls.menu[2].fn();
  assert.deepEqual(ok.storage.tags, { it: "mio-it-21", de: "mio-de-21" });
  assert.deepEqual(ok.calls.alerts, ["Saved. Reload the page to apply it."]);

  const cases = [
    ["{non json", "Not valid JSON: nothing was saved."],
    [JSON.stringify({ cn: "mio-cn-21" }), "Nothing was saved: unknown store: cn"],
    [JSON.stringify({ de: "tag&x=1" }), "Nothing was saved: invalid tag for amazon.de"],
    [JSON.stringify(["it"]), "Nothing was saved: not an object"],
  ];
  for (const [answer, message] of cases) {
    const r = run({ href: "https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21", answers: [answer] });
    r.calls.menu[2].fn();
    assert.equal("tags" in r.storage, false, answer);
    assert.deepEqual(r.calls.alerts, [message], answer);
  }
});

// --- Intestazione e file generato -----------------------------------------------------------

function headerLines() {
  const block = /\/\/ ==UserScript==\n([\s\S]*?)\/\/ ==\/UserScript==/.exec(SOURCE);
  assert.ok(block, "manca il blocco ==UserScript==");
  return block[1].split("\n").filter(Boolean).map((line) => {
    const m = /^\/\/ @(\S+)\s*(.*)$/.exec(line);
    assert.ok(m, `riga di intestazione non valida: ${line}`);
    return [m[1], m[2].trim()];
  });
}
const headerValues = (key) => headerLines().filter(([k]) => k === key).map(([, v]) => v);

test("intestazione: nome, versione uguale a quella del manifest, licenza, link", () => {
  assert.deepEqual(headerValues("name"), ["Amazon SmartLink"]);
  assert.deepEqual(headerValues("version"), [manifest.version]);
  assert.deepEqual(headerValues("license"), ["MIT"]);
  const raw = "https://raw.githubusercontent.com/Travis90x/Amazon-SmartLink/main/userscript/amazon-smartlink.user.js";
  assert.deepEqual(headerValues("downloadURL"), [raw]);
  assert.deepEqual(headerValues("updateURL"), [raw]);
  assert.equal(headerValues("description").length, 1);
  assert.equal(headerValues("description:it").length, 1);
});

test("intestazione: gli @match coincidono con l'estensione e con l'elenco dei negozi", () => {
  const expected = AMAZON_HOSTS.map((host) => `*://${host}/*`).sort();
  assert.deepEqual(headerValues("match").sort(), expected);
  assert.deepEqual([...manifest.content_scripts[0].matches].sort(), expected);
});

test("intestazione: permessi richiesti (solo i tre GM_), avvio anticipato, niente iframe", () => {
  assert.deepEqual(headerValues("grant").sort(), ["GM_getValue", "GM_registerMenuCommand", "GM_setValue"]);
  assert.deepEqual(headerValues("run-at"), ["document-start"]);
  assert.equal(headerValues("noframes").length, 1);
});

test("il file generato è aggiornato rispetto a template e cleaner.js", () => {
  assert.equal(SOURCE.replace(/\r\n/g, "\n"), build());
});

test("il file generato non contiene l'esportazione per Node né segnaposto rimasti", () => {
  assert.equal(SOURCE.includes("module.exports"), false);
  assert.equal(SOURCE.includes("@@"), false);
});
