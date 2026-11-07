/*
 * options.js — pagina delle opzioni: legge e salva il tag affiliato.
 * cleaner.js è caricato prima (vedi options.html) e fornisce normalizeTag, TAG_PATTERN, DEFAULT_TAG.
 */

const tagInput = document.querySelector("#tag");
const statusLine = document.querySelector("#status");

async function restoreOptions() {
  const stored = await browser.storage.sync.get("tag");
  tagInput.value = normalizeTag(stored.tag);
}

async function saveOptions(event) {
  event.preventDefault();
  const value = tagInput.value.trim();

  if (value === "") {
    await browser.storage.sync.set({ tag: DEFAULT_TAG });
    tagInput.value = DEFAULT_TAG;
    statusLine.textContent = `Campo vuoto: uso il tag predefinito ${DEFAULT_TAG}.`;
    return;
  }
  if (!TAG_PATTERN.test(value)) {
    statusLine.textContent = "Tag non valido: servono da 3 a 64 caratteri tra lettere, numeri, - . _";
    return;
  }
  await browser.storage.sync.set({ tag: value });
  statusLine.textContent = "Salvato.";
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("#form").addEventListener("submit", saveOptions);
