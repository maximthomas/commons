# Dual build for `commons/ui/commons` — ESM + AMD from one source

Discovery only. Nothing was implemented, nothing was chosen. `mvn` was never run.
Companion to `LIBS-INVENTORY.md` (task 3.1), which this file depends on for npm names.

Everything below is from the checkout at `/home/maxim/Documents/_projects/forgerock/commons/ui`,
the consumer at `/home/maxim/Documents/_projects/forgerock/OpenAM/openam-ui/openam-ui-ria`, and a
throwaway r.js/RequireJS spike that has since been deleted.

---

## 0. The three facts everything else follows from

1. **A consumer composes commons by flat file overlay, not by import.**
   `openam-ui-ria/Gruntfile.js:46-52` — `buildCompositionDirs` is
   `["target/dependencies", "target/dependencies-expanded/forgerock-ui-user", "./src/main/js", "./src/main/resources"]`,
   and `copy:compose` (`:125-134`) copies each with `src: ["**"]` into one `target/XUI`.
   The comment on line 50 is load-bearing: *"This must come last so that it overwrites any
   conflicting files!"*. The AMD module id of a commons file **is** its path relative to that
   composition root, because `requirejs.compile.options.baseUrl` is `target/transpiled`
   (`Gruntfile.js:245`), which mirrors `target/XUI` one-for-one through babel.

2. **Most of what commons ships is not JavaScript and cannot be reached through a module id.**
   Templates are fetched at runtime by URL: `UIUtils.js:38` is
   `$.ajax({ type: "GET", url: require.toUrl(url), dataType: "html" })`, called with strings like
   `"templates/common/404.html"`. Less files are pulled in by flat path: openam's
   `src/main/resources/css/structure.less:29` is `@import "common/structure.less"`, resolved against
   the composition dir. Neither can come out of `node_modules` without a copy step.

3. **The library set is declared entirely by `commons/ui/commons/pom.xml`, not by `user`.**
   `LIBS-INVENTORY.md` §5: `commons/ui/user/pom.xml` declares zero `ui.libs` dependencies; all 25
   `libs/*.js` files that reach openam-ui-ria via `user:zip:www` originate in the commons pom and are
   merely re-emitted by user's own `ui.libs:*:js` `dependencySet`.

---

## 1. PAYLOAD — what commons contributes, split from what user adds

`OpenAM/openam-ui/openam-ui-ria/target/dependencies-expanded/forgerock-ui-user` exists and holds
**213 files** (the task brief said 211; the extra two are in `css/fontawesome`). It is
`commons:zip:www` unpacked by `user`, plus user's own resources, plus the Maven `dependencySet`
output. The split is exact — 128 + 45 + 40 = 213:

| top-level dir | total in combined tree | from **commons** | from **user** | from Maven `ui.libs` artifacts |
|---|---:|---:|---:|---:|
| `org/` | 72 | **60** (`org/forgerock/commons/ui/common/**`) | 12 (`org/forgerock/commons/ui/user/**`) | 0 |
| `config/` | 7 | **5** | 2 | 0 |
| `css/` | 52 | **37** (36 `.less` + `common/structure/config.json`) | 0 | 15 (7 lib `.css`/`.less` + 8 unpacked font-awesome) |
| `templates/` | 40 | **14** (all under `common/`) | 26 | 0 |
| `partials/` | 5 | **1** (`providers/_providerButton.html`) | 4 | 0 |
| `images/` | 9 | **9** | 0 | 0 |
| `locales/` | 1 | 0 | 1 (`en/translation.json`) | 0 |
| `libs/` | 25 | 0 files of its own — but **all 25 are declared by `commons/pom.xml`** | 0 | 25 |
| `favicon.ico` | 1 | **1** | 0 | 0 |
| `oauthReturn.html` | 1 | **1** | 0 | 0 |
| **total** | **213** | **128** | **45** | **40** |

Commons' own source is `128` files: `src/main/js` (65 `.js`) + `src/main/resources` (36 `.less`,
16 `.html`, 9 `.png`, 1 `.json`, 1 `.ico`).

### Does it belong in the npm package?

| dir | in the package? | why / where else it comes from |
|---|---|---|
| `org/forgerock/commons/ui/common/**` (60 js) | **yes** — this is the package | the only part with module ids; both an `amd/` and an `esm/` tree would carry it |
| `config/` (5 js) | **open, see §6** | they are *product configuration fragments*, not library code. Openam's `config/main.js` aggregates them by id |
| `css/` (37 less) | **yes as files, no as modules** | `@import`ed by literal composition-relative path from the product's `structure.less`/`theme.less`. Package can carry them, but a consumer must still copy them onto a less include path — a `paths` entry does nothing for less |
| `templates/` (14 html) | **yes as files, no as modules** | runtime `$.ajax(require.toUrl("templates/…"))`. Must exist at the deployed web root. Copy step only |
| `partials/` (1 html) | same as templates | Handlebars partial registered from a URL |
| `images/` (9 png) | **yes as files** | referenced from less/html by relative URL; must be at the web root |
| `favicon.ico`, `oauthReturn.html` (2) | **arguably not** | web-root artefacts of an *app*, not of a library. Today the consumer gets them only because the overlay is indiscriminate. If dropped from the package, each product supplies its own |
| `libs/` (25 js) | **no files, but yes as declarations** | see §5 |
| `locales/` | **no** | user module, not commons |

**The package boundary that follows:** an npm package can carry all 128 files, but only the 60 `org/`
files are consumable *as modules*. The remaining 68 (`css/ templates/ partials/ images/` + 2 root
files) are consumable only by being copied into the consumer's composition directory. That is not an
argument against shipping them — it is the reason a `paths`-only integration (§2) cannot replace the
copy step, and why any consumer keeps a copy step regardless of what the JS build emits.

---

## 2. MODULE IDS — the define style, and how an AMD consumer reaches the build

### Define style census (all 65 js files)

| | count | files |
|---|---:|---|
| anonymous `define([...], function () {})` | **63** | — |
| **named** `define("id", [...], …)` | **2** | `org/forgerock/commons/ui/common/main.js`, `org/forgerock/commons/ui/common/main/i18nManager.js` |
| `define(function () {})` with no dep array | 0 | — |
| no `define` at all | 0 | — |

`main.js` is **not** the only named define. `main/i18nManager.js:17` is the second:
`define( "org/forgerock/commons/ui/common/main/i18nManager", [ … ]`. Confirmed by grepping for
`define\s*\(\s*["']` across all 65 — exactly two hits.

Other shape facts that constrain both builds:

| trait | count | files |
|---|---:|---|
| `./`-relative deps | 2 | `common/main.js` (12 of them), `common/util/OAuth.js` (`./URIUtils`) |
| bare **injected** ids with no file in commons | 26 | `underscore` ×25, `ThemeManager` ×2 (`main/AbstractView.js`, `util/UIUtils.js`), `NavigationFilter` ×1 (`components/Navigation.js`), `placeholder` ×1 (`LoginView.js`), `config/AppConfiguration` ×1 (`main/Configuration.js`) |
| AMD pseudo-deps `require` / `module` | 2 | `main/i18nManager.js` (`require`,`module`), `util/UIUtils.js` (`require`) |
| `require.toUrl(...)` | 2 | `main/i18nManager.js:83`, `util/UIUtils.js:38` |
| dynamic `require([...], cb)` | 2 | `main/ViewManager.js:76`, `util/ModuleLoader.js:26` |
| returns nothing (side-effect module) | 1 | `common/main.js` |
| arrow functions | 2 | `util/UIUtils.js`, `util/OAuth.js` |
| template literals / JSX-ish React | 1 / 2 | `components/hoc/withRouter.js`; + `main/ReactAdapterView.js` |
| `.jsm` / `.jsx` files | **0** | commons is 100% `.js` AMD today |

### HOW AN AMD CONSUMER REACHES THE BUILD OUT OF `node_modules`

**Answer: a RequireJS `paths` prefix entry — and it must be narrow (`org/forgerock/commons/ui/common`),
not `org/forgerock/commons`. Or a copy step, which is what the build already does. `package.json`
`"exports"` is never read.**

Proved with a throwaway spike (now deleted): a fake package
`node_modules/@oip/forgerock-ui-commons/amd/org/forgerock/commons/ui/common/…` containing one
anonymous define, one named define, and one named `main.js` with `./`-relative deps, plus a
deliberately **bogus** `package.json` (`"main": "./THIS-FILE-DOES-NOT-EXIST.js"`,
`"exports": {".": "./THIS-FILE-DOES-NOT-EXIST.js", "./*": "./esm/*"}`). Driven by
`OpenAM/openam-ui/openam-ui-ria/node_modules/requirejs` (2.3.7 — the same version the build uses) in
Node for the runtime cases, and `node_modules/requirejs/bin/r.js -o` for the build case.

| # | setup | result |
|---|---|---|
| A | `baseUrl` only, no `paths`. Valid `exports` field present | **FAILS.** `Tried loading "org/forgerock/commons/ui/common/main/Router" at <app>/org/forgerock/commons/ui/common/main/Router.js then tried node's require(...)`. The loader concatenates baseUrl + id and never consults `package.json`. **This is the proof that `"exports"` is not the answer** |
| B | `paths: { "org/forgerock/commons/ui/common": "<pkg>/amd/org/forgerock/commons/ui/common" }` | **RESOLVES.** Anonymous define, both named defines, and the `./`-relative deps inside `main.js` all resolve. Works with an absolute value and with a `../`-relative one |
| C | broad `paths: { "org/forgerock/commons": "<pkg>/amd/org/forgerock/commons" }` | **BREAKS THE `user` MODULE.** `org/forgerock/commons/ui/user/profile/UserProfileView` is then looked for *inside the commons package* and fails. The prefix has to stop at `…/ui/common`, or a second, more specific entry `"org/forgerock/commons/ui/user": "org/forgerock/commons/ui/user"` has to point back at baseUrl. Both variants were tested and both fix it |
| D | r.js optimizer, `mainConfigFile` pointing at a `main.js` carrying the narrow `paths` entry | **BUILDS.** Trace log lists the `node_modules` files; the emitted bundle contains `define("org/forgerock/commons/ui/common/main")`, `define("org/forgerock/commons/ui/common/main/i18nManager")`, `define('org/forgerock/commons/ui/common/main/Router')` — **ids intact**. Paths pointing outside `baseUrl` are fine for r.js |
| E | copy the package's `amd/` tree into the composition dir *before* the product's own files, no `paths` at all | **RESOLVES**, and the product's own same-path file wins |

Two costs of the `paths` route, both measured, not reasoned:

- **`paths` defeats the last-wins overlay.** With a product file at
  `src/main/js/org/forgerock/commons/ui/common/main/Router.js` present *and* a `paths` entry active,
  the loader returned the **package's** Router, and r.js inlined the **package's** body. Today that
  product file would win. Currently nothing exercises this: `comm -12` between commons' source file
  list and openam-ui-ria's finds **zero** colliding paths in both `src/main/js` and
  `src/main/resources`. But the *user* module is actively shadowed by openam-ui-ria in 5 places
  (`locales/en/translation.json`, `templates/user/UserProfileTemplate.html`,
  `templates/user/process/registration/userDetails-initial.html`,
  `templates/user/process/reset/resetStage-initial.html`,
  `templates/user/process/reset/userQuery-initial.html`), so the override mechanism is in real use in
  the neighbouring package.
- **`paths` skips babel.** `babel.transpileJS` (`Gruntfile.js:95-102`) transpiles `target/XUI/**/*.js`
  into `target/transpiled`. Files reached through `paths` from `node_modules` are never in
  `target/XUI`, so they reach the browser untranspiled. Commons has arrow functions in 2 files, a
  template literal in 1, and React `createElement` in 2 — so a pre-transpiled `amd/` in the package,
  or a copy step, is required, not optional.

### The two named defines pin the id prefix

Spike, same run: with `paths: { "vendor/commons": "<pkg>/amd/org/forgerock/commons/ui/common" }` —

- `vendor/commons/main/Router` (anonymous) → **resolves**. Anonymous defines are relocatable.
- `vendor/commons/main/i18nManager` (named) → **resolves to `undefined`, with no error**. The file
  registers itself under its declared id; the requested id never gets a value. A silent `undefined`
  is worse than a load failure.

So the AMD build must keep the literal `org/forgerock/commons/ui/common/**` id space, or those two
files must lose their hardcoded names first.

---

## 3. SOURCE DIRECTION — two candidates, side by side, no recommendation

### (a) AMD stays the source, ESM is generated from it

| | |
|---|---|
| **tool** | No single obvious one. Candidates: `@buxlabs/amd-to-es6`, `amdtoes6`, or a hand-written `jscodeshift`/`recast` codemod. A rollup `format: "es"` pass over AMD input needs a plugin rollup does not ship |
| **present in this workspace?** | **No.** Checked every installed `node_modules` across the workspace: `amd-to-es6`, `amdtoes6`, `@buxlabs/amd-to-es6`, `jscodeshift`, `recast` — all **absent**. `rollup` exists only in `openam-react-example`, `vite`/`esbuild` only in `openam-ui`/`openam-ui-js-sdk`, neither wired to commons. A new build-time dependency is unavoidable |
| **files changed** | **0 source files.** The 65 stay exactly as they are; the ESM tree is generated output |
| **module ids** | Untouched on the AMD side — the AMD build can be a straight copy of `src/main/js`, so ids, the 2 named defines, `require.toUrl`, dynamic `require([...])` and the `./`-relative deps all keep working unchanged. Existing AMD consumers see byte-identical behaviour |
| **what the generator has to solve** | The 26 injected bare ids have no ESM answer inside commons: `underscore` (25 files) is a product-side `map` alias to `lodash`; `ThemeManager` (2), `NavigationFilter` (1), `config/AppConfiguration` (1) and `placeholder` (1) are supplied by the *product*, not by any file in commons. ESM resolves statically, so each becomes a bare specifier the ESM consumer must alias (bundler alias / import map). `require.toUrl` (2 files) and dynamic `require([...])` (2 files) have no ESM equivalent at all — 4 files need hand-written ESM shims |
| **diff a reviewer reads** | Small and boring: one build config + a generator invocation + `.gitignore`/package plumbing. **Zero diff in the 65 files.** Review effort concentrates on whether the generated ESM is correct, which is a *test* problem, not a *reading* problem — and there is no ESM consumer in the workspace yet to test against |

### (b) The 65 files are converted to ESM, AMD is generated from that

| | |
|---|---|
| **tool** | `@babel/plugin-transform-modules-amd` |
| **present in this workspace?** | **Yes** — `OpenAM/openam-ui/openam-ui-ria/node_modules/@babel/plugin-transform-modules-amd`, and `Gruntfile.js:103-116` (`babel.transpileJSM`) already runs it over openam-ui-ria's 31 `.jsm` + 15 `.jsx` files. **That is evidence about (b)'s generator and about nothing else** — it says the plugin works in this codebase; it says nothing about whether commons should flip |
| **files changed** | **65 of 65.** Every `define([...], function (...) {...})` header and every `return` becomes `import`/`export default`. Plus: the 2 named defines must be de-named (their id then has to come from the file path, see below), `common/main.js`'s 12 `./`-relative deps become 12 `import`s of a module that exports nothing, and the 4 files using `require.toUrl`/dynamic `require([...])` need a different mechanism |
| **module ids** | **This is the sharp edge.** The plugin emits an **anonymous** `define([...], …)` by default, which is what path-based ids need. But `moduleIds: true` — the only way to get a named define back — produced `define("org/forgerock/commons/ui/common//tmp/.../esm/Sample", …)` in the spike: it concatenates `moduleRoot` with the *filename as given*, so getting the two currently-named files back to their exact ids needs a custom `getModuleId`, not a flag. Alternatively de-name them, which is a behaviour change to verify against r.js bundling |
| **the interop break** | Measured, not reasoned. A commons module written as `export default Widget` and run through the plugin, then loaded by a **plain AMD consumer** (`define(["…/Widget"], function (Widget) {…})`), delivers `{"default":{…},"__esModule":true}`. `typeof Widget.routeTo` → **`undefined`**; `typeof Widget.default.routeTo` → `function`. Every existing AMD call site in openam-ui-ria, openidm-ui and openig-ui that names a commons module would have to add `.default`, or the AMD emit needs a non-default post-processing step. This is the dominant cost of (b) and it lands in **consumer** repos, not in commons |
| **diff a reviewer reads** | 65 files, every one of them touched in its header and its tail, mixed in with the real semantic questions (the 26 injected ids, the 4 loader-API files, the 2 named defines). A reviewer cannot mechanically skim it, because the mechanical parts and the judgement parts are in the same hunks |

**The tradeoff in one line each.** (a) buys a zero-line source diff and byte-identical AMD behaviour
for three existing consumers, at the price of a build-time dependency this workspace does not have
and a generated ESM tree nobody consumes yet. (b) buys a modern source of truth and a generator
already proven in this codebase, at the price of rewriting all 65 files and an `__esModule` interop
shape that changes what every existing AMD consumer receives.

**NOT PICKED.** Both remain open. The choice is the user's.

---

## 4. PRODUCT REFERENCES

`openam-ui-ria/src/main/js/main.js:18-35` declares `require.config.map["*"]` with exactly **12**
logical names: `Footer`, `ThemeManager`, `LoginView`, `UserProfileView`, `ForgotUsernameView`,
`PasswordResetView`, `LoginDialog`, `NavigationFilter`, `Router`, `RegisterView`, `KBADelegate`,
`underscore`.

### Commons files that resolve one of those logical names

Two senses, both listed because both matter.

**(i) Commons files that are the *target* of a map entry** — i.e. the file a logical name resolves to:

| logical name | maps to | lives in |
|---|---|---|
| `Router` | `org/forgerock/commons/ui/common/main/Router` | **commons** — `src/main/js/org/forgerock/commons/ui/common/main/Router.js` |
| `UserProfileView` | `org/forgerock/commons/ui/user/profile/UserProfileView` | **`commons/ui/user`, not `commons/ui/commons`** |
| `underscore` | `lodash` | a lib, not a commons file |

The other 9 map to `org/forgerock/openam/…` paths — product files. So exactly **one** commons file is
a map target: `main/Router.js`.

**(ii) Commons files that *depend on* a logical name**, and so are the reason the map exists:

| logical name | commons files that declare it as an AMD dep |
|---|---|
| `ThemeManager` | `org/forgerock/commons/ui/common/main/AbstractView.js:26`, `org/forgerock/commons/ui/common/util/UIUtils.js:24` |
| `NavigationFilter` | `org/forgerock/commons/ui/common/components/Navigation.js:27` |
| `underscore` | 25 files (every module that uses `_`) |

Three more appear as **configuration data strings**, not AMD deps — commons names them so the product
can bind them, which is the same seam by a different route:
`config/process/CommonConfig.js:73` (`"Footer"`), `config/process/CommonConfig.js:420` and
`config/routes/CommonRoutesConfig.js:51` (`"LoginDialog"`), `config/routes/CommonRoutesConfig.js:40`
(`view: "LoginView"`).

### Commons files that name a PRODUCT module path directly

**none.**

`grep -rnE "org/forgerock/(openam|openidm|openig|openaz)"` over **all** of
`commons/ui/commons/src/main` (js, html, less, json — not just js) returns zero hits. A full parse of
every `define([...])` dep array across the 65 files yields 66 distinct dep strings, of which the
non-`org/forgerock/commons/` ones are libs (`jquery`, `lodash`, `backbone`, `handlebars`, `i18next`,
`moment`, `react`, `react-dom`, `spin`, `xdate`, `dragula`, `bootstrap-dialog`, `backgrid*`,
`placeholder`), AMD pseudo-deps (`require`, `module`), the injected logical names above, and
`config/AppConfiguration`. **The capability requirement holds today.**

One near-miss worth recording so it is not mistaken for a violation later: three strings that look
like references to files commons does not ship — `partials/headers/_Title.html`,
`templates/main.html`, `templates/MyTemplate.html` — are all inside **JSDoc comments**
(`util/UIUtils.js:170`, `main/AbstractView.js:68`, `util/BackgridUtils.js:315`). No runtime path
depends on them.

---

## 5. LIB DEPENDENCIES — the 25 in `libs/`

All 25 are declared in `commons/ui/commons/pom.xml:116-316`; `user` declares none
(`LIBS-INVENTORY.md` §5). The same pom also declares the 7 `css`/`less` artifacts that land in `css/`
and the `font-awesome:zip` unpacked to `css/fontawesome/`. npm names below are **taken from**
`LIBS-INVENTORY.md`, not re-derived.

The classification turns on one question: **does the consumer's RequireJS `paths` block, not
commons, decide which file is bound?** For every one of the 25 the answer is yes — openam-ui-ria's
`main.js:36-81` names a specific `libs/<file>` for each id, and for two of them
(`handlebars`, `selectize`) it deliberately binds a *different* file than the one commons ships
(`LIBS-INVENTORY.md` §5, "Two collisions"). That is what makes `peerDependencies` the structurally
honest answer and `dependencies` the dangerous one.

| # | artifactId | npm name (from inventory) | proposed | what breaks under the other answers |
|---|---|---|---|---|
| 1 | backbone | `backbone@1.1.2` | **peer** | as `dep`: npm may install a second copy nested under commons; two Backbones means two `Backbone.Model` identities and `instanceof` failures across the commons/product boundary |
| 2 | backbone-relational | `backbone-relational@0.9.0` | **peer** | patches `Backbone` in place — a nested copy patches the wrong object |
| 3 | backbone.paginator.min | `backbone.paginator@2.0.2` | **peer** | same, extends `Backbone.PageableCollection` |
| 4 | backgrid.min | `backgrid@0.3.5` | **peer** | product's `backgrid-*` add-ons bind against the product's Backgrid |
| 5 | backgrid-paginator.min | `backgrid-paginator@0.3.5` (Cloudflare fork build) | **peer** | openam already binds `backgrid.paginator` to its own `-custom` file instead — a hard `dep` would fight that |
| 6 | backgrid-filter.min | `backgrid-filter@0.3.7` | **peer** | as #4 |
| 7 | backgrid-select-all | `backgrid-select-all@0.3.5` | **peer** | as #4 |
| 8 | bootstrap (`custom` js) | `bootstrap@3.3.5` (classifier is a misnomer, §7) | **peer** | jQuery plugin — must attach to the product's single `$` |
| 9 | bootstrap-dialog | `bootstrap3-dialog@1.35.1` (**version bump**, 1.34.4 never published) | **peer** | the bump is a real behaviour delta; forcing it as a `dep` decides for the product |
| 10 | dragula | `dragula@3.6.7` | **peer**, or **drop** | inventory §9 marks it **dead in OpenAM** — zero references in openam-ui-ria. Commons ships it for a consumer that no longer uses it |
| 11 | form2js | **none** — pinned git commit `maxatwork/form2js@769718a` | **consumer's problem, unresolved** | one of the inventory's 8 no-npm-equivalent rows. `dep` is impossible; `peer` names a package that does not exist. Requires the (V)endor / (R)eplace decision the inventory leaves open |
| 12 | handlebars | `handlebars@4.7.7` | **peer** | **collision**: openam ships a second `handlebars-4.7.7-min.js` that is really 4.7.6, and `main.js` binds the commons-side non-min file. A `dep` pins the wrong one |
| 13 | i18next | `i18next@1.7.3` | **peer** | 25 majors behind current; commons must not force the version on a product ready to move |
| 14 | jquery | `jquery@3.7.1` | **peer** | the textbook peer case: two jQuerys = two plugin registries and two event systems |
| 15 | jquery.ba-dotimeout | **none** — never on npm | **consumer's problem, unresolved** | no-npm-equivalent row |
| 16 | jquery.placeholder | `jquery-placeholder@2.1.1` (**bump**, 2.0.8 never published) | **peer**, or **drop** | inventory §9: **dead in OpenAM**, bound by no `paths` entry. Only `LoginView.js` names `placeholder` |
| 17 | js2form | **none** — sibling file of #11, same git commit | **consumer's problem, unresolved** | no-npm-equivalent row |
| 18 | lodash | `lodash@3.10.1` | **peer** | and the sharpest one: the product's `map` aliases `underscore → lodash`, and 25 commons files depend on `underscore`. A nested lodash would be a *third* identity |
| 19 | moment | `moment@2.28.0` | **peer** | locale registration is global |
| 20 | react | `react@15.2.1` | **peer** | **the canonical peer**: two Reacts break hooks/context/`instanceof` across the boundary. 4 commons files use React |
| 21 | react-dom | `react-dom@15.2.1` | **peer** | must match the React it renders with, exactly |
| 22 | requirejs | `requirejs@2.3.7` | **consumer's problem** | the *loader itself*, loaded by a plain `<script>` from the product's `index.html:28`, and already in openam-ui-ria `devDependencies`. A library never ships its own loader |
| 23 | selectize | `selectize@0.12.1` | **peer**, or **drop** | **collision**: openam binds `selectize-non-standalone-0.12.1-min` (identical bytes) instead; the commons-shipped file is **dead** in OpenAM (§9) |
| 24 | spin | `spin.js@2.0.1` (**artifactId→package rename**) | **peer** | low risk, but nothing makes it a `dep` either |
| 25 | xdate | `xdate@0.8.0` | **peer** | artifact is unminified source despite a `min` classifier (§7) |

Plus the 8 non-`libs/` artifacts commons declares that land in `css/`:
`backgrid.min:less` (**no npm equivalent at all** — a third-party personal repo on an unpinned
`master`), `backgrid-paginator.min:css`, `backgrid-filter.min:css`, `bootstrap:custom:css`,
`titatoggle:min:css` (**bump** 1.2.6 → 1.2.14), `selectize:bootstrap3:css`,
`bootstrap-dialog:min:css`, `font-awesome:zip`. These are **not modules**; they are less/css inputs
the product `@import`s by flat path. Whatever their npm status, they still have to be *copied* into
the composition dir, so declaring them in `dependencies` does not by itself deliver them.

**What breaks under each blanket answer:**

- **All 25 as `dependencies`** — npm's nesting semantics let a version conflict silently produce two
  copies of jQuery, lodash, Backbone or React. For a UI library composed by flat overlay into one
  global namespace, that is not a subtle bug, it is a broken page. It also hard-pins commons'
  consumers to versions the inventory shows are 1–25 majors stale.
- **All 25 as `peerDependencies`** — structurally correct and matches how RequireJS `paths` already
  works (one binding, chosen by the product). Cost: 4 of the 25 (`form2js`, `js2form`,
  `jquery.ba-dotimeout`, and — for the css side — `backgrid.min:less`) name packages that **do not
  exist on npm**, so a peer range cannot be written for them until the inventory's open decision #1
  is made. Also, a peer with no `devDependency` counterpart means commons cannot lint or test itself
  without a duplicate declaration.
- **All 25 as the consumer's problem** — matches today's reality exactly (the product's `paths` block
  is already the sole binding authority, and openam-ui-ria re-declares 21 of them in its own pom).
  Cost: it contradicts the managed-package-dependencies requirement, since nothing is then
  auditable by `npm audit`, and it leaves the 25 declarations stranded in `commons/pom.xml`, which is
  the artifact the migration is trying to retire.

Unresolvable here, recorded and moved past: `form2js`, `js2form`, `jquery.ba-dotimeout` and
`backgrid.min:less` have no npm coordinate at all. `LIBS-INVENTORY.md` §6/§12 already frames the
(V)endor / (R)eplace / (M)aven-keep decision for them; this file does not make it.

---

## 6. THE `config/` TREE — 7 files

The "7" is the **combined** figure. Commons supplies 5, `user` supplies 2:

| file | supplied by |
|---|---|
| `config/errorhandlers/CommonErrorHandlers.js` | **commons** |
| `config/messages/CommonMessages.js` | **commons** |
| `config/process/CommonConfig.js` | **commons** |
| `config/routes/CommonRoutesConfig.js` | **commons** |
| `config/validators/CommonValidators.js` | **commons** |
| `config/messages/UserMessages.js` | user |
| `config/routes/UserRoutesConfig.js` | user |

**Commons does not supply `config/AppConfiguration.js`, and never has.** openam-ui-ria supplies it,
along with `config/main.js` (the aggregator), `config/AppMessages.js`,
`config/ThemeConfiguration.js`, `config/process/AMConfig.js`, `config/validators/AMValidators.js` and
4 route files. The composed `target/XUI/config/` is 17 files with **17 distinct names** — a pure
union, zero overwrites. `config/` is not an override tree today; it is a namespace three modules
write into by agreement.

Commons' own dependency runs the other way: `main/Configuration.js` declares
`"config/AppConfiguration"` as an AMD dep. Commons **consumes** a product-supplied config module.

### Do they belong in the package?

Argument for **no**: these five are product-configuration fragments, not library code. They are only
reachable because the composition is a flat overlay, and the id `config/…` sits in a namespace the
*product* owns end to end (`config/main.js` is openam's). Shipping them in the package means the
package writes into the consumer's configuration namespace.

Argument for **yes**: all five are referenced by `config/main.js`-style aggregators in every
consumer, and dropping them means every product copies the same five files. `CommonConfig.js` in
particular (420+ lines of event wiring) is real shared behaviour, not configuration.

Not decided here.

### What happens if both sides supply `config/AppConfiguration.js`

Two different answers, depending on which integration mechanism from §2 is used, and the difference
was measured in the spike:

- **Under the last-wins overlay (copy step)** — the product wins. `buildCompositionDirs` puts
  `mavenProjectSource(".")` last precisely so this happens. The package's file is copied in and then
  overwritten. Harmless, but it means the package's copy is dead weight that never executes, and a
  reader of the package would reasonably assume it is live.
- **Under a `paths` prefix entry** — **the package wins and the product's file becomes unreachable.**
  Directly measured: with a product file present at the colliding path and a `paths` entry active,
  both the RequireJS runtime and r.js resolved to the *package's* module.

The second case has a specific consequence for the build:
`Gruntfile.js:254-257` sets `excludeShallow: ["config/AppConfiguration", "config/ThemeConfiguration"]`
with the comment *"These files are excluded from optimization so that the UI can be customized
without having to repackage it."* That is the whole per-deployment customisation story for XUI. It
depends on those two ids resolving to the **product's** files on disk. Any `paths` entry that
captures the `config/` prefix silently disables it. This is an argument for keeping the `paths`
prefix at `org/forgerock/commons/ui/common` (§2 test B) and never letting it reach `config/` — or for
keeping `config/` out of the package entirely.

---

## 7. THE MAVEN ZIP — can `commons.ui:commons:zip:www` keep being produced unchanged?

**Yes**, and it takes almost nothing, because the zip and an npm build read different directories.

What the zip is built from (`commons/src/main/assembly/zip.xml`):

- `fileSet ${basedir}/target/classes → /` — filled by `maven-resources-plugin` from the two
  `<resource>` dirs in `commons/pom.xml:38-45`: `src/main/js` and `src/main/resources`.
- `dependencySet ui.libs:*:js → /libs`, `dependencySet ui.libs:*:css|*:less → /css`.
- three `fileSet`s over `${project.build.directory}/font-awesome-4.5.0` (and the capitalised
  `Font-Awesome-4.5.0` variant) → `/css/fontawesome`.
- `<formats>` are `dir` **and** `zip`; `<id>www</id>` gives the `www` classifier.

Who consumes it:

| consumer | what it takes |
|---|---|
| `commons/ui/user` | `commons:zip:www` directly (`user/pom.xml:38-44`, unpacked at `package`) |
| `OpenIG/openig-ui` | **`commons:zip:www` directly** (`OpenIG/openig-ui/pom.xml:110-114` and `:219-224`) |
| `OpenIDM/openidm-ui-admin`, `openidm-ui-enduser` | `user:zip:www` (i.e. commons transitively) |
| `OpenAM/openam-ui-ria` | `user:zip:www` |
| `commons/ui/mock`, `commons/commons/selfservice/example-ui` | `user:zip:www` |

So the rollback channel `design.md` depends on has **two** direct consumers of the commons zip
(`user` and `openig-ui`) and four more downstream of `user`.

### What it takes to keep both

1. **Do not add a `<resource>` directory, and do not write generated output under `src/main/js` or
   `src/main/resources`.** The zip's only source-tree input is `target/classes`, and `target/classes`
   is exactly those two directories. A generated `esm/` tree placed beside the AMD source would be
   picked up by `maven-resources-plugin` and would land inside the zip, changing the artifact.
   Generated output belongs in `target/` (already git-ignored via `commons/ui/.gitignore`) or a
   git-ignored `dist/`.

2. **Reuse the `frontend-maven-plugin` slot that already exists.** `commons/ui/pom.xml:517-556`
   already binds, for every ui module including commons:
   `install-node-and-npm` (v20.12.2 / npm 10.5.0) at `initialize`, `npm install` at `initialize`, and
   `grunt build` at `compile`. Today `commons/Gruntfile.js` registers `build = ["eslint"]` only.
   Adding the dual-build emit as a task inside that existing `build` — or as one more
   `frontend-maven-plugin` execution — runs at `compile`, strictly **before** `maven-resources-plugin`
   and `maven-assembly-plugin`, both of which are bound to `package`. Ordering is already correct;
   no phase juggling is needed.

3. **`package.json` needs `"private": true` lifted, a real `name` and `version`.** Today
   `commons/package.json` is `{"name": "forgerock-ui-commons", "private": true}` with devDependencies
   only and no `dependencies`/`files`/`exports`. `.npmrc` contains only a commented-out ForgeRock
   registry line, so the default public registry applies. Publishing is a new capability, not a
   modification of an existing one — the zip is unaffected either way.

4. **Nothing in `zip.xml` changes.** Not one line. It keeps reading `target/classes` and the same
   `dependencySet`s, and keeps emitting `dir` + `zip` with classifier `www`.

5. **The 25 lib declarations must stay in `commons/pom.xml` for as long as the zip is a supported
   channel**, whatever §5 decides for the npm side. They are what populates `/libs` and `/css` in the
   zip; removing them empties those directories for `user`, `openig-ui` and everything downstream.
   During the dual period the same libraries are declared twice — once in the pom for the zip, once
   in `package.json` for the npm consumer. That duplication is the standing cost of keeping the
   rollback channel, and it is the thing that has to be reconciled when the zip is finally retired.

**Nothing is proposed for removal.** The zip keeps working unchanged; the npm build is additive.

---

## 8. Could not determine

- **Whether openidm-ui and openig-ui override any commons file** through their own last-wins
  composition. Verified only for openam-ui-ria (zero collisions in `src/main/js` and
  `src/main/resources`). The equivalent `comm -12` was not run for the OpenIDM and OpenIG source
  trees, so the blast radius of §2's "`paths` defeats the overlay" finding is confirmed for OpenAM
  only.
- **Whether a generated-ESM tree is correct**, for direction (a). There is no ESM consumer of commons
  anywhere in the workspace to test a generator against, and none of the candidate AMD→ESM tools is
  installed, so (a)'s generator was assessed from the source shape (the 26 injected ids, the 4
  loader-API files) rather than by running one.
- **What `moduleIds`/`getModuleId` configuration exactly reproduces the two existing named define ids**
  under direction (b). The spike showed the naive `moduleIds: true` + `moduleRoot` output is wrong
  (it embeds the absolute filename); a correct `getModuleId` was not written.

---

## 9. Method

Read-only apart from this file. `mvn` was **never** run — `maven-external-dependency-plugin`'s
`clean-external` goal deletes the `commons.ui.libs` artifacts from `~/.m2` and they are published to
no repository.

The spike used `OpenAM/openam-ui/openam-ui-ria/node_modules/requirejs` (2.3.7, the version the build
uses) and its `bin/r.js`, plus that checkout's `@babel/core` and
`@babel/plugin-transform-modules-amd`. Nothing was installed. All spike files lived in a scratch
directory outside both checkouts and have been deleted. `git status` is clean in
`/home/maxim/Documents/_projects/forgerock/OpenAM`, and in
`/home/maxim/Documents/_projects/forgerock/commons` shows only this new untracked file.
