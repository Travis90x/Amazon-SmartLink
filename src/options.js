/*
 * options.js — pagina delle opzioni: legge e salva un tag affiliato per ogni negozio Amazon.
 * cleaner.js è caricato prima (vedi options.html) e fornisce MARKETPLACES, parseTag, resolveTags.
 */

const storesBox = document.querySelector("#stores");
const statusLine = document.querySelector("#status");

// Una riga (etichetta + campo) per negozio, costruita dall'elenco di cleaner.js.
function buildFields() {
  for (const market of MARKETPLACES) {
    const label = document.createElement("label");
    label.textContent = `amazon.${market}`;
    label.htmlFor = `tag-${market}`;
    const input = document.createElement("input");
    input.type = "text";
    input.id = `tag-${market}`;
    input.dataset.market = market;
    input.autocomplete = "off";
    input.spellcheck = false;
    storesBox.append(label, input);
  }
}

async function restoreOptions() {
  const tags = resolveTags(await browser.storage.sync.get(["tags", "tag"]));
  for (const input of storesBox.querySelectorAll("input")) {
    input.value = tags[input.dataset.market] ?? "";
  }
}

async function saveOptions(event) {
  event.preventDefault();
  const tags = {};
  for (const input of storesBox.querySelectorAll("input")) {
    const value = input.value.trim();
    if (value === "") {
      continue;
    }
    if (parseTag(value) === null) {
      statusLine.textContent = `Invalid tag for amazon.${input.dataset.market}: use 3 to 64 characters among letters, numbers, - . _`;
      return;
    }
    tags[input.dataset.market] = value;
  }
  await browser.storage.sync.set({ tags });
  await browser.storage.sync.remove("tag");
  statusLine.textContent = "Saved.";
}

buildFields();
document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("#form").addEventListener("submit", saveOptions);
