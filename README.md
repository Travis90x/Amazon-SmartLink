🇮🇹 [Leggi il README in italiano](README_ITA.md)

# Amazon SmartLink

Cleans Amazon product links and adds your affiliate tag. When you open a product page on an Amazon store (amazon.it, amazon.de, amazon.fr, amazon.co.uk, amazon.com and more), the address becomes a clean link and, if you set a tag for that store, carries your affiliate tag.

```
https://www.amazon.it/Geox-SPHERICA-Scarpe-Ginnastica-C9997/dp/B08QMZZ6P3/?_encoding=UTF8&pd_rd_w=84gRT&...&tag=other-21&th=1&psc=1
                                  ↓
https://www.amazon.it/dp/B08QMZZ6P3?tag=piattaforma-21
```

The tag goes after `?`, not after `&`: with `&` it would end up inside the path and would not be a parameter.

It comes in two forms, with the same cleaning rules:

1. **[Tampermonkey](https://www.tampermonkey.net/) userscript (recommended).** It stays installed through Firefox updates and restarts.
2. **Firefox extension.** It rewrites the address before the request is sent, but on regular Firefox it can only be loaded temporarily and disappears at every restart (see "Why the extension is not on the Firefox store").

> **Status: version 1.0.0.** The cleaning logic has unit tests. The extension was run in a real Firefox on amazon.it and amazon.de. The userscript was run in a real Firefox with a stand-in for Tampermonkey's `GM_*` functions, and then installed in Tampermonkey, where the author confirmed it works.

## Install the userscript (recommended)

1. Install [Tampermonkey](https://www.tampermonkey.net/) in Firefox.
2. Install the script in one of these two ways.

**From the link (the simplest).** Open [`amazon-smartlink.user.js`](userscript/amazon-smartlink.user.js) in "Raw" view (or the address below) and confirm the installation in Tampermonkey. If the script is already installed, Tampermonkey offers the update.

**With "Install from URL" (useful when the link does not open the installation page).**
1. Open Tampermonkey and go to **Utilities**.
2. Paste this address in the **Install from URL** field:
   `https://raw.githubusercontent.com/Travis90x/Amazon-SmartLink/main/userscript/amazon-smartlink.user.js`
3. Click **Install** and confirm.

Tampermonkey checks the same address for updates.

**Tags.** Click the Tampermonkey icon while you are on an Amazon store: under *Amazon SmartLink* there are three commands.

| Command | What it does |
| --- | --- |
| **Set the tag for amazon.&lt;store&gt;** | Sets (or, if left empty, removes) the tag of the store you are on. |
| **Show all tags** | Lists the tag of every store. |
| **Edit all tags (JSON)** | Edits all the tags at once, for example `{"it": "your-tag-21", "de": "your-de-21"}`. |

A change applies after you reload the page. The tags are kept by Tampermonkey.

**How it works.** The script runs as soon as the page starts loading, looks at the address of a product page and decides:
- the page was loaded **without your tag** (missing, or someone else's): it reloads the page once, at the clean address `/dp/ASIN?tag=YOUR-TAG`, so Amazon receives your tag;
- the page was **already loaded with your tag**, or the store has **no tag**: it only changes the address shown in the address bar, with no reload;
- afterwards it checks the address every 250 ms, because Amazon puts `th=1&psc=1` back after the page loads and changes the address when you pick a variant.

It never reloads to the same address twice within 10 seconds, so it cannot loop.

## Install the Firefox extension

1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on…" and choose `src\manifest.json` (from a clone of this repository), or the zip you can download from the [Releases](https://github.com/Travis90x/Amazon-SmartLink/releases) page (do not unzip it).
3. It stays active until Firefox is restarted.

Settings are in `about:addons` → Amazon SmartLink → Preferences. The tags are shared across your Firefox installs if you turned on add-on sync.

### Why the extension is not on the Firefox store
Mozilla's Add-on Policies (section 7, Monetization) do not allow modifying web content or redirecting to insert affiliate tags, and they apply to extensions distributed outside the store as well. Regular Firefox only installs extensions signed by Mozilla, so a permanent install is not provided. Alternatives: Firefox Developer Edition, Nightly or ESR with `xpinstall.signatures.required` set to `false` in `about:config`, or the userscript above.

## Supported stores
amazon.it, .de, .fr, .es, .co.uk, .com, .nl, .se, .pl, .com.be, .ie, .ca, .com.au, .co.jp, .in, .com.br, .com.mx, .ae, .sa, .sg, .com.tr, .eg, .co.za (with and without `www.`).

## One tag per store
Affiliate tags belong to a single country: the tag of amazon.it is not valid on amazon.de. Both forms keep one tag per store.
- amazon.it starts with `piattaforma-21`; the other stores start empty.
- A store with no tag only gets cleaned (`https://www.amazon.de/dp/ASIN`): the project never puts another country's tag, or anyone else's, on a link.
- A tag already present in the link is replaced by yours; for a store with no tag it is removed from the address.
- Observed in testing (4 out of 4 runs of the extension, from Italy, with made-up test tags): opening an `amazon.de` link that carries a tag, Amazon itself redirected to `amazon.it`, where the tag of amazon.it is applied. That is Amazon's behaviour, not this project's, and it is not guaranteed. With no tag set for that store, Amazon stays on `amazon.de`.

## What it does and does not do
- It acts only on product pages (`/dp/ASIN`, `/gp/product/ASIN`, `/gp/aw/d/ASIN`, `/product/ASIN`, `/exec/obidos/ASIN/ASIN`).
- It removes every parameter (`ref_`, `pd_rd_*`, `th`, `psc`…) and the product title in the path; only `?tag=` is kept.
- Search, cart, account, orders and other sites are left alone.
- A `#fragment` alone never triggers a redirect.

| | Userscript | Extension |
| --- | --- | --- |
| Survives Firefox updates and restarts | Yes | No (temporary), except on Developer Edition, Nightly or ESR |
| Request that carries the tag | A reload when your tag is missing: the first request goes out with the original link | A single request: the address is rewritten before it is sent |
| Which requests it handles | The page being loaded (it runs inside the page) | Only GET navigations: POST requests are never touched |
| Tags and settings | Tampermonkey menu | Options page |

## Layout
- `userscript/amazon-smartlink.user.js` — the Tampermonkey userscript. It is generated: do not edit it by hand.
- `userscript/template.user.js` — the userscript's own logic (header, menu, decisions); `tools/build_userscript.js` combines it with `src/cleaner.js` and writes the userscript (`node tools/build_userscript.js`, or `--check` to verify it is up to date).
- `src/cleaner.js` — pure logic shared by both forms (no browser APIs): list of stores, product page detection, clean link construction.
- `src/background.js` — extension: intercepts requests (`webRequest`, blocking) and redirects.
- `src/pagecleaner.js` — extension page script: tidies the address bar after the page loads.
- `src/options.html`, `src/options.js` — extension options page.
- `src/icons/` — icons (PNG 16, 32, 48, 96, 128 and the SVG source), generated by `tools/make_icons.py` (`python -I tools/make_icons.py`, no external libraries).
- `test/` — tests for `cleaner.js`, for the manifest and for the userscript: from the project folder, run `node --test`.

## Origin
The idea comes from [AmazonAffiliateTagger](https://github.com/DorianGrey11/AmazonAffiliateTagger) (GPL v3, only adds the tag). The code is written from scratch, without copying it.

## License
[MIT](LICENSE).
