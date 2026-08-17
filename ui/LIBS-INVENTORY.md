# `commons.ui.libs` → npm inventory

Maps every `org.openidentityplatform.commons.ui.libs` Maven artifact consumed by this UI family to
an npm package and version, and records which ones have no npm equivalent.

Produced by task 3.1 of the `modernize-openam-ui-build` change. **This file is the committed
record** — tasks 3.2, 3.3, 3.7 and 4.7 read it, and it is written to stand on its own.

Supports two spec requirements in `specs/ui-build-and-packaging/spec.md`:

- *Runtime libraries are managed package dependencies* — the third-party libraries that must become
  registry-resolved dependencies with a committed lockfile. §4 gives the number that requirement
  governs.
- *Shared commons UI distributed for both module systems* — explicitly **not** covered by the rows
  below. `commons.ui:commons` and `commons.ui:user` are this project's own code, a different
  groupId, and are governed by that requirement instead (D5). Nothing in this table is the commons
  UI itself.

Scope: all six consumers (`commons`, `user`, `mock`, `openam-ui-ria`, `openig-ui`, `openidm-ui`),
not just the OpenAM path — 4.7 and any later OpenIDM/OpenIG work needs the rows phase 1 does not.

**No pom was changed and no build was run to produce this.** `maven-external-dependency-plugin`'s
`clean-external` goal deletes these artifacts from `~/.m2`, and they are published to no
repository — the local copies exist only because a past build fetched them from CDNs. Read this
file rather than re-running discovery.

---

## 1. The count

> ### 76 distinct Maven artifacts, over 58 distinct artifactIds.
>
> **`tasks.md:52` says "~20"** (and `proposal.md:43` repeats it). That figure matches nothing in
> the checkout — it is low by roughly 3.8×. The task text is left as-is; correcting its wording is
> a separate call.

"Distinct artifact" = distinct `(artifactId, version, classifier, type)` tuple. That is the right
unit because `maven-external-dependency-plugin` installs per-tuple and the assembly `dependencySet`
blocks copy per-tuple: one artifactId at two classifiers is two files in `libs/`, fetched from two
different URLs, and is two separate npm decisions.

Every other figure in circulation, and what it actually counts:

| Figure | Source | What it counts | Verdict |
|---|---|---|---|
| **"~20"** | `tasks.md:52`, `proposal.md:43` | nothing in the checkout | **wrong by ~3.8×** |
| **52 `<artifactItem>`** | `commons/ui/pom.xml` lines 61–474 | 52 artifactItems including 1 non-libs entry (`org.openidentityplatform:cddl-license:txt`) → **51 ui.libs items over 40 distinct ui.libs artifactIds**. A quoted "41 distinct" is counting `cddl-license` as one of them | correct for that pom; understates the family |
| **"21 more" in openam-ui-ria** | `OpenAM/openam-ui/openam-ui-ria/pom.xml` | 26 `commons.ui*` dependencies = 1 × `commons.ui:user:zip:www` + **25 ui.libs** (21 runtime + 4 test-scoped) | the "21" is the runtime subset only |
| **"~58"** | `OpenAM/e2e/local/README.md:163` | the **57 artifactId directories in `~/.m2/repository/org/openidentityplatform/commons/ui/libs/`** (79 artifact files) — it counts the local repository population, not any pom | closest published figure, but measures the wrong thing |
| **47 files** | `OpenAM/openam-ui/openam-ui-ria/target/XUI/libs/` | what the built XUI ships: 46 files + `codemirror/` | ground truth for OpenAM only |
| **76 / 58** | this document | union of ui.libs dependencies across all 12 consuming poms | **the real number** |

Provenance of the 76 — the union of `<dependency>` entries with groupId
`org.openidentityplatform.commons.ui.libs` in: `commons/ui/pom.xml` (dependencyManagement),
`commons/ui/commons/pom.xml`, `commons/ui/user/pom.xml`, `commons/ui/mock/pom.xml`,
`OpenAM/openam-ui/openam-ui-ria/pom.xml`, `OpenAM/pom.xml` (dependencyManagement),
`OpenIG/openig-ui/pom.xml`, `OpenIDM/openidm-ui/openidm-ui-{admin,enduser,common}/pom.xml`,
`OpenIDM/openidm-zip/pom.xml`, `commons/commons/selfservice/example-ui/pom.xml`.

One structural fact that matters to 3.3 and 3.7: **`commons/ui/user/pom.xml` declares zero ui.libs
artifacts.** It only repackages `commons.ui:commons:zip:www`. Everything the `user` zip carries in
`libs/` was put there by `commons/ui/commons/pom.xml`.

### Where the `downloadUrl`s live

`<artifactItem>` blocks — the only place a `downloadUrl` exists — are declared in five poms, each
redundantly re-declaring most of the same set. A version bump has to be made in up to four places:

| pom | ui.libs artifactItems |
|---|---|
| `commons/ui/pom.xml` | 51 |
| `OpenAM/openam-ui/pom.xml` | 60 (21 OpenAM-only + 39 re-declared from commons) |
| `OpenIG/pom.xml` | 74 |
| `OpenIDM/openidm-ui/pom.xml` | 69 |
| `commons/commons/selfservice/pom.xml` + `.../example-ui/pom.xml` | 1 each (`less:rhino`) |

One artifact is not downloaded at all: `ldapjs-filter:2253:min:js` is installed by
`maven-install-plugin:install-file` from `commons/ui/extlib/ldapjs-filter.min.js`
(`commons/ui/pom.xml:557–579`, in `pluginManagement`).

---

## 2. Master inventory

All groupIds are `org.openidentityplatform.commons.ui.libs`.

**`declared in`** — `C` = `commons/ui/pom.xml`, `AM` = `OpenAM/openam-ui/pom.xml`,
`IG` = `OpenIG/pom.xml`, `IDM` = `OpenIDM/openidm-ui/pom.xml`, `SS` = selfservice.

**`RequireJS id`** — from `OpenAM/openam-ui/openam-ui-ria/src/main/js/main.js` `paths` (38 entries);
`shim?` from the same file's `shim` block. `—` = not bound in main.js (either not shipped to OpenAM,
or loaded another way — see §9).

**`evidence`** — how the npm match was established, not inferred from the name:

- **MD5** — the `~/.m2` artifact file is byte-identical to a named file inside the npm tarball
  (`npm pack <pkg>@<ver>`, extract, `md5sum`). Strongest evidence.
- **VER** — `npm view <pkg> versions --json` contains the exact version, but the bytes differ
  because npm ships no equivalent build (usually npm publishes unminified only and the artifact is a
  cdnjs minification), or because the artifact came from a fork or CDN rebuild.
- **NO-VER** — the package exists on npm but that version was never published.
- **NONE** — no npm package contains this code.

| # | artifactId | version | clsf | type | downloadUrl | declared in | consumers | RequireJS id (shim?) | npm package@version | evidence | verdict | scope |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | backbone | 1.1.2 | min | js | `cdnjs…/backbone.js/1.1.2/backbone-min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `backbone` (shim: deps lodash, exports Backbone) | `backbone@1.1.2` | MD5 = `package/backbone-min.js` | exact match | runtime |
| 2 | backbone-relational | 0.9.0 | min | js | `cdnjs…/backbone-relational/0.9.0/backbone-relational.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user), openidm-admin | `backbone-relational` (shim: deps backbone) | `backbone-relational@0.9.0` | VER — npm 0.9.0 ships unminified `backbone-relational.js` (72117 B) only; artifact is the cdnjs 25019 B min | exact match on version; no minified build on npm | runtime |
| 3 | backbone.paginator.min | 2.0.2 | min | js | `cdnjs…/backbone.paginator/2.0.2/backbone.paginator.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `backbone.paginator` (shim: deps backbone) | `backbone.paginator@2.0.2` | MD5 = `package/lib/backbone.paginator.min.js` | exact match | runtime |
| 4 | backgrid.min | 0.3.5 | min | js | `cdnjs…/backgrid.js/0.3.5/backgrid.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user), openidm-admin, openidm-enduser | `backgrid` (shim: deps jquery, lodash, backbone; exports Backgrid) | `backgrid@0.3.5` | VER — bytes differ (npm `lib/backgrid.min.js` 25647 B `e15b47b4…` vs artifact 25556 B `248635b0…`; identical banner, cdnjs re-minification) | exact match on version, non-identical build | runtime |
| 5 | backgrid.min | 0.3.5 | — | less | `raw.githubusercontent.com/aldaris/xui-deps/`**`master`**`/less/backgrid.min-0.3.5.less` | C, AM, IG, IDM | commons, openam-ui-ria (via user, → `css/`) | — (less, not a module) | **none** | NONE — npm `backgrid@0.3.5` ships `.css`, never `.less`; this file exists only in a third-party personal repo on an **unpinned master branch** | **no npm equivalent** — §6 | runtime |
| 6 | backgrid-paginator.min | 0.3.5 | min | js | `raw.githubusercontent.com/`**`cloudflare`**`/backgrid-paginator/0.3.5/backgrid-paginator.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user — **dead**, §9), openidm-admin, openidm-enduser | — (main.js binds `backgrid.paginator` to the `-custom` file instead) | `backgrid-paginator@0.3.5` | VER — bytes differ (npm 3915 B `ebd4b6db…` vs artifact 3815 B `c08f46d1…`): the artifact is the **Cloudflare fork**'s build, not wyuenho's | version match, fork build — §7 | runtime |
| 7 | backgrid-paginator.min | 0.3.5 | — | css | `raw.githubusercontent.com/cloudflare/backgrid-paginator/0.3.5/backgrid-paginator.min.css` | C, AM, IG, IDM | commons, openam-ui-ria (via user, → `css/`) | — | `backgrid-paginator@0.3.5` | VER — bytes differ substantively (npm `backgrid-paginator.css` 1212 B vs artifact 847 B); Cloudflare fork | version match, fork build — §7 | runtime |
| 8 | backgrid-filter.min | 0.3.7 | min | js | `raw.githubusercontent.com/cloudflare/backgrid-filter/0.3.7/backgrid-filter.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user), openidm-admin, openidm-enduser | `backgrid-filter` (shim: deps backgrid) | `backgrid-filter@0.3.7` | MD5 = `package/backgrid-filter.min.js` — the Cloudflare fork's build equals upstream at this version | exact match | runtime |
| 9 | backgrid-filter.min | 0.3.7 | — | css | `raw.githubusercontent.com/cloudflare/backgrid-filter/0.3.7/backgrid-filter.min.css` | C, AM, IG, IDM | commons, openam-ui-ria (via user, → `css/`), openidm-admin, openidm-enduser | — | `backgrid-filter@0.3.7` | MD5 = `package/backgrid-filter.min.css` | exact match | runtime |
| 10 | backgrid-select-all | 0.3.5 | min | js | `raw.githubusercontent.com/cloudflare/backgrid-select-all/0.3.5/backgrid-select-all.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `backgrid-selectall` (shim: deps backgrid) | `backgrid-select-all@0.3.5` | VER — bytes differ trivially (npm 3364 B vs artifact 3357 B, identical banner) | exact match on version, non-identical build | runtime |
| 11 | base64 | 1.0.0 | min | js | `cdnjs…/Base64/1.0.0/base64.min.js` | AM, IG, IDM | openam-ui-ria | — (plain `<script>`, `src/main/resources/index.html:21`) | `Base64@1.0.0` (davidchambers/Base64.js — repo URL confirms) | VER — npm ships `base64.js` 2219 B unminified; artifact is the 835 B cdnjs min | exact match on version | runtime |
| 12 | bootstrap | 3.3.5 | **custom** | js | `cdnjs…/twitter-bootstrap/3.3.5/js/bootstrap.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `bootstrap` (shim: deps jquery) | `bootstrap@3.3.5` | **MD5 = `package/dist/js/bootstrap.js`** (`8015042d…`) | **exact match — the `custom` classifier is a misnomer, §7** | runtime |
| 13 | bootstrap | 3.3.5 | **custom** | css | `cdnjs…/twitter-bootstrap/3.3.5/css/bootstrap.css` | C, AM, IG, IDM | commons, openam-ui-ria (via user, → `css/`) | — | `bootstrap@3.3.5` | **MD5 = `package/dist/css/bootstrap.css`** (`957474c3…`) | **exact match — `custom` is a misnomer, §7** | runtime |
| 14 | bootstrap-clockpicker | 0.0.7 | min | js | `cdnjs…/clockpicker/0.0.7/bootstrap-clockpicker.min.js` | AM, IG, IDM | openam-ui-ria | `clockPicker` (shim: deps jquery; exports clockPicker) | `clockpicker@0.0.7` (weareoutman/clockpicker) | VER — bytes differ (npm 11152 B vs artifact 10783 B) | exact match on version, non-identical build | runtime |
| 15 | bootstrap-clockpicker | 0.0.7 | min | css | `cdnjs…/clockpicker/0.0.7/bootstrap-clockpicker.min.css` | AM, IG, IDM | openam-ui-ria (→ `css/`) | — | `clockpicker@0.0.7` | VER — bytes differ trivially (3137 vs 3135 B) | exact match on version | runtime |
| 16 | bootstrap-datetimepicker | 4.14.30 | min | js | `cdnjs…/bootstrap-datetimepicker/4.14.30/js/bootstrap-datetimepicker.min.js` | C, AM, IG, IDM | openam-ui-ria, openidm-admin | `bootstrap-datetimepicker` (no shim) | `eonasdan-bootstrap-datetimepicker@4.14.30` | VER — repo URL `eonasdan/bootstrap-datetimepicker` confirms lineage; the npm tarball ships **only** `src/js/bootstrap-datetimepicker.js` — no built or minified dist, no CSS | exact match on version; **npm publishes source only, so a build step is required** | runtime |
| 17 | bootstrap-datetimepicker | 4.14.30 | min | css | `cdnjs…/bootstrap-datetimepicker/4.14.30/css/bootstrap-datetimepicker.min.css` | C, AM, IG, IDM | openam-ui-ria (→ `css/`), openidm-admin | — | `eonasdan-bootstrap-datetimepicker@4.14.30` | VER — **no CSS in the npm tarball at all** | version match; CSS must be built from LESS or taken from a CDN | runtime |
| 18 | bootstrap-dialog | 1.34.4 | min | js | `cdnjs…/bootstrap3-dialog/1.34.4/js/bootstrap-dialog.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `bootstrap-dialog` (shim: deps jquery, lodash, backbone, bootstrap) | `bootstrap3-dialog@1.35.1` | NO-VER — `npm view bootstrap3-dialog versions` = `["1.35.1","1.35.2","1.35.3","1.35.4"]`; 1.34.4 was never published | **version bump** 1.34.4 → 1.35.1 | runtime |
| 19 | bootstrap-dialog | 1.34.4 | min | css | `cdnjs…/bootstrap3-dialog/1.34.4/css/bootstrap-dialog.min.css` | C, AM, IG, IDM | commons, openam-ui-ria (via user, → `css/`) | — | `bootstrap3-dialog@1.35.1` | NO-VER, as #18 | **version bump** 1.34.4 → 1.35.1 | runtime |
| 20 | bootstrap-tabdrop | 1.0 | — | js | C: `raw.githubusercontent.com/jmschabdach/bootstrap-tabdrop/`**`master`**`/js/bootstrap-tabdrop.js`; AM/IDM: `www.eyecon.ro/bootstrap-tabdrop/js/bootstrap-tabdrop.js` | C, AM, IG, IDM | openam-ui-ria, openidm-admin | `bootstrap-tabdrop` (shim: deps jquery, bootstrap) | **none** | NONE — artifact banner reads "eyecon.ro / Copyright 2012 Stefan Petre, 2013 Jenna Schabdach, 2014 Jose Ant. Aranda". npm `bootstrap-tabdrop` (0.0.1, 0.1.0) is `ispot-tv/bootstrap-tabdrop`, a **different fork lineage**, with no 1.0. Fetched from an **unpinned master** / a dead vanity domain | **no npm equivalent** — §6 | runtime |
| 21 | classnames | 2.2.5 | — | js | `cdnjs…/classnames/2.2.5/index.js` | AM, IG, IDM | openam-ui-ria | `classnames` (no shim; also injected as `window.classNames` by the synthetic `reactSelectDep` module) | `classnames@2.2.5` | MD5 = `package/index.js` | exact match | runtime |
| 22 | CodeMirror | 4.10 | — | zip | C: `github.com/codemirror/CodeMirror/archive/4.10.0.zip`; AM/IG/IDM: `github.com/codemirror/CodeMirror5/archive/4.10.0.zip` | C, AM, IG, IDM | mock, openam-ui-ria, openig-ui, openidm-admin | — (literal paths `libs/codemirror/lib/codemirror`, `mode/groovy`, `mode/javascript`, `addon/display/fullscreen` from `EditScriptView.js:21`) | `codemirror@4.10.0` | **MD5** — npm `package/lib/codemirror.js` == built `target/XUI/libs/codemirror/lib/codemirror.js` (`1c570cd1…`) | exact match (Maven `4.10` == npm `4.10.0`) | runtime |
| 23 | contentflow | 1.0.2 | min | js | `raw.githubusercontent.com/collective/collective.js.contentflow/`**`master`**`/collective/js/contentflow/static/contentflow.js` | C, IDM | openidm-enduser | — (not shipped to OpenAM) | **none** | NONE — `npm view contentflow` → 404. Fetched from an **unpinned master** of a Plone packaging repo | **no npm equivalent** — §6 | runtime |
| 24 | d3 | 3.5.5 | min | js | `cdnjs…/d3/3.5.5/d3.min.js` | C, IG, IDM | openig-ui, openidm-admin, openidm-enduser | — (not shipped to OpenAM) | `d3@3.5.5` | MD5 = `package/d3.min.js` | exact match (npm latest 7.9.0 — **major jump**, §10) | runtime |
| 25 | dimple | 2.1.2 | min | js | `cdnjs…/dimple/2.1.2/dimple.latest.min.js` | C, IG, IDM | openig-ui, openidm-admin, openidm-enduser | — | `dimple-js@2.1.4` | NO-VER — the correct package is **`dimple-js`** (`npm view dimple-js versions` = `["2.1.4"]` only); npm `dimple` (latest 0.0.13) is unrelated | **version bump** 2.1.2 → 2.1.4, **plus an artifactId → package rename** | runtime |
| 26 | dragula | 3.6.7 | min | js | `cdnjs…/dragula/3.6.7/dragula.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user — **dead**, §9), openidm-admin | — | `dragula@3.6.7` | MD5 = `package/dist/dragula.min.js` | exact match | runtime |
| 27 | dragula | 3.6.7 | min | css | `cdnjs…/dragula/3.6.7/dragula.min.css` | C, AM, IG, IDM | openig-ui, openidm-admin (→ `css/`) | — | `dragula@3.6.7` | MD5 = `package/dist/dragula.min.css` | exact match | runtime |
| 28 | font-awesome | 4.5.0 | — | zip | `github.com/FortAwesome/Font-Awesome/archive/v4.5.0.zip` | C, AM, IG, IDM | commons (unpacked → `css/fontawesome/`), openam-ui-ria (via user) | — (CSS + fonts, not a module) | `font-awesome@4.5.0` | **MD5** — `Font-Awesome-4.5.0/css/font-awesome.min.css` in the zip == npm `package/css/font-awesome.min.css` (`4fbd15cb…`) | exact match | runtime |
| 29 | fontawesome-iconpicker | 1.0.0 | min | js | `cdnjs…/fontawesome-iconpicker/1.0.0/js/fontawesome-iconpicker.min.js` | C, IDM | openidm-admin, openidm-enduser | — | `fontawesome-iconpicker@1.2.1` | NO-VER — npm versions start at `1.2.1` | **version bump** 1.0.0 → 1.2.1 | runtime |
| 30 | fontawesome-iconpicker | 1.0.0 | min | css | `cdnjs…/fontawesome-iconpicker/1.0.0/css/fontawesome-iconpicker.min.css` | C, IDM | openidm-admin, openidm-enduser (→ `css/`) | — | `fontawesome-iconpicker@1.2.1` | NO-VER | **version bump** 1.0.0 → 1.2.1 | runtime |
| 31 | form2js | 2.0-769718a | — | js | `raw.githubusercontent.com/maxatwork/form2js/`**`769718a159ff88da82613c2c7e5b1eaa2e0c73e7`**`/src/form2js.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user), openidm-admin | `form2js` (shim: exports form2js) | **none** | NONE — npm `form2js@1.0.0` is `kirill-zhirnov/form2js`, a different fork; `maxatwork/form2js` was never published. The Maven version literally encodes a **git commit SHA prefix** | **no npm equivalent** (pinned git commit) — §6 | runtime |
| 32 | js2form | 2.0-769718a | — | js | `raw.githubusercontent.com/maxatwork/form2js/769718a…/src/js2form.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `js2form` (shim: exports js2form) | **none** | NONE — a **sibling file in the same repo and commit as #31**, not a package of its own | **no npm equivalent** (pinned git commit) — §6 | runtime |
| 33 | handlebars | 4.0.5 | — | js | `cdnjs…/handlebars.js/4.0.5/handlebars.js` | IDM | openidm-admin, openidm-enduser, openidm-zip | — (not shipped to OpenAM) | `handlebars@4.0.5` | VER | exact match on version | runtime |
| 34 | handlebars | 4.7.7 | — | js | `cdnjs…/handlebars.js/4.7.7/handlebars.js` | C, AM, IG | commons, openam-ui-ria (via user) | `handlebars` (no shim) — **this is the one `main.js`, `main-authorize.js` and `main-device.js` actually bind** | `handlebars@4.7.7` | MD5 = `package/dist/handlebars.js` | exact match | runtime |
| 35 | handlebars | 4.7.7 | min | js | **`cdnjs…/handlebars.js/4.7.6/handlebars.min.js`** — the URL hardcodes 4.7.6 (`OpenAM/openam-ui/pom.xml`) | AM | openam-ui-ria | — (shipped but unbound; the pom comment says it exists to "fix the processing dependencies in the release build") | **`handlebars@4.7.6`** | **MD5** — artifact == npm `handlebars@4.7.6` `package/dist/handlebars.min.js` (`5a252786…`), **not** 4.7.7 (80257 B vs 4.7.7's 80288 B); the file's own banner reads `handlebars v4.7.6` | **exact match to 4.7.6 — the Maven version label is wrong**, §7 | runtime |
| 36 | i18next | 1.7.3 | min | js | `cdnjs…/i18next/1.7.3/i18next.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `i18next` (shim: deps jquery, handlebars; exports i18n) | `i18next@1.7.3` | MD5 = `package/lib/dep/i18next.min.js` | exact match (npm latest 26.3.6 — **25-major gap**, §10) | runtime |
| 37 | jquery | 3.7.1 | min | js | `cdnjs…/jquery/3.7.1/jquery.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `jquery` (no shim) | `jquery@3.7.1` | MD5 = `package/dist/jquery.min.js` | exact match — **the one already-modern pin in the family** | runtime |
| 38 | jquery-cron | f831f2 | — | js | `raw.githubusercontent.com/shawnchin/jquery-cron/`**`master`**`/cron/jquery-cron.js` | C, IDM | openidm-admin | — | **none** | NONE — npm `jquery-cron@1.0.0` is `MIAOMIAOUP/jquery-cron`, a different fork. The Maven version `f831f2` is a **git SHA prefix**, but the URL fetches **master** — the version string does not even describe what is fetched | **no npm equivalent** — §6 | runtime |
| 39 | jquery-sortable | 0.9.13 | — | js | `raw.githubusercontent.com/johnny/jquery-sortable/`**`master`**`/source/js/jquery-sortable.js` | AM, IG, IDM | openam-ui-ria | `sortable` (shim: deps jquery) | `jquery-sortable@0.9.13` | VER — bytes differ (npm 24550 B vs artifact 23858 B) because the artifact is fetched from **master**, not the 0.9.13 tag; both banners read `v0.9.13` | exact match on version, unpinned fetch — §7 | runtime |
| 40 | jquery-ui | 1.11.1 | min | js | `cdnjs…/jqueryui/1.11.1/jquery-ui.min.js` | C, IDM | openidm-enduser | — | `jquery-ui@1.12.1` | NO-VER — `npm view jquery-ui versions` jumps `1.10.4, 1.10.5, 1.12.0-beta.1, …`; **no 1.11.x was ever published** | **version bump** 1.11.1 → 1.12.1 | runtime |
| 41 | jquery.ba-dotimeout | 1.0 | min | js | `cdnjs…/jquery-dotimeout/1.0/jquery.ba-dotimeout.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `doTimeout` (shim: deps jquery; exports doTimeout) | **none** | NONE — checked `jquery-dotimeout`, `jquery.ba-dotimeout`, `jquery-ba-dotimeout`, `dotimeout`: all 404. Ben Alman's doTimeout plugin was never published to npm | **no npm equivalent** — §6 | runtime |
| 42 | jquery.placeholder | 2.0.8 | — | js | `cdnjs…/jquery-placeholder/2.0.8/jquery.placeholder.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user — **dead**, §9) | — | `jquery-placeholder@2.1.1` | NO-VER — `npm view jquery-placeholder versions` = `["2.0.7","2.1.0","2.1.1","2.3.1"]`; **2.0.8 was never published** (artifact 5297 B vs npm 2.0.7's 5080 B) | **version bump** 2.0.8 → 2.1.1 | runtime |
| 43 | jquery.qrcode | 0.11.0 | min | js | **none — no `<artifactItem>` in any pom, and the artifact is absent from `~/.m2`** | `OpenAM/pom.xml:913–920` (dependencyManagement only) | **nobody** — zero `<dependency>` references it | — | `jquery.qrcode@1.0.3` / `jquery-qrcode@1.0.0` (both forks; neither has 0.11.0) | NO-VER; also unresolvable in this checkout | **dead dependencyManagement entry** — disposition open, §12 | n/a |
| 44 | jsoneditor | 0.7.9 | min | js | `cdnjs…/json-editor/0.7.9/jsoneditor.min.js` | C, AM, IG, IDM | openam-ui-ria (**dead**, §9), openidm-admin, openidm-enduser | — (main.js binds `jsonEditor` to the `-custom` source file instead) | `json-editor@0.7.9` | MD5 = `package/dist/jsoneditor.min.js` (`ce6de91c…`) | exact match | runtime |
| 45 | ldapjs-filter | 2253 | min | js | **none — `maven-install-plugin:install-file` from `commons/ui/extlib/ldapjs-filter.min.js`** (`commons/ui/pom.xml:557–579`) | C (pluginManagement), IDM | openidm-admin | — | **none** | NONE — the file is an **almond-0.2.9-bundled AMD browser build** wrapping ldapjs's filter module (`define("ldapjs-filter", …)`, "Copyright 2011 Mark Cavage"). npm `ldap-filter@0.3.3` is the Node-side API it derives from, not this browser bundle; `ldapjs-filter` is 404. The Maven "version" `2253` is an opaque revision number | **no npm equivalent** (vendored bundle) — §6 | runtime |
| 46 | less | 1.5.1 | rhino | js | `raw.githubusercontent.com/less/less.js/`**`v1.7.5`**`/dist/less-rhino-1.5.1.js` — the tag and the version disagree | SS (+ example-ui), IDM | openidm-admin, openidm-enduser, selfservice-example-ui | — | **`less@1.7.5`**, file `dist/less-rhino-1.5.1.js` | **MD5** — artifact == npm `less@1.7.5` `package/dist/less-rhino-1.5.1.js` (`a6373b16…`). npm `less@1.5.1`'s own `dist/` has rhino builds only up to `less-rhino-1.4.0.js`, so `less@1.5.1` is the **wrong** coordinate | exact match, but the npm coordinate is `less@1.7.5` | runtime |
| 47 | lodash | 2.4.1 | min | js | `cdnjs…/lodash.js/2.4.1/lodash.min.js` | C, AM, IG, IDM | openidm-zip | — | `lodash@2.4.1` | VER | exact match on version | runtime |
| 48 | lodash | 3.10.1 | min | js | `cdnjs…/lodash.js/3.10.1/lodash.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `lodash` (shim: exports `_`; **and main.js `map` aliases `"underscore" → "lodash"`**) | `lodash@3.10.1` | VER — npm 3.10.1 ships modular sources + `index.js` (411455 B), no minified bundle; artifact is the 50543 B cdnjs min, banner `lodash 3.10.1` | exact match on version — **major jump to 4.x, §10** | runtime |
| 49 | microplugin | 0.0.3 | — | js | `cdnjs…/microplugin/0.0.3/microplugin.js` | AM, IG, IDM | openam-ui-ria, openig-ui, openidm-admin, openidm-enduser | `microplugin` (no shim; a selectize shim dep) | `microplugin@0.0.3` | MD5 = `package/src/microplugin.js` | exact match | runtime |
| 50 | moment | 2.28.0 | min | js | `cdnjs…/moment.js/2.28.0/moment.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `moment` (shim: exports moment) | `moment@2.28.0` | MD5 = `package/min/moment.min.js` | exact match | runtime |
| 51 | moment-timezone-with-data | 0.5.4 | min | js | `cdnjs…/moment-timezone/0.5.4/moment-timezone-with-data-2010-2020.min.js` | C, IDM | openidm-admin | — | **`moment-timezone@0.5.4`**, file `builds/moment-timezone-with-data-2010-2020.min.js` | **MD5** (`03d0069f…`) | exact match; **artifactId → package rename**, and the data-window build must be selected explicitly | runtime |
| 52 | qrcode | 1.4.4 | min | js | `cdnjs…/qrcode-generator/1.4.4/qrcode.min.js` | AM | openam-ui-ria | `qrcode` (shim: exports qrcode) | `qrcode-generator@1.4.4` (kazuhikoarase) | VER — npm ships `qrcode.js` 56694 B unminified; artifact is the 20387 B cdnjs min | exact match on version; artifactId → package rename | runtime |
| 53 | qunit | 1.15.0 | — | js | `cdnjs…/qunit/1.15.0/qunit.js` | AM, IG | openam-ui-ria, openig-ui | — | **`qunitjs@1.15.0`** | **MD5 = `package/qunit/qunit.js`**. Note `npm view qunit@1.15.0` → **E404**: the modern `qunit` package has **no 1.x line at all**; 1.x lives under the legacy name `qunitjs` | exact match, under the **old package name** | **test-only** |
| 54 | qunit | 1.15.0 | — | css | `cdnjs…/qunit/1.15.0/qunit.css` | AM, IG | openam-ui-ria, openig-ui | — | `qunitjs@1.15.0` | MD5 = `package/qunit/qunit.css` | exact match, old package name | **test-only** |
| 55 | qunit | 2.20.1 | — | js | `cdnjs…/qunit/2.20.1/qunit.js` | C, IDM | mock, openidm-common | — | `qunit@2.20.1` | VER | exact match | **test-only** — scope caveat, §4 |
| 56 | qunit | 2.20.1 | — | css | `cdnjs…/qunit/2.20.1/qunit.css` | C, IDM | mock, openidm-common | — | `qunit@2.20.1` | VER | exact match | **test-only** — scope caveat, §4 |
| 57 | r | 2.1.10 | — | js | `raw.githubusercontent.com/requirejs/r.js/2.1.10/dist/r.js` | IDM | openidm-admin, openidm-enduser | — (build tool, not a runtime module) | `requirejs@2.1.10`, file `bin/r.js` | VER — 20-byte difference (npm `bin/r.js` 1021196 B vs artifact 1021176 B; same r.js 2.1.10, different packaging of the same dist) | exact match on version; artifactId → package rename | **build-time** |
| 58 | react | 15.2.1 | min | js | C: `cdnjs…/react/15.2.1/react.min.js`; AM/IG/IDM: `unpkg.com/react@15.2.1/dist/react.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `react` (no shim) | `react@15.2.1` | MD5 = `package/dist/react.min.js` | exact match — **major jump to 19.x, §10** | runtime |
| 59 | react-dom | 15.2.1 | min | js | `cdnjs…/react-dom/15.2.1/react-dom.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `react-dom` (no shim; also injected as `window.ReactDOM` by `reactSelectDep`) | `react-dom@15.2.1` | MD5 = `package/dist/react-dom.min.js` | exact match — **major jump to 19.x, §10** | runtime |
| 60 | react-bootstrap | 0.30.1 | min | js | `cdnjs…/react-bootstrap/0.30.1/react-bootstrap.min.js` | AM, IG, IDM | openam-ui-ria | `react-bootstrap` (no shim) | `react-bootstrap@0.30.1` | MD5 = `package/dist/react-bootstrap.min.js` | exact match — **major jump to 2.x, §10** | runtime |
| 61 | react-input-autosize | 1.1.0 | min | js | `raw.githubusercontent.com/JedWatson/react-input-autosize/`**`v1.1.0`**`/dist/react-input-autosize.min.js` (tag-pinned) | AM, IG, IDM | openam-ui-ria | `react-input-autosize` (shim: deps the synthetic `reactAutosizeInputDep` module, which sets `window.React`) | `react-input-autosize@1.1.0` | MD5 = `package/dist/react-input-autosize.min.js` | exact match — **major jump to 3.x, §10** | runtime |
| 62 | react-select | 1.0.0-rc.2 | min | js | `cdnjs…/react-select/1.0.0-rc.2/react-select.min.js` | AM, IG, IDM | openam-ui-ria | `react-select` (shim: deps the synthetic `reactSelectDep` module) | `react-select@1.0.0-rc.2` | MD5 = `package/dist/react-select.min.js` (`bd4ca8e8…`) | exact match — **major jump to 5.x, §10** | runtime |
| 63 | react-select | 1.0.0-rc.2 | min | css | `cdnjs…/react-select/1.0.0-rc.2/react-select.min.css` | AM, IG, IDM | openam-ui-ria (→ `css/`) | — | `react-select@1.0.0-rc.2` | MD5 = `package/dist/react-select.min.css` (`7b4c89c5…`) | exact match — **major jump to 5.x, which ships no CSS file at all, §10** | runtime |
| 64 | redux | 3.5.2 | min | js | `cdnjs…/redux/3.5.2/redux.min.js` | AM, IG, IDM | openam-ui-ria | `redux` (no shim) | `redux@3.5.2` | MD5 = `package/dist/redux.min.js` | exact match — **major jump to 5.x, §10** | runtime |
| 65 | requirejs | 2.3.7 | min | js | `cdnjs…/require.js/2.3.7/require.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | — (plain `<script>`, `src/main/resources/index.html:28`) | `requirejs@2.3.7` | VER — npm ships `require.js` 86578 B unminified; artifact is the 17420 B cdnjs min. **Already present** as `requirejs@2.3.7` in `openam-ui-ria/package.json` devDependencies | exact match on version | runtime (loader) **and** build-time |
| 66 | selectize | 0.12.1 | min | js | `cdnjs…/selectize.js/0.12.1/js/selectize.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user — **dead**, §9) | — (main.js binds `selectize` to `selectize-non-standalone` instead) | `selectize@0.12.1` | MD5 = `package/dist/js/selectize.min.js` (`7a8aec7b…`) | exact match | runtime |
| 67 | selectize | 0.12.1 | bootstrap3 | css | `cdnjs…/selectize.js/0.12.1/css/selectize.bootstrap3.css` | C, AM, IG, IDM | commons, openam-ui-ria (via user, → `css/`) | — | `selectize@0.12.1` | MD5 = `package/dist/css/selectize.bootstrap3.css` (`d75b17eb…`) | exact match | runtime |
| 68 | selectize-non-standalone | 0.12.1 | min | js | `cdnjs…/selectize.js/0.12.1/js/selectize.min.js` — **the exact same URL as #66** | AM, IG, IDM | openam-ui-ria | `selectize` (shim: deps jquery, sifter, microplugin) | `selectize@0.12.1` | **MD5 identical to #66** (`7a8aec7b…`) and to npm `package/dist/js/selectize.min.js`. npm's real *standalone* build (`dist/js/standalone/selectize.min.js`, `146435ee…`) is **not** what either artifact contains | exact match — **#66 and #68 are the same bytes under two artifactIds, §7** | runtime |
| 69 | sifter | 0.4.1 | min | js | `cdnjs…/sifter/0.4.1/sifter.min.js` | AM, IG, IDM | openam-ui-ria, openig-ui, openidm-admin, openidm-enduser | `sifter` (no shim; a selectize shim dep) | `sifter@0.4.1` | MD5 = `package/sifter.min.js` | exact match | runtime |
| 70 | sinon | 1.15.4 | — | js | `cdnjs…/sinon.js/1.15.4/sinon.js` | AM, IG, IDM | openam-ui-ria, openig-ui, openidm-common | — | `sinon@1.15.4` | VER | exact match on version | **test-only** — scope caveat, §4 |
| 71 | sinon | 15.2.0 | — | js | `cdnjs…/sinon.js/15.2.0/sinon.js` | C | commons/ui (DM), mock | — | `sinon@15.2.0` | MD5 = `package/pkg/sinon.js` | exact match | **test-only by nature, declared at compile scope** — §4 |
| 72 | spin | 2.0.1 | min | js | `cdnjs…/spin.js/2.0.1/spin.min.js` | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `spin` (shim: exports spin) | **`spin.js@2.0.1`** | VER — bytes differ trivially (npm `spin.min.js` 4143 B vs artifact 4121 B). npm `spin` (0.0.1) is a stale unrelated stub | exact match on version; **artifactId → package rename** `spin` → `spin.js` | runtime |
| 73 | squire | 0.2.0 | — | js | `raw.githubusercontent.com/iammerrick/Squire.js/`**`v0.2.0`**`/src/Squire.js` (tag-pinned) | AM, IG, IDM | openam-ui-ria | — | **`squirejs@0.2.0`** | MD5 = `package/src/Squire.js` | exact match; artifactId → package rename `squire` → `squirejs` | **test-only** |
| 74 | text | 2.0.15 | — | js | `raw.githubusercontent.com/requirejs/text/`**`2.0.15`**`/text.js` (tag-pinned) | AM, IG, IDM | openam-ui-ria | `text` (no shim) | **`requirejs-text@2.0.15`** | MD5 = `package/text.js` | exact match; artifactId → package rename | runtime |
| 75 | titatoggle | 1.2.6 | min | css | `cdnjs…/titatoggle/1.2.6/titatoggle-dist-min.css` | C, AM, IG, IDM | commons (→ `css/`) | — | `titatoggle@1.2.14` | NO-VER — `npm view titatoggle versions` = `["1.2.14","1.2.15","2.0.0","2.0.1","2.1.1","2.1.2"]`; **1.2.6 was never published** | **version bump** 1.2.6 → 1.2.14 | runtime |
| 76 | xdate | 0.8 | min | js | `raw.githubusercontent.com/arshaw/xdate/`**`v0.8`**`/src/xdate.js` (tag-pinned) | C, AM, IG, IDM | commons, openam-ui-ria (via user) | `xdate` (shim: exports xdate) | `xdate@0.8.0` | **MD5 = `package/src/xdate.js`** — the artifact is the **unminified source** despite its `min` classifier, §7 | exact match (Maven `0.8` == npm `0.8.0`) | runtime |

### Verdict tally — the 76 partitioned exactly once each

| verdict | count | artifacts |
|---|---|---|
| **exact match, byte-identical (MD5) to a named file in the npm tarball** | **38** | 1, 3, 8, 9, 12, 13, 21, 22, 24, 26, 27, 28, 34, 35\*, 36, 37, 44, 46\*, 49, 50, 51\*, 53\*, 54\*, 58, 59, 60, 61, 62, 63, 64, 66, 67, 68, 69, 71, 73\*, 74\*, 76 |
| **exact match on version, but npm ships no byte-equivalent build** (npm publishes unminified only, or the artifact is a CDN/fork rebuild) | **21** | 2, 4, 6, 7, 10, 11, 14, 15, 16, 17, 33, 39, 47, 48, 52\*, 55, 56, 57\*, 65, 70, 72\* |
| **version bump** — the package exists, that version was never published | **9** | 18, 19, 25\*, 29, 30, 40, 42, 75, and 43 (dead) |
| **no npm equivalent** | **8** | 5, 20, 23, 31, 32, 38, 41, 45 |
| | **76** | |

\* Needs a coordinate correction, not a name-for-name port: #35 → `handlebars@4.7.6`;
#46 → `less@1.7.5`; #51 → `moment-timezone`; #52 → `qrcode-generator`; #53/#54 → `qunitjs`;
#57 → `requirejs`; #72 → `spin.js`; #73 → `squirejs`; #74 → `requirejs-text`; #25 → `dimple-js`.
**Ten of 76 artifactIds do not name their npm package.**

**Major jump is a second, orthogonal axis.** An artifact can be an exact match to its pinned version
*today* and still be several majors behind npm's current release — §10.

---

## 3. How to read the two version columns

Task 3.1 asks for "an npm package and version". Two different versions are defensible and both
matter, so both are recorded:

- The **equivalence version** in the table above is what the Maven artifact *is* — the version whose
  npm tarball the bytes match. It is the version that ports with zero behaviour change.
- The **current-latest version**, in §10, is what installing today would give you. Where the two are
  majors apart, that gap is a migration in its own right, not a number to bump.

For the nine forced-bump artifacts (§2 verdict "version bump") there is no equivalence version to
keep — npm never published the pinned one. Those rows record the **nearest published version above
the pin**, which is the smallest available behaviour delta. That is a chosen value, not a derived
one; it is recorded here so 3.2/3.3 inherit it visibly rather than silently.

---

## 4. Runtime vs test-only, and the number the spec requirement governs

The *Runtime libraries are managed package dependencies* requirement is about runtime libraries.
Counting test doubles alongside them would overstate that number, and dropping them from the
inventory entirely would lose the `devDependencies` work, so both are carried and marked:

| class | count | artifacts |
|---|---|---|
| **runtime** | **67** | everything not listed below |
| **test-only** | **7** | #53, 54 (qunit 1.15.0 js+css), #55, 56 (qunit 2.20.1 js+css), #70 (sinon 1.15.4), #71 (sinon 15.2.0), #73 (squire) |
| **build-time only** | **1** | #57 `r:2.1.10` (the r.js optimizer) → `requirejs@2.1.10` in `devDependencies` |
| **dead** | **1** | #43 `jquery.qrcode` — unreferenced and unresolvable |
| | **76** | |

**The number the spec requirement governs is 67 runtime artifacts** — 76 less 7 test-only, 1
build-time-only (`r`) and 1 dead (`jquery.qrcode`). #65 `requirejs` is counted as runtime because it
is both the runtime loader and the build optimizer.

`openam-ui-ria/pom.xml` scopes all four of its test artifacts correctly (`<scope>test</scope>`,
lines 179–206) and routes them to `target/test-classes/libs` via `copy-dependencies-test` rather
than into `XUI/libs`. Confirmed: **none of the 47 built `libs/` files is a test artifact.**

Four poms **drop the test scope**, which puts test doubles on a runtime classpath — and would put
them in `dependencies` rather than `devDependencies` if ported mechanically:

| pom | artifact | declared scope | should be |
|---|---|---|---|
| `commons/ui/pom.xml:807–812` | `sinon:15.2.0:js` | *(none → compile)* | test |
| `commons/ui/mock/pom.xml` | `sinon:js`, `qunit:js`, `qunit:css` | *(none → compile)* | test |
| `OpenIG/openig-ui/pom.xml` | `sinon:1.15.4:js`, `qunit:1.15.0:js`, `qunit:1.15.0:css` | *(none → compile)* | test |
| `OpenIDM/openidm-ui/openidm-ui-common/pom.xml` | `sinon:1.15.4:js`, `qunit:2.20.1:js/css` | *(none → compile)* | test |

`requirejs:2.3.7:min:js` (#65) is genuinely both — the runtime loader *and* the build optimizer —
and is already a devDependency (`openam-ui-ria/package.json`: `requirejs 2.3.7`,
`grunt-contrib-requirejs 1.0.0`, `karma-requirejs 1.1.0`).

---

## 5. THE SPLIT THAT MATTERS TO TASK 3.7

`openam-ui-ria` gets its `libs/` from two places:

| route | count | evidence |
|---|---|---|
| **via `org.openidentityplatform.commons.ui:user:zip:www`**, unpacked to `target/dependencies-expanded/forgerock-ui-user` by the `unpack-forgerock-ui-user` execution (`openam-ui-ria/pom.xml:262–279`) | **25** | `ls target/dependencies-expanded/forgerock-ui-user/libs` → 25 files |
| **via `openam-ui-ria`'s own pom + its own source** | **22** | `comm -13` of the two `libs/` listings → 22 entries |
| **built total** | **47** | `ls target/XUI/libs` → 47 |

The 22 break down further as **18 from `openam-ui-ria/pom.xml`'s own Maven artifacts** (17 `:js`
dependencies routed to `/libs` by the `ui.libs:*:js` `dependencySet` in
`src/main/assembly/dir.xml`, plus `CodeMirror:zip` unpacked into `libs/codemirror/`) and **4 from
`src/main/js/libs/`**, which are not artifacts at all (§8).

**The 25 do not originate in `user`.** `commons/ui/user/pom.xml` declares zero ui.libs
dependencies — all 25 are declared in `commons/ui/commons/pom.xml`, pass through
`commons:zip:www`, and are re-emitted by `user`'s own `ui.libs:*:js` `dependencySet`. So "the 25" is
really "whatever `commons` declares", and removing the zip dependency means those 25 have to be
re-declared somewhere else.

### The 25 arriving via `user:zip:www`

`backbone-1.1.2-min.js`, `backbone.paginator.min-2.0.2-min.js`, `backbone-relational-0.9.0-min.js`,
`backgrid-filter.min-0.3.7-min.js`, `backgrid.min-0.3.5-min.js`,
`backgrid-paginator.min-0.3.5-min.js`, `backgrid-select-all-0.3.5-min.js`,
`bootstrap-3.3.5-custom.js`, `bootstrap-dialog-1.34.4-min.js`, `dragula-3.6.7-min.js`,
`form2js-2.0-769718a.js`, `handlebars-4.7.7.js`, `i18next-1.7.3-min.js`, `jquery-3.7.1-min.js`,
`jquery.ba-dotimeout-1.0-min.js`, `jquery.placeholder-2.0.8.js`, `js2form-2.0-769718a.js`,
`lodash-3.10.1-min.js`, `moment-2.28.0-min.js`, `react-15.2.1-min.js`, `react-dom-15.2.1-min.js`,
`requirejs-2.3.7-min.js`, `selectize-0.12.1-min.js`, `spin-2.0.1-min.js`, `xdate-0.8-min.js`

### The 22 arriving via `openam-ui-ria`'s own pom / source

From its pom (18): `base64-1.0.0-min.js`, `bootstrap-clockpicker-0.0.7-min.js`,
`bootstrap-datetimepicker-4.14.30-min.js`, `bootstrap-tabdrop-1.0.js`, `classnames-2.2.5.js`,
`codemirror/` (dir, from `CodeMirror:zip`), `handlebars-4.7.7-min.js`, `jquery-sortable-0.9.13.js`,
`jsoneditor-0.7.9-min.js`, `microplugin-0.0.3.js`, `qrcode-1.4.4-min.js`,
`react-bootstrap-0.30.1-min.js`, `react-input-autosize-1.1.0-min.js`,
`react-select-1.0.0-rc.2-min.js`, `redux-3.5.2-min.js`, `selectize-non-standalone-0.12.1-min.js`,
`sifter-0.4.1-min.js`, `text-2.0.15.js`

From `src/main/js/libs/` (4): `backgrid-paginator-0.3.5-custom.min.js`,
`jquery.autosize.input.min.js`, `jsoneditor-0.7.23-custom.js`, `popover-clickaway.js`

### Two collisions to resolve before splitting

Both sides supply a **handlebars** and both supply a **selectize**:

| library | from `user:zip:www` | from `openam-ui-ria`'s pom | which `main.js` binds |
|---|---|---|---|
| handlebars | `handlebars-4.7.7.js` (genuinely 4.7.7) | `handlebars-4.7.7-min.js` (**really 4.7.6**, #35) | the **`user`-side** non-min file |
| selectize | `selectize-0.12.1-min.js` | `selectize-non-standalone-0.12.1-min.js` (**identical bytes**, #68) | the **openam-side** file |

Neither side can be dropped wholesale without re-checking `main.js` — the binding goes one way for
handlebars and the other way for selectize.

**Note for 3.7's scope boundary:** `dir.xml` is explicitly *not* part of 3.7. Its `dependencySet`
blocks reference `commons.ui.libs:*` — the groupId in this table — and retire in 4.7. The
`unpack-forgerock-ui-user` execution 3.7 removes consumes `commons.ui:user:zip:www`, a different
groupId that is not in this table at all.

---

## 6. Artifacts with no npm equivalent — 8, disposition open

These are the rows that turn into decisions. **No disposition is chosen here.** For each, the three
available routes are:

- **(V) Vendor it** — check the file into the repo as source, the way the four §8 files already are.
  Keeps exact bytes; the file leaves `npm audit`'s view entirely and needs a provenance comment.
- **(R) Replace it** — adopt a different, maintained npm package and change the call sites. Real
  behaviour risk, but the dependency becomes managed and auditable.
- **(M) Keep the Maven artifact** — leave `maven-external-dependency-plugin` in place for this file
  alone. Note this route conflicts with the *Runtime libraries are managed package dependencies*
  requirement, which says runtime libraries "SHALL NOT be distributed as hand-published binary
  artifacts of this project"; taking it for any runtime row needs that requirement amended or an
  explicit exception recorded.

Grouped by whether OpenAM's runtime is blocked on the answer:

### Reaches the built OpenAM XUI — 5

| # | artifact | RequireJS id | what it is | nearest npm, and why it is not a match |
|---|---|---|---|---|
| 20 | `bootstrap-tabdrop:1.0:js` | `bootstrap-tabdrop` | eyecon.ro / Petre → Schabdach → Aranda lineage; fetched from unpinned `master`, and OpenAM's URL points at `www.eyecon.ro`, a dead vanity domain | npm `bootstrap-tabdrop` (0.0.1, 0.1.0) is `ispot-tv`'s — a different fork with no 1.0 |
| 31 | `form2js:2.0-769718a:js` | `form2js` | `maxatwork/form2js` at pinned commit `769718a1…` | npm `form2js@1.0.0` is `kirill-zhirnov`'s fork; the original was never published |
| 32 | `js2form:2.0-769718a:js` | `js2form` | a sibling file in the same repo and commit as #31 | not a package on npm under any name |
| 41 | `jquery.ba-dotimeout:1.0:min:js` | `doTimeout` | Ben Alman's doTimeout jQuery plugin | `jquery-dotimeout`, `jquery.ba-dotimeout`, `jquery-ba-dotimeout`, `dotimeout` — all 404 |
| 5 | `backgrid.min:0.3.5:less` | — (LESS → `css/`) | a LESS source for backgrid, from `aldaris/xui-deps` @ unpinned `master` (a personal repo) | npm `backgrid@0.3.5` ships `.css`, never `.less`. A fourth route exists here that the others lack: **use npm's `.css` and drop the LESS**, if nothing overrides its variables |

### Reaches only OpenIDM / OpenIG — 3

| # | artifact | consumers | what it is | nearest npm, and why it is not a match |
|---|---|---|---|---|
| 23 | `contentflow:1.0.2:min:js` | openidm-enduser | fetched from unpinned `master` of a Plone packaging repo | `npm view contentflow` → 404 |
| 38 | `jquery-cron:f831f2:js` | openidm-admin | `shawnchin/jquery-cron`; the version is a git SHA prefix but the URL fetches `master`, so the coordinate does not describe the content | npm `jquery-cron@1.0.0` is `MIAOMIAOUP`'s fork |
| 45 | `ldapjs-filter:2253:min:js` | openidm-admin | an **almond-0.2.9-bundled AMD browser build** wrapping ldapjs's filter module; vendored at `commons/ui/extlib/` and side-loaded by `maven-install-plugin:install-file` — never downloaded | npm `ldap-filter@0.3.3` is the Node-side API this derives from, not this browser bundle. `ldapjs-filter` is 404. Route (V) is arguably already taken here — the file is checked in today |

Two of the four §8 non-artifact source files are in the same position and are listed there rather
than here: `jquery.autosize.input.min.js` and `popover-clickaway.js`.

---

## 7. Modified and non-upstream builds

Of the four candidates named when this work was scoped, **two are not modified at all** and **one is
not even a Maven artifact**. All verified by byte comparison against npm tarballs.

| candidate | modified? | what is actually different | closest npm |
|---|---|---|---|
| **`bootstrap:3.3.5:custom:js` + `:custom:css`** | **NO** | MD5-identical to `bootstrap@3.3.5` `dist/js/bootstrap.js` (`8015042d…`) and `dist/css/bootstrap.css` (`957474c3…`). The `downloadUrl` is the plain upstream cdnjs dist. **The `custom` classifier is a naming fiction** — there is no customization to preserve | `bootstrap@3.3.5`, nothing to carry over but the name |
| **`selectize-non-standalone:0.12.1:min:js`** | **NO** | MD5-identical (`7a8aec7b…`) to `selectize:0.12.1:min:js` *and* to `selectize@0.12.1` `dist/js/selectize.min.js`. Both artifacts resolve from the **same cdnjs URL**. The file both contain **is** the non-standalone (AMD-dependent) build; npm's actual standalone build (`dist/js/standalone/selectize.min.js`, `146435ee…`) is used by neither | one `selectize@0.12.1` covers both artifactIds. The `sifter`/`microplugin` shim deps in `main.js` exist *because* this is the non-standalone build, and become real npm deps |
| **`backgrid-paginator-0.3.5-custom.min.js`** | **YES — genuinely patched** | **Not a Maven artifact**; a checked-in file at `openam-ui-ria/src/main/js/libs/`. Two changes against the Maven artifact: (a) the AMD wrapper's define deps change `backbone-pageable` → `backbone.paginator`; (b) `Backgrid.Extension.PageHandle.title` changes from `_.template("Page <%- label %>", null, {variable: null})` to a plain `function (a) { return "Page " + a.label; }` — **the `_.template` call that lodash 3.x broke is removed.** A lodash-3 compatibility patch, directly relevant to tasks 8.1–8.3 | `backgrid-paginator@0.3.5`. Note the *Maven* artifact is itself the **Cloudflare fork**'s build (`c08f46d1…`, 3815 B) not npm's (`ebd4b6db…`, 3915 B), so the base is already non-upstream. **Disposition open** — §12 |
| **`jsoneditor-0.7.23-custom.js`** | **YES — patched and misnamed** | Also not a Maven artifact; checked in at the same place. 138961 B, unminified. Its own banner reads **`JSON Editor v0.7.22 … Date: 2015-08-12`**, while npm `json-editor@0.7.23`'s `dist/jsoneditor.js` (237883 B) reads `v0.7.23 … 2015-09-27`. So it is a **patched 0.7.22 labelled 0.7.23**, ~100 kB smaller than the upstream 0.7.23 dist — the diff is substantial, not cosmetic | `json-editor@0.7.22` is the true base; `0.7.23` is the nearest published release. Its Maven counterpart `jsoneditor:0.7.9:min:js` (#44, which *is* MD5-identical to `json-editor@0.7.9`) ships alongside it and is **dead** — `main.js` binds `jsonEditor` only to the `-custom` file. **Disposition open** — §12 |

### Further non-upstream builds not previously flagged

| artifact | why it is non-upstream |
|---|---|
| `backgrid-paginator.min:0.3.5` `:min:js` and `:css` | fetched from the **`cloudflare/backgrid-paginator`** fork, not `wyuenho`. Both differ from npm (js 3815 vs 3915 B; css 847 vs 1212 B) |
| `backgrid.min:0.3.5:less` | fetched from **`aldaris/xui-deps` @ master** — a personal repo on an unpinned branch. npm `backgrid` never shipped a `.less` |
| `handlebars:4.7.7:min:js` | the `downloadUrl` hardcodes `handlebars.js/`**`4.7.6`**`/handlebars.min.js`. MD5-confirmed as `handlebars@4.7.6`. **The artifact version label is simply wrong** |
| `less:1.5.1:rhino:js` | fetched from the **`v1.7.5` tag**. Only `less@1.7.5`'s tarball contains `dist/less-rhino-1.5.1.js` (MD5-confirmed); `less@1.5.1`'s does not |
| `bootstrap-tabdrop:1.0`, `jquery-cron:f831f2`, `jquery-sortable:0.9.13`, `contentflow:1.0.2` | all fetched from an **unpinned `master` branch**, so the version in the coordinate does not determine the content |
| `xdate:0.8:min:js` | the `min` classifier is false — the file is `src/xdate.js`, unminified (MD5-confirmed) |
| `ldapjs-filter:2253:min:js` | an almond-bundled AMD browser build, vendored in `commons/ui/extlib/` and side-loaded by `install-file`. No upstream release corresponds to it |

---

## 8. Files in the built `libs/` tree that come from no artifact

Exactly **4**, all in `OpenAM/openam-ui/openam-ui-ria/src/main/js/libs/`, copied into
`target/XUI/libs` by the `maven-resources-plugin` resource root `${basedir}/src/main/js`.

**`commons/ui` has no source `libs/` directory at all** — `find commons/ui -type d -name libs`
outside `target/` returns nothing, so every file in the `user` zip's `libs/` came from a Maven
artifact. All four of these are OpenAM's.

| file | size | what it is | npm equivalent |
|---|---|---|---|
| `backgrid-paginator-0.3.5-custom.min.js` | 3915 B | patched Cloudflare `backgrid-paginator` 0.3.5 (§7); bound as `backgrid.paginator` | `backgrid-paginator@0.3.5` **+ the patch** — disposition open, §12 |
| `jsoneditor-0.7.23-custom.js` | 138961 B | patched `json-editor` **0.7.22** mislabelled 0.7.23 (§7); bound as `jsonEditor` | `json-editor@0.7.22`/`0.7.23` **+ a diff review** — disposition open, §12 |
| `jquery.autosize.input.min.js` | 1503 B | `Plugins.AutosizeInput` — MartinF/jQuery.Autosize.Input. Bound as `autosizeInput` (shim: deps jquery, exports autosizeInput) | **none.** `jquery-autosize-input`, `jquery.autosize.input` → 404; npm `autosize-input` (yuanqing) is a different library. Same three routes as §6 |
| `popover-clickaway.js` | 3668 B | a local XUI-only Bootstrap-popover helper — this project's own code, not third-party | **none** — `popover-clickaway`, `bootstrap-popover-clickaway` → 404. Not a dependency at all; it is source that belongs in `src/main/js` |

---

## 9. Shipped-but-unbound files, and pom/tree reconciliation

`target/XUI/libs` = 47 entries. `main.js` `paths` binds 38. **Every one of the 47 traces to either an
artifact or §8, and every artifact that should land there does** — nothing in the tree has no
origin, and nothing the poms promise is missing from the tree.

The css/less/zip artifacts land in `target/XUI/css` and `css/fontawesome` rather than `libs/`, per
the `<include>…:*:css</include>` `dependencySet` blocks in
`commons/ui/commons/src/main/assembly/zip.xml`, `commons/ui/user/…/zip.xml` and
`openam-ui-ria/src/main/assembly/dir.xml`.

Nine of the 47 are bound by none of `main.js`, `main-authorize.js` or `main-device.js`. Three are
loaded another way; six are dead weight. **Whether the dead six get ported or dropped is open** —
they are recorded as findings, not as a deletion plan:

| file | status |
|---|---|
| `base64-1.0.0-min.js` | **used** — plain `<script>`, `src/main/resources/index.html:21` |
| `requirejs-2.3.7-min.js` | **used** — plain `<script>`, `index.html:28` (the loader itself) |
| `codemirror/` (dir) | **used** — literal AMD paths `libs/codemirror/lib/codemirror`, `mode/groovy/groovy`, `mode/javascript/javascript`, `addon/display/fullscreen` from `EditScriptView.js` |
| `backgrid-paginator.min-0.3.5-min.js` | **dead** — superseded by the `-custom` file |
| `jsoneditor-0.7.9-min.js` | **dead** — superseded by the `-custom` file |
| `selectize-0.12.1-min.js` | **dead** — superseded by `selectize-non-standalone-0.12.1-min.js`, which is the *same bytes* |
| `handlebars-4.7.7-min.js` | **dead** — declared only "to fix the processing dependencies in the release build"; all three main files bind the non-min `handlebars-4.7.7` |
| `dragula-3.6.7-min.js` | **dead in OpenAM** — arrives via `commons`; `grep -ri dragula src/main/js` in openam-ui-ria finds zero references |
| `jquery.placeholder-2.0.8.js` | **dead in OpenAM** — arrives via `commons`; in no `paths` block |

---

## 10. Version deltas that are behaviour changes, not numbers

`lodash 3 → 4` is already scoped as tasks 8.1–8.3. The others are recorded here at the same level of
detail. **Nothing in this section is fixed by task 3.1.** Call-site counts are over
`OpenAM/openam-ui/openam-ui-ria/src/main/js`.

### lodash 3.10.1 → 4.18.1 — already scoped as 8.1–8.3

- **Blast radius: 135 modules** `require("lodash")` — by far the widest of any dependency here.
- 25 known call sites of APIs removed in lodash 4: `_.pluck` ×4, `_.contains` ×18, `_.where` ×3.
- `main.js` also `map`s **`"underscore" → "lodash"`**, so any surviving underscore-idiom call site
  resolves to lodash too (the TODO at `main.js:32` acknowledges this).
- **Already half-migrated in a way that hides the problem:** `openam-ui-ria/package.json`
  devDependencies pins **`lodash 4.18.1`** while the shipped runtime is 3.10.1. Build-time and
  runtime lodash are two majors apart *today*.
- The `backgrid-paginator` patch in §7 exists *because* of a lodash-3 `_.template` signature change —
  evidence this boundary has already drawn blood once in this tree.

### backbone 1.1.2 → 1.6.1 — a minor number, a real behaviour change

- **Blast radius: 42 modules** `require("backbone")`; 51 `Backbone.*` references.
- 1.1.2 is from February 2014. Since then: `Backbone.View` stopped accepting arbitrary options as
  instance properties (the `options` whitelist was removed in 1.1.0 and `this.options` auto-assign
  never came back), `Model#set` validation and `Collection#set` merge semantics changed,
  `View#remove`/`stopListening` cleanup tightened, and `_.template` compilation inside views moved.
  **Views that read `this.options.foo` without assigning it are the concrete failure mode.**
- `main.js` shims backbone `deps: ["lodash"], exports: "Backbone"`. Modern Backbone is a proper UMD
  module and needs **no shim** — so the shim must be **deleted, not translated**. Same for the six
  extension shims hanging off it: `backbone.paginator`, `backbone-relational`, `backgrid`,
  `backgrid-filter`, `backgrid.paginator`, `backgrid-selectall`.
- **`backbone-relational` is pinned at 0.9.0** (npm latest 0.10.0) and is compatible only with old
  Backbone. Bumping backbone without bumping it breaks relations.

### react 15.2.1 → 19.2.8 — four majors

- **Blast radius: 17 modules** `require("react")`, 2 `require("react-dom")`, **37 `PropTypes`
  references**.
- The four hard breaks, in order of pain:
  1. **`React.PropTypes` was removed in React 16.** All 37 references must move to the separate
     `prop-types` package. `React.createClass` went at the same time — `grep -c createClass` = **0**,
     so that one is already clear.
  2. **`ReactDOM.render` was removed in React 19** in favour of `createRoot`. Both `react-dom` call
     sites change shape.
  3. React 16 changed error handling — an uncaught render error now unmounts the whole tree unless an
     error boundary exists. **There are no error boundaries in this tree.**
  4. React 17 removed event pooling / `SyntheticEvent` reuse and re-parented event delegation from
     `document` to the root container. XUI mixes React islands into a jQuery/Backbone page, so
     delegation changes are a live risk, not a theoretical one.
- The whole React ecosystem is at the same wall and must move together: `react-dom 15.2.1 → 19.x`,
  **`react-bootstrap 0.30.1 → 2.10.10`** (a total API rewrite — 0.30 is pre-1.0; component names,
  props and the Bootstrap major all changed), `react-input-autosize 1.1.0 → 3.0.0`,
  **`react-select 1.0.0-rc.2 → 5.10.2`** (complete rewrite; **v2+ dropped the CSS file entirely** in
  favour of emotion, so artifact #63 has no successor to point at).
- The two synthetic shim modules `reactAutosizeInputDep` and `reactSelectDep` (`main.js` ~176–187)
  exist purely to leak `window.React`, `window.ReactDOM`, `window.classNames` and
  `window.AutosizeInput` into UMD globals for the pre-bundled react-select / react-input-autosize
  dists. Under npm plus a bundler those globals disappear and **both shims must be deleted.**

### redux 3.5.2 → 5.0.1 — two majors

- **Blast radius: 3 modules** — small, but the change is structural rather than textual.
- Redux 4 made `store.replaceReducer` and the `Store` type stricter and dropped the `redux/lib/*`
  deep-import paths.
- **Redux 5 is ESM-only, with named exports and no UMD or global build at all.** The
  script-shaped `libs/redux-3.5.2-min.js` has no equivalent — **redux cannot be ported as a file
  drop the way it is loaded today.** It also drops IE11 and requires a bundler.
- `createStore` is deprecated in Redux 5 in favour of `configureStore` from `@reduxjs/toolkit`; the
  OpenAM `store/` tree is small enough that this is the natural landing place rather than a bare
  `redux@5`.
- `main-authorize.js` and `main-device.js` each bind `redux` too, so both small entry points move
  with the main one.

### Same class, lower blast radius

- **`i18next 1.7.3 → 26.3.6`** — twenty-five majors. 1.7.3 is a jQuery-coupled build (`main.js` shims
  it `deps: ["jquery","handlebars"], exports: "i18n"`). Modern i18next has no jQuery coupling, a
  different init contract (promises, not callbacks), and a plugin architecture for backends and
  detectors. Effectively a rewrite of the i18n bootstrap.
- **`d3 3.5.5 → 7.9.0`** — four majors; v4 split the monolith into modules and renamed most of the
  API. Reaches openig-ui and openidm-ui only, not OpenAM.
- **`jquery 3.7.1`** is the one already-modern pin. npm latest is 4.0.0, one major ahead, which will
  matter for the jQuery-shimmed plugins (`doTimeout`, `autosizeInput`, `clockPicker`, `bootstrap`,
  `bootstrap-tabdrop`, `sortable`, `selectize`) but not urgently.

---

## 11. What this means for D5, D8 and the dual build

- **D8 — Maven stays the outer build.** The `commons.ui.libs` `dependencySet` blocks in `dir.xml`
  retire "as their contents move to npm", and the CodeMirror zip unpack is reassessed at that point.
  This table is the list of contents that has to move. #22 `CodeMirror:zip` is the reassessment case:
  it is loaded by literal path from `EditScriptView.js`, not through `main.js` `paths`, so it does
  not follow the same route as the rest.
- **D5 — dual-build commons packages.** None of the 76 rows *is* the commons UI; they are its
  third-party dependencies. What the table settles for 3.2/3.3 is which of them `commons/ui/commons`
  must declare, since `commons/ui/user` declares none of its own — and the *Dual-build commons
  drift* risk applies to the commons source, not to these.
- **The eight no-equivalent rows are the only ones that can block the
  managed-package-dependencies requirement**, because route (M) — keeping a Maven artifact — is the
  one route that contradicts it directly. Six of the eight are runtime in OpenAM or OpenIDM.

---

## 12. Open decisions this inventory deliberately does not make

| # | decision | options | who reads it |
|---|---|---|---|
| 1 | Disposition of each of the 8 no-npm-equivalent artifacts (§6) | (V) vendor / (R) replace with a different package / (M) keep the Maven artifact — with the caveat that (M) contradicts the managed-package-dependencies requirement for runtime rows | 3.2, 3.3 |
| 2 | Disposition of `jquery.autosize.input.min.js` (§8) | same three routes; it is already vendored today, so (V) is the status quo | 3.2, 3.3 |
| 3 | `backgrid-paginator-0.3.5-custom.min.js` (§7) | keep vendored as-is / `backgrid-paginator@0.3.5` + a `patch-package`-style override / take npm unpatched and fix the `_.template` call site as part of 8.1–8.3 | 3.2, 8.1–8.3 |
| 4 | `jsoneditor-0.7.23-custom.js` (§7) | keep vendored / diff against `json-editor@0.7.22` first and decide after / adopt `0.7.23` unpatched. **A line-level diff does not exist yet** — see §13 | 3.2 |
| 5 | The dead `jquery.qrcode` dependencyManagement entry, #43 | delete from `OpenAM/pom.xml` / leave it. Nothing references it and it is absent from `~/.m2`, so neither choice affects a build | 4.7 |
| 6 | The six dead shipped-but-unbound files (§9) | port them anyway / drop them. Each is superseded by, or unreferenced from, a file that is bound | 4.7 |
| 7 | Whether `tasks.md`'s "~20" wording gets corrected to 76 | correct it / leave it and rely on this file. **Not changed by task 3.1** | — |
| 8 | The four poms that drop `<scope>test</scope>` (§4) | fix the scope as part of the port / port as-is and classify manually into `devDependencies` | 3.2, 3.3 |

---

## 13. Could not determine

- **`less@1.5.1` vs `less@1.7.5`** — the byte match is unambiguous (`a6373b16…` == `less@1.7.5`
  `dist/less-rhino-1.5.1.js`), but *why* the Maven coordinate says 1.5.1 while the URL pins tag
  v1.7.5 is recorded nowhere in the poms. Affects OpenIDM and selfservice only, not OpenAM.
- **`ldapjs-filter:2253`** — the "version" `2253` corresponds to no tag, release or commit that could
  be identified. The file is an almond bundle of Mark Cavage's ldapjs filter code; which ldapjs
  revision it was cut from cannot be recovered from the bundle.
- **The five unpinned-`master` artifacts** (`bootstrap-tabdrop`, `jquery-cron`, `contentflow`,
  `jquery-sortable`, `backgrid.min:less`) — what content a *fresh* fetch would produce cannot be
  determined from the checkout, because the URLs are branch refs. **The bytes currently in `~/.m2`
  are whatever a past build happened to download.** This is a reproducibility hole independent of the
  npm migration, and a second argument for retiring the plugin.
- **`jsoneditor-0.7.23-custom.js`** — confirmed a patched **0.7.22** by banner and size, but no
  line-level diff against `json-editor@0.7.22` was produced. It is a 139 kB unminified file and
  characterising the patch is its own task. Recorded rather than guessed; open decision #4 depends
  on it.
- **Stale `~/.m2` residue** — `moment/2.8.1`, `qrcode/1.0.0`, `handlebars/4.0.5` and `sinon/1.15.4`
  sit in `~/.m2` but are declared as `<artifactItem>`s only by `OpenIG/pom.xml` and
  `OpenIDM/openidm-ui/pom.xml`, not as dependencies of any module in the OpenAM path. They inflate
  the "~58" figure and are not counted among the 76.

---

## 14. Method

Read-only. The poms were read; the registry was queried with `npm view <pkg> versions --json` and
`npm view <pkg>@<version>`; tarballs were fetched with `npm pack` into a scratch directory and
`md5sum`-compared against the `~/.m2` artifacts, then deleted. Registry reachability was confirmed
first (`npm view lodash version` → `4.18.1`).

`mvn` was never run — deliberately. `maven-external-dependency-plugin`'s `clean-external` goal
deletes these artifacts from `~/.m2`, and because they are published to no repository, a `mvn clean`
in `commons/ui` (or `mvn … -am` from a root that includes it) destroys the only copies. Nothing was
`npm install`ed and no `package.json` was created.

The built-tree figures come from a pre-existing `OpenAM/openam-ui/openam-ui-ria/target/` from an
earlier build: `ls target/XUI/libs` (47), `ls target/dependencies-expanded/forgerock-ui-user/libs`
(25), and `comm -13` between them (22).
