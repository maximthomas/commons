# `@openidentityplatform/ui-commons`

The shared commons UI as an npm package, carrying **an ES module build and an AMD build produced
from one source**. The AMD sources under `src/main/js` are that source; the ES module tree is
generated from them by `build/npm-package.js`.

Nothing here replaces the Maven `commons.ui:commons:zip:www` artifact. That zip is still produced,
unchanged, from the same sources — this package is an additional channel, not a migration of the
existing one. `commons/ui/user` and `OpenIG/openig-ui` consume the zip directly and four more
modules consume it through `user:zip:www`.

## Building it

```sh
npm install
npm run build:npm        # -> target/npm
npm run verify:esm       # imports the emitted ES module tree and exercises the loader seam
```

`grunt build` runs the emit and the lint, and `frontend-maven-plugin` binds `grunt build` to
Maven's `compile` phase — ahead of `maven-resources-plugin` and `maven-assembly-plugin`, which both
bind to `package`. No phase juggling was needed.

`grunt verify` — the default task, so a bare `grunt` runs it — is `build` plus the ES module
checks. **The split is deliberate.** A failure in the ESM checks must not stop the `www` zip from
being assembled, because that zip is phase 1's rollback channel: a rollback channel the new work
can break is not a rollback channel. The cost, stated so it is not discovered later, is that a
green `mvn install` is *not* evidence the ES module build imports — only `grunt verify` is, and
task 3.5's CI job is what makes it run on every change.

Generated output goes to `target/` only. Writing it beside the sources would put it inside the
Maven zip, because `target/classes` is filled from the two `<resource>` directories
(`src/main/js`, `src/main/resources`) and the assembly copies `target/classes` wholesale.

## What the package contains

| directory | files | what it is |
|---|---:|---|
| `amd/` | 65 | AMD modules, ids unchanged, run through Babel with the consumer's own presets |
| `esm/` | 66 | ES modules — 64 generated, 2 hand-written (see below) |
| `www/` | 63 | templates, partials, less, images, `favicon.ico`, `oauthReturn.html` |

`www/` breaks down as `css/` 37, `templates/` 14, `images/` 9, `partials/` 1, plus the two root
files. Together `amd/` + `www/` are the 128 files this module contributes to the composed UI
today — 60 under `org/forgerock/commons/ui/common/**`, 5 under `config/`, and the 63 in `www/`.

`MANIFEST.txt` in the built package lists all 200 packed paths — the three trees above plus
`package.json`, `MANIFEST.txt`, `NPM-PACKAGE.md`, `LICENSE.md` and the two nested `type` markers
under `amd/` and `esm/`.

Its contents are **`build/expected-payload.txt`, which is committed**, and the build asserts the
emitted tree against that record path by path. This matters more than it looks: a manifest
generated from the same walk that produced the tree is a comparison of a run against itself and
cannot fail, and counts alone miss a file that moved or was renamed — the case that reaches a
consumer as a resolution error at run time. Regenerate deliberately, with

```sh
npm run update:payload-record     # then commit the diff with the change that caused it
```

Diff it with `LC_ALL=C sort` on both sides. The list is in code-unit order; a bare `sort` folds
case and ignores `/`, which turned an identical set of 199 paths into some sixty lines of noise
when it was measured.

The build also asserts the per-directory counts first, because "www/ is 62, expected 63" is a
better first message than a path diff when a whole directory goes missing.

### Licence

The package declares `CDDL-1.1` and ships the repository's `LICENSE.md`.

Both halves were wrong before task 3.2's review, and in a way worth recording. `package.json` said
`CDDL-1.0` — matching the per-file header boilerplate, which points at `legal/CDDLv1.0.txt` —
while the repository's own `LICENSE.md` is CDDL **1.1**. And the tarball carried no licence text
at all, so it declared a licence a consumer had nothing to read. The repository-level licence is
authoritative, so the declaration moved to `CDDL-1.1` and the file is now copied into the payload
rather than duplicated beside this build, where a second copy would be free to drift.

`build/npm-package.js` asserts that the version in the shipped text's heading matches the declared
identifier, so the two cannot silently disagree again — that mismatch is the defect this replaced.

**Residual, out of scope here:** every source header in this module still names `CDDLv1.0.txt`.
Reconciling those is a repository-wide edit reaching far beyond `commons/ui`, so it is recorded
rather than attempted inside a build change.

### Why `www/` is shipped even though it has no module ids

None of those 63 files is reachable through a module id, and no `exports` entry or `paths` entry
delivers them:

- **Templates and partials** are fetched at run time by URL — `UIUtils.js` calls
  `$.ajax({ url: require.toUrl("templates/common/404.html") })`. They have to exist as
  individually addressable files under the deployed web root, which is also what lets a theme
  override one file without repackaging anything.
- **Less files** are pulled in by flat path — a product's `structure.less` says
  `@import "common/structure.less"`, resolved against its composition directory, not through npm.
- **Images** are referenced from less and HTML by relative URL.

So a consumer copies `www/` into its web root. That is true regardless of which module system it
uses, and it is why the `paths` integration below cannot replace a copy step entirely.

## How an AMD consumer resolves a module id

**Not through `exports`.** RequireJS and `r.js` resolve a module id by concatenating `baseUrl` (or
a matching `paths` prefix) with the id and appending `.js`. They never read `package.json` — not
`main`, not `exports`, not `module`. This was measured against `requirejs` 2.3.7, the version
`openam-ui-ria` builds with: with a valid `exports` field present and pointing at real files, the
load still failed with

```
Tried loading "org/forgerock/commons/ui/common/main/Router" at
<app>/org/forgerock/commons/ui/common/main/Router.js then tried node's require(...)
```

The emitted `exports` map therefore covers the ES module build and `www/` only. `./amd/*` is
deliberately absent — see `NOTES-dual-build.md` §2 and the header of `build/npm-package.js`.

There are two mechanisms that do work.

### 1. A RequireJS `paths` entry — pinned narrow

```js
require.config({
    paths: {
        "org/forgerock/commons/ui/common":
            "node_modules/@openidentityplatform/ui-commons/amd/org/forgerock/commons/ui/common"
    }
});
```

The prefix **must** stop at `.../ui/common`. A broader `"org/forgerock/commons"` sends
`org/forgerock/commons/ui/user/**` — the sibling `ui-user` package — looking inside this package,
where it does not exist.

Two consequences worth knowing before choosing this route:

- **A `paths` entry beats the consumer's own file at the same path.** The Grunt composition is a
  last-wins overlay in which a product file overrides a commons file; a `paths` entry inverts
  that, and both the RequireJS runtime and `r.js` were measured resolving to the package's module
  with a product file present. Nothing in `openam-ui-ria` currently collides with a commons path,
  but the override mechanism is in active use against the neighbouring `user` module.
- **Keep the prefix away from `config/`.** `openam-ui-ria` sets
  `excludeShallow: ["config/AppConfiguration", "config/ThemeConfiguration"]` so a deployment can be
  customised without repackaging, which depends on those ids resolving to the product's files on
  disk. A `paths` entry capturing `config/` disables that silently. The narrow prefix above cannot
  reach it.

### 2. A copy step

Copy `amd/` into the composition directory ahead of the consumer's own sources, which is what
`openam-ui-ria`'s `copy:compose` already does with the unpacked zip. This preserves last-wins, so
a product file at the same path still overrides the package's, and the files then go through the
consumer's own Babel step like any other.

## How an ES module consumer resolves a module id

**By aliasing the id prefix, not by `exports` alone.** `exports` covers the first hop:

```js
import Router from "@openidentityplatform/ui-commons/esm/org/forgerock/commons/ui/common/main/Router.js";
```

The `.js` is required. `exports` subpath patterns do literal substitution and never append an
extension — Node and webpack in strict ESM mode fail with `ERR_MODULE_NOT_FOUND` without it, and
only Vite papers over the difference by retrying.

That first hop is as far as `exports` gets you. The generated modules import **each other** by the
same absolute, extensionless ids the AMD build uses (`org/forgerock/commons/ui/common/...`), which
no `exports` entry can resolve, because they are bare specifiers rather than package subpaths. A
consumer must alias that prefix to the package's `esm/` directory — the ES module equivalent of the
`paths` entry above, and the reason the `"."` entry in `exports` is of little practical use: it
points at `main.js`, whose twelve imports are all bare `org/...` ids, so it only resolves for a
consumer who has already configured the alias and would therefore import by id anyway.

Keeping one id space across both builds is what makes the AMD and ES module trees auditably the
same modules, and it is what `absolutiseImports` in `build/npm-package.js` enforces. The cost is
this alias requirement. The alternative — emitting `@openidentityplatform/ui-commons/esm/<id>.js`
as the internal specifier, which the `exports` map above already resolves, including from inside
the package itself — would make the ES tree import with no consumer configuration at all, at the
price of the shared id space and of the consumer's ability to override a commons module by
aliasing one id.

**That trade is settled: one shared id space, and the consumer supplies the alias.** It is recorded
as **D19** in `design.md`, beside D5, with the measured evidence for the rejected alternative —
Node self-reference does resolve through the `exports` map above, so "it would not work" is not the
reason it was turned down. Overridability is. Task 3.7 and every ESM consumer after it inherit this
choice, so change it there rather than here.

The alias carries the same override hazard the AMD `paths` entry does: it wins over a consumer file
at the same id, inverting the last-wins overlay. See the two bullets under route 1.

### The alias does not reach `config/`

One prefix is not enough. The package ships five modules under `config/`, not under
`org/forgerock/commons/ui/common/`:

```
config/errorhandlers/CommonErrorHandlers.js   config/process/CommonConfig.js
config/messages/CommonMessages.js             config/routes/CommonRoutesConfig.js
config/validators/CommonValidators.js
```

Nothing inside the package imports them — they are leaves, composed by the product, which pulls
them into its own `config/AppConfiguration`. So the prefix alias above leaves them unreachable, and
a consumer wanting them has to bind them as well.

**Do not do that by aliasing `config/` wholesale.** That prefix is the product's: `config/AppConfiguration`
and `config/ThemeConfiguration` are precisely the two files `openam-ui-ria` keeps out of the r.js
bundle (`excludeShallow`, `Gruntfile.js:254-257`) so a deployment can be customised without
repackaging, and commons imports `config/AppConfiguration` *from* the product. An alias for the
whole prefix points the product's own configuration at this package and inverts that. Alias the
five ids individually, or copy them into the composition directory the way route 2 does.

### Identifiers the consumer must supply

These are not package dependencies and are absent from `peerDependencies` on purpose. Commons
names them so a product can bind them; the product decides what they are. Under AMD they come from
`require.config.map`; under ES modules they are build-time aliases.

| identifier | declared by | what it must resolve to |
|---|---|---|
| `underscore` | 25 modules | `openam-ui-ria` maps it to **lodash**. It is not the `underscore` package. |
| `ThemeManager` | `main/AbstractView`, `util/UIUtils` | the product's theme manager |
| `NavigationFilter` | `components/Navigation` | the product's navigation filter |
| `config/AppConfiguration` | `main/Configuration` | the product's application configuration |

Commons references no product module path anywhere — that was checked across all of `src/main`,
not just the JavaScript.

### Five library ids are not their npm package names

These are RequireJS ids bound by the product's `paths` block, and five of them differ from the
package that provides them. Under AMD the `paths` block already absorbs this; an ES module
consumer has to alias them, and gets an unresolved-import error otherwise.

| module id in the source | npm package |
|---|---|
| `spin` | `spin.js` |
| `placeholder` | `jquery-placeholder` |
| `bootstrap-dialog` | `bootstrap3-dialog` |
| `backgrid-selectall` | `backgrid-select-all` |
| `backgrid.paginator` | `backgrid-paginator` |

The remaining thirteen — `backbone`, `backbone.paginator`, `backgrid`, `backgrid-filter`,
`dragula`, `handlebars`, `i18next`, `jquery`, `lodash`, `moment`, `react`, `react-dom`, `xdate` —
match their package names and need no alias.

That accounting is checked, not asserted. `npm run verify:esm` walks every import in the emitted
tree and fails if any external specifier is not one of these thirteen, one of the five renames
above, one of the four supplied identifiers, or the rebound `underscore` — so a new dependency
cannot be added without this file being updated to match. It fails in the other direction too: a
rename listed here that nothing imports any more, or one whose target is not a declared peer.

### The three loader APIs with no ES module equivalent

Four modules use RequireJS APIs that simply do not exist in an ES module. The ES build routes them
through `org/forgerock/commons/ui/common/util/esm/LoaderRuntime`, which exists **only in the ES
build**, and the consuming application injects the answers:

```js
import { configure } from "@openidentityplatform/ui-commons/esm/org/forgerock/commons/ui/common/util/esm/LoaderRuntime.js";

const modules = import.meta.glob("./org/forgerock/**/*.js");

const libraries = {
    "bootstrap": () => import("bootstrap"),
    "bootstrap-dialog": () => import("bootstrap3-dialog")
};

configure({
    baseUrl: "/XUI/",
    urlArgs: "v=14.0.0",
    moduleConfig: { i18nLoad: "current" },
    resolveModule: (id) => (modules[`./${id}.js`] || libraries[id] || (() => undefined))()
});
```

The `libraries` map matters, and it cannot be collapsed into a bare `import(id)` fall-through.
Three of the ids commons passes to `ModuleLoader.load` are **library names, not module paths** —
`main/AbstractView` and `components/Navigation` load `"bootstrap"`, and `util/UIUtils` loads
`"bootstrap-dialog"` — and the glob matches neither. `import(id)` on a *runtime* string is
untraceable by every bundler, so nothing gets included in the build, and resolving a bare specifier
in a browser needs an import map besides. The two entries above are static strings a bundler
follows normally. Note that `"bootstrap-dialog"` is one of the renamed ids: the package is
`bootstrap3-dialog`.

An id nothing covers now **rejects, naming the id**, rather than resolving with `undefined` — the
final `(() => undefined)` is deliberate, not a hole. Getting `undefined` back was worse than an
error: `ModuleLoader` hands the value straight to callers such as `ViewManager.changeView`, which
then fails on a property of `undefined` with no mention of which module was missing.

`loadModule` returns the module's **default export** when the resolved record has one, and the
namespace otherwise, so callers receive the same value the AMD loader gave them. Both module-record
shapes are unwrapped: `Symbol.toStringTag === "Module"` for a native namespace, and `__esModule` for
a Babel/webpack interop object. Testing only `__esModule` — the marker the AMD build's `ViewManager`
uses, and the obvious thing to reach for — misses every native namespace, which is exactly what
`import.meta.glob` produces. The same unwrap is exported as `unwrapModule` and is what
`main/ViewManager`'s patched React-adapter import uses, so there is one implementation of that
decision rather than two spellings of it.

| API | used by | replaced with |
|---|---|---|
| `require.toUrl(path)` | `util/UIUtils`, `main/i18nManager` | `LoaderRuntime.toUrl` |
| `module.config()` | `main/i18nManager` | `LoaderRuntime.moduleConfig` |
| `require([runtime id], cb)` | `util/ModuleLoader.load` | `LoaderRuntime.loadModule` |

`resolveModule` is design decision D1's registry. Until a consumer supplies one, `loadModule`
rejects with a message naming what is missing, rather than failing somewhere unrelated.

**Cache-busting.** `urlArgs` is appended by `toUrl` exactly as RequireJS appends its own `urlArgs`,
as a string or as `(resourcePath, url) => String`. Without it an ES module consumer could not
reproduce the `?v=<version>` the deployed product puts on templates and locales today, since both
of `toUrl`'s call sites resolve URLs that RequireJS cache-busts. A consumer whose asset URLs come
from a bundler manifest instead can replace the resolution outright with `resolveUrl:
(path) => String`, which is the seam design decision D4's `resolveAssetUrl` plugs into rather than
routing around.

`main/ViewManager`'s lazy `require(["…/ReactAdapterView"])` needed no resolution help — its id is a
literal, so it became a plain `import()` a bundler can trace — but it does go through
`unwrapModule` for the reason above.

### Checking it

```sh
npm run build:npm && npm run verify:esm
```

`verify:esm` imports the emitted tree through the same single prefix alias this section documents
and exercises the seam: both record shapes, a resolver that returns nothing, one that throws
synchronously, `toUrl` with and without `urlArgs`, and `ModuleLoader.load` end to end. It exists
because everything the emit script checks is textual, and all of it passed on a tree whose
`loadModule` returned namespaces to all 20 call sites.

Two things are stubbed under Node and named in its output: `jquery`, because jQuery 3 without a
`document` yields a factory rather than the jQuery object, and the three product-supplied
identifiers. Anything reaching the Backbone view layer needs a real DOM — `components/Messages`
instantiates a view at module scope — which is task 3.5's CI environment to decide, not something
to fake here.

## The two hand-written ES modules

Everything under `esm/` is generated except these, which live in `src/main/esm/`:

- **`org/forgerock/commons/ui/common/main.js`** — the generator throws on the AMD original, which
  is a named `define` carrying a dependency array and no factory function. The build compares its
  twelve imports against the AMD dependency array and fails if they diverge.
- **`org/forgerock/commons/ui/common/util/esm/LoaderRuntime.js`** — the seam described above. It
  has no AMD counterpart, because under AMD the loader supplies all three APIs directly.

The other four affected files are **not** hand-written. Their generated output is patched at
exactly the loader call sites, and every patch asserts its own hit count, so a change in the AMD
source fails the build instead of shipping a silently broken ES module. Maintaining hand-written
copies of files like `UIUtils.js` — 400+ lines — would create two copies to keep in step, which is
a worse problem than the one it solves.

## Dependencies

`peerDependencies` lists the 18 libraries commons' own modules actually import, at the versions the
source is written against.

They are peers rather than dependencies because the consuming product's RequireJS `paths` block is
the single binding authority for all of them — and for `handlebars` it deliberately binds a
different file than this package's source expects. A nested second copy of jQuery, lodash, Backbone
or React in a UI composed by flat overlay into one global namespace means two plugin registries and
failing `instanceof` checks across the commons/product boundary, not a subtle version skew.

`devDependencies` repeats the peer set at exact versions so commons can resolve its own bare
specifiers without a consumer present — otherwise `npm run verify:esm` could not import the ES
module build at all.

### `lodash` is the one range that is not a caret

`">=3.10.1"`, deliberately, and the reason is worth knowing before task 3.3 copies this shape into
`ui/user`.

`openam-ui-ria` is two majors apart from itself: it **runs** lodash 3.10.1, delivered by the
`commons.ui.libs` zip, while its own `package.json` pins `lodash 4.18.1` as a build-time
devDependency. `LIBS-INVENTORY.md` section 10 records the split; tasks 8.1–8.3 close it. It is also
the only one of these 18 peers that `openam-ui-ria` has in its npm tree at all — the other 17 arrive
through Maven and cannot collide.

So `^3.10.1` made the packed tarball impossible to install into the one consumer phase 1 targets.
Measured, against a tree holding lodash 4.18.1:

```
npm error code ERESOLVE
npm error Found: lodash@4.18.1
npm error Could not resolve dependency:
npm error peer lodash@"^3.10.1" from @openidentityplatform/ui-commons@3.2.0-SNAPSHOT
```

That is task 3.7 failing at its first step. `">=3.10.1"` rather than `"^3.10.1 || ^4.0.0"` because
the source is still written against lodash 3 semantics — 8.1 has yet to replace the 25 call sites
of `_.pluck`, `_.contains` and `_.where` that lodash 4 removed — so the wider range states what is
true, that this package needs at least 3.10.1 and the consumer's loader binding decides which copy
it actually gets, without asserting a lodash 4 compatibility that does not hold yet.

Two non-fixes, both measured: `--legacy-peer-deps` in the consumer suppresses every peer check in
the tree rather than this one, and `peerDependenciesMeta.optional` does not help either — npm still
reports an unresolvable `peerOptional` conflict when the package is present at a non-matching
version.

### Libraries the zip ships that this package does not declare

Seven of the 25 libraries in the Maven zip's `libs/` are not in `peerDependencies`, because no
commons module imports them:

| library | where a consumer gets it |
|---|---|
| `requirejs` | the loader itself, loaded by a `<script>` tag from the product's `index.html` |
| `backbone-relational` | consumer or `ui-user` |
| `bootstrap` | consumer |
| `selectize` | consumer — `openam-ui-ria` binds its own `selectize-non-standalone` build |
| `form2js` | **no npm package exists** — pinned git commit, disposition open |
| `js2form` | **no npm package exists** — same commit, disposition open |
| `jquery.ba-dotimeout` | **no npm package exists** — disposition open |

The last three, plus `backgrid.min:less` on the CSS side, have no npm coordinate at all.
`LIBS-INVENTORY.md` §6/§12 frames the vendor / replace / keep-Maven decision for them; it is not
made here, and until it is, those files reach a consumer only through the Maven zip.

## Related

- `commons/ui/NOTES-dual-build.md` — the discovery behind these choices, including the spike that
  established how an AMD consumer reaches the build
- `commons/ui/LIBS-INVENTORY.md` — the Maven-artifact-to-npm mapping for all 76 libraries
