/*
 * Genera userscript/amazon-smartlink.user.js da userscript/template.user.js, src/cleaner.js e src/manifest.json:
 *  - la logica di pulizia è quella di src/cleaner.js, incollata dentro lo script (un solo file, nessun download a runtime);
 *  - gli @match sono ricavati dall'elenco dei negozi di cleaner.js;
 *  - @version è la versione del manifest.
 * Uso, dalla cartella del progetto:
 *   node tools/build_userscript.js            scrive il file generato
 *   node tools/build_userscript.js --check    esce con errore se il file generato non è aggiornato
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const outputPath = path.join(root, "userscript", "amazon-smartlink.user.js");

function readText(...parts) {
  return fs.readFileSync(path.join(root, ...parts), "utf8").replace(/\r\n/g, "\n");
}

/** Costruisce il testo dello userscript. */
function build() {
  const { AMAZON_HOSTS } = require(path.join(root, "src", "cleaner.js"));
  const version = JSON.parse(readText("src", "manifest.json")).version;
  // La coda di cleaner.js esporta le funzioni per Node: dentro lo userscript non serve.
  const cleaner = readText("src", "cleaner.js").replace(/\nif \(typeof module[\s\S]*$/, "\n").trimEnd();
  const indentedCleaner = cleaner.split("\n").map((line) => (line === "" ? "" : "  " + line)).join("\n").trimStart();
  const matches = AMAZON_HOSTS.map((host) => `// @match        *://${host}/*`).join("\n");

  let text = readText("userscript", "template.user.js");
  for (const marker of ["// @@MATCHES@@", "@@VERSION@@", "// @@CLEANER@@"]) {
    if (text.split(marker).length !== 2) {
      throw new Error(`Il segnaposto ${marker} deve comparire una sola volta nel template`);
    }
  }
  text = text.replace("// @@MATCHES@@", () => matches);
  text = text.replace("@@VERSION@@", () => version);
  text = text.replace("// @@CLEANER@@", () => indentedCleaner);
  return text;
}

module.exports = { build, outputPath };

if (require.main === module) {
  const text = build();
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8").replace(/\r\n/g, "\n") : null;
    if (current !== text) {
      console.error("userscript/amazon-smartlink.user.js non è aggiornato: lancia node tools/build_userscript.js");
      process.exit(1);
    }
    console.log("userscript/amazon-smartlink.user.js è aggiornato");
  } else {
    fs.writeFileSync(outputPath, text, "utf8");
    console.log("scritto", path.relative(root, outputPath), "-", text.length, "caratteri");
  }
}
