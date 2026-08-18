# `@openidentityplatform/ui-user`

The commons **user** UI — self-service and profile views — as an npm package, carrying **an ES
module build and an AMD build produced from one source**. The AMD sources under `src/main/js` are
that source; the ES module tree is generated from them by `build/npm-package.js`, which is a
configuration file over the emitter in `ui/build/npm-package-lib.js` shared with
`@openidentityplatform/ui-commons`.

Nothing here replaces the Maven `commons.ui:user:zip:www` artifact. That zip is still produced,
unchanged, from the same sources — this package is an additional channel, not a migration of the
existing one.

**This package does not contain commons.** See [Why commons is a peer, not embedded](#why-commons-is-a-peer-not-embedded)
— it is the one place where this package deliberately departs from the shape of the Maven zip.

## Building it

```sh
npm install
npm run build:npm        # -> target/npm
npm run verify:esm       # 8 checks — 4 modules imported, the rest checked statically
```

`grunt build` runs the lint and the emit, and `frontend-maven-plugin` binds `grunt build` to
Maven's `compile` phase — ahead of `maven-resources-plugin` and `maven-assembly-plugin`, which both
bind to `package`. `grunt verify` — the default task — is `build` plus the ES module checks.

**The split is deliberate, and is the same one `ui/commons` makes.** A failure in the ESM checks
must not stop the `www` zip from being assembled, because that zip is phase 1's rollback channel: a
rollback channel the new work can break is not a rollback channel. The cost, stated so it is not
discovered later, is that a green `mvn install` is *not* evidence the ES module build imports — only
`grunt verify` is, and task 3.5's CI job is what makes it run on every change.

Generated output goes to `target/` only. Writing it beside the sources would put it inside the
Maven zip, because `target/classes` is filled from the two `<resource>` directories (`src/main/js`,
`src/main/resources`) and the assembly copies `target/classes` wholesale.

## What the package contains

| directory | files | what it is |
|---|---:|---|
| `amd/` | 14 | AMD modules, ids unchanged, run through Babel with the consumer's own presets |
| `esm/` | 14 | ES modules, all generated — no hand-written overrides |
| `www/` | 31 | `templates/` 26, `partials/` 4, `locales/` 1 |

`amd/` is 12 modules under `org/forgerock/commons/ui/user/**` plus 2 under `config/`. Together
`amd/` + `www/` are the 45 files this module contributes to the composed UI today.

Task 3.3 names *40 templates and 5 partials*; those are the **composed tree's** totals from
`ui/NOTES-dual-build.md` §1, where 40 = 14 contributed by commons + 26 by user, and 5 = 1 + 4.
Commons' half ships in commons' own package. This one carries user's half in full, which is the
same rule `ui/commons` follows: a module packages its own `src/main/resources` verbatim, and
nothing else.

`MANIFEST.txt` in the built package lists all 65 packed paths. Its contents are
**`build/expected-payload.txt`, which is committed**, and the build asserts the emitted tree
against that record path by path — a manifest generated from the same walk that produced the tree
is a comparison of a run against itself and cannot fail, and counts alone miss a file that moved or
was renamed. Regenerate deliberately:

```sh
npm run update:payload-record     # then commit the diff with the change that caused it
```

Diff it with `LC_ALL=C sort` on both sides; a bare `sort` folds case and ignores `/`.

### Nothing under `templates/user/` may be moved or renamed

`openam-ui-ria` overrides five of this module's files, and it does so **by path, through the
last-wins composition overlay** — not by any declaration that would fail loudly if a path stopped
matching:

```
templates/user/UserProfileTemplate.html
templates/user/process/registration/userDetails-initial.html
templates/user/process/reset/resetStage-initial.html
templates/user/process/reset/userQuery-initial.html
locales/en/translation.json
```

Rename or relocate any of these and AM's override silently stops winning. The build still passes,
the package still installs, and nothing fails until a user opens their profile and sees the wrong
template. The committed payload record is what makes such a rename visible at build time rather
than at run time — which is the reason it records paths and not counts.

### Why `www/` is shipped even though it has no module ids

None of those 31 files is reachable through a module id, and no `exports` entry or `paths` entry
delivers them. Templates and partials are fetched at run time by URL — commons' `UIUtils.js` calls
`$.ajax({ url: require.toUrl("templates/user/…") })` — and the locale is fetched by i18next the
same way. They have to exist as individually addressable files under the deployed web root, which
is also what lets a theme, or a product, override one file without repackaging anything.

So a consumer copies `www/` into its web root. That is true regardless of which module system it
uses.

## Why commons is a peer, not embedded

`commons.ui:user:zip:www` is a **superset**: `src/main/assembly/zip.xml` copies `target/dependency`,
the unpacked commons `www`, into the user zip. All five of its consumers rely on that —
`openam-ui-ria`, `openidm-ui-admin`, `openidm-ui-enduser`, `commons/selfservice/example-ui` and
`commons/ui/mock` each declare that one artifact and nothing else.

**This package does the opposite: it declares `@openidentityplatform/ui-commons` as a
`peerDependency` and ships none of it.** Three things decided that.

1. **Sequencing.** Commons' ES module tree exists only in `commons/target/npm`, and no Maven
   artifact carries it until task 3.6 — `commons:zip:www` is assembled from `target/classes`, which
   holds the AMD sources and resources only. Embedding the half that matters would mean reaching
   sideways into a sibling module's `target/` directory, or running a second copy of the emitter
   over commons' sources.
2. **Single instance.** Commons is singleton-heavy: `Configuration`, `EventManager`, `Router` and
   the ES module `LoaderRuntime` seam all hold module-scoped state. Two copies means `configure()`
   lands on one seam while views resolve through the other, with no error anywhere. A peer forbids
   that by construction. A plain `dependency` lets npm nest a second copy silently. Embedding
   cannot express it at all, because npm has no "conflicts with" — *install ui-user or ui-commons,
   never both* would stay an unenforceable instruction.
3. **The payload record.** An embedded copy would put commons' 200 paths inside this module's
   `build/expected-payload.txt`, coupling it to every commons file change.

**The cost, accepted:** a consumer installs two packages, task 3.7 wires two tarballs and two copy
steps, and the five zip consumers above each need a second declaration when they migrate.

**Ordering between the two copy steps is not a hazard.** `LC_ALL=C comm -12` over the two payloads —
128 commons paths against 45 here — returns **zero** collisions. Neither package can overwrite a
file of the other's, so the order they are copied in does not matter, and the product's own sources
still come last and still win.

### What the Maven zip carries that this package does not

`commons.ui:user:zip:www` is **213 files**; this package ships 45 of them. The arithmetic is exact
and there is no third source:

| source | files | how it gets in |
|---|---:|---|
| `commons.ui:commons:zip:www` | 168 | the single `<dependency>` in `pom.xml`, unpacked to `target/dependency` by `maven-dependency-plugin` |
| this module's own sources | 45 | `src/main/js` + `src/main/resources` via `target/classes` |

Those 168 include **25 `libs/`** and **52 `css/`** files that look like they belong to this module
and do not. They are `org.openidentityplatform.commons.ui.libs:*` artifacts declared by
**`commons/pom.xml`** (34 of them) and placed by the `<dependencySet>` blocks in *commons'* assembly
descriptor — they reach the user zip only because the whole commons zip is unpacked into it.

**`user/src/main/assembly/zip.xml` has two `<dependencySet>` blocks of its own that match nothing.**
They include `org.openidentityplatform.commons.ui.libs:*:js` and `:css`, but `user/pom.xml` declares
no `ui.libs` dependency at all — its only dependency is `commons.ui:commons:zip:www` — so the blocks
resolve to zero artifacts and contribute zero files. Verified against the built zip: 168 + 45 = 213,
with no remainder. They are vestigial, copied from the commons descriptor; this task left them alone
because the zip contract is frozen under D8, but do not read them as the route by which `libs/`
arrives.

**This matters for task 3.7**, which removes AM's `commons.ui:user:zip:www` dependency and has to
name where each runtime file still comes from. The answer for all 25 `libs/` and 52 `css/` files is
*commons*, transitively — not this module, and not this module's assembly descriptor. Task 4.7,
which retires the `ui.libs` coordinates, is the one that touches them.

## How an AMD consumer resolves a module id

**Not through `exports`.** RequireJS and `r.js` resolve a module id by concatenating `baseUrl` (or a
matching `paths` prefix) with the id and appending `.js`. They never read `package.json` — measured
against `requirejs` 2.3.7 with a valid `exports` field present and ignored. See
`ui/NOTES-dual-build.md` §2 and the header of `ui/build/npm-package-lib.js`.

Two routes, and this package needs **both trees present** either way:

### 1. A copy step (what the Grunt build already does)

Copy `amd/` and `www/` from **both** packages into the composition directory ahead of the product's
own sources. This is what `openam-ui-ria`'s `copy:compose` does today with the unpacked zip, and it
is the route that **preserves last-wins**, so the five overrides listed above keep working.

### 2. A RequireJS `paths` entry — and it must be two entries

```js
paths: {
    "org/forgerock/commons/ui/common":
        "node_modules/@openidentityplatform/ui-commons/amd/org/forgerock/commons/ui/common",
    "org/forgerock/commons/ui/user":
        "node_modules/@openidentityplatform/ui-user/amd/org/forgerock/commons/ui/user"
}
```

A single broader `org/forgerock/commons` prefix pointed at either package **breaks the other** —
this was measured, `ui/NOTES-dual-build.md` §2 case C. The prefixes must stop at `…/ui/common` and
`…/ui/user` respectively.

Note that a `paths` entry **wins over** a same-path file in the consumer's own tree, inverting the
last-wins overlay. For this package that is not academic: it is exactly how the five overrides above
would stop applying.

## How an ES module consumer resolves a module id

**By aliasing the id prefixes.** `exports` covers the first hop:

```js
import UserProfileView from
    "@openidentityplatform/ui-user/esm/org/forgerock/commons/ui/user/profile/UserProfileView.js";
```

The `.js` is required — `exports` subpath patterns do literal substitution and never append an
extension.

That first hop is as far as `exports` gets you. The generated modules import each other, **and
commons**, by absolute extensionless ids, which no `exports` entry can resolve because they are bare
specifiers rather than package subpaths. A consumer aliases **two** prefixes:

```js
resolve: {
    alias: {
        "org/forgerock/commons/ui/common": "@openidentityplatform/ui-commons/esm/org/forgerock/commons/ui/common",
        "org/forgerock/commons/ui/user":   "@openidentityplatform/ui-user/esm/org/forgerock/commons/ui/user"
    }
}
```

Keeping one id space across both builds and both packages is design decision **D19**, and it is what
`absolutiseImports` in the shared emitter enforces. The cost is this alias requirement; the benefit
is that the AMD and ES module trees are auditably the same modules, and that a consumer can override
one module by re-pointing one alias.

Unlike `ui-commons`, this package emits **no `"."` entry**. It has no aggregate module — there is no
`main.js` here to point one at, and inventing an entry point that no consumer of the AMD build has
ever had would be a new API rather than the same one in a second form.

### The alias does not reach `config/`

The two modules under `config/` — `config/messages/UserMessages.js` and
`config/routes/UserRoutesConfig.js` — are not under the aliased prefix. They are leaves, composed by
the product, which pulls them into its own `config/AppConfiguration`. A consumer that wants them
binds the two ids individually, or copies them in via route 1.

**Do not alias `config/` wholesale.** That prefix is the product's: `config/AppConfiguration` and
`config/ThemeConfiguration` are precisely the files `openam-ui-ria` keeps out of the r.js bundle so
a deployment can be customised without repackaging.

## Identifiers the consumer must supply

Four ids these modules import that are **not** peers and cannot become peers. Under AMD they come
from `require.config.map` or the `paths` block; under ES modules they are build-time aliases.

| identifier | declared by | what it must resolve to |
|---|---|---|
| `underscore` | 3 modules | **lodash**. `openam-ui-ria` maps it in `require.config.map`. Not the `underscore` package. |
| `KBADelegate` | `profile/UserProfileKBATab` | the **product's** KBA delegate. AM points it at `org/forgerock/openam/ui/user/services/KBADelegate` — *not* at this package's own `delegates/KBADelegate`, which is the default a product without its own would bind. |
| `form2js` | 5 modules | no npm package exists — see below |
| `js2form` | 3 modules | no npm package exists — see below |

`KBADelegate` is the substitution mechanism working as designed: this package names a collaborator
by logical name and the product decides what it is. `UserProfileView` is the same mechanism seen
from the other side — it is a logical name **commons** resolves, and AM binds it to this package's
`org/forgerock/commons/ui/user/profile/UserProfileView`.

### `form2js` and `js2form` have no npm equivalent

`LIBS-INVENTORY.md` §6 records both: they are `maxatwork/form2js` at pinned commit `769718a1…`,
never published to npm. The registry's `form2js@1.0.0` is `kirill-zhirnov`'s **different fork**, and
`js2form` is a sibling *file* in that same commit rather than a package of its own. The Maven
version string, `2.0-769718a`, literally encodes the commit.

Declaring a peer range for either would assert a resolution that does not exist. A consumer binds
them the way `openam-ui-ria` does — but **a `paths` entry alone is not sufficient for either route,
because neither file calls `define()`**. They are plain scripts that assign a global.

Under AMD, `paths` needs a matching `shim`, which is exactly what `openam-ui-ria/src/main/js/main.js`
pairs them with:

```js
paths: { form2js: "libs/form2js-2.0-769718a", js2form: "libs/js2form-2.0-769718a" },
shim:  { form2js: { exports: "form2js" },     js2form: { exports: "js2form" } }
```

Under ES modules the emitted code does `import form2js from "form2js"`, so a bare bundler alias to
those files yields **no default export at all** — the alias must point at a small wrapper that loads
the script and re-exports the global it assigns.

That accounting is checked, not asserted: `npm run verify:esm` walks every import in the emitted
tree and fails if any external specifier is not a declared peer, a commons id, or one of these four.
A fifth cannot appear without this table being updated to match.

### Checking it

```sh
npm run build:npm && npm run verify:esm
```

**Be precise about what this reaches.** Of the 14 modules, `verify:esm` actually *imports* **4** —
the DOM-free ones. The other 10 cannot be imported under bare Node: commons' `main/UIUtils` assigns
`$.fn.emptySelect` at module scope, and jQuery 3 without a `document` yields a factory with no `.fn`.
Giving them a real DOM is task 3.5's CI environment to decide; the stub here is deliberately not
grown to fake it, for the same reason `ui-commons` refuses to.

The remaining 4 checks are static and cover what the imports cannot:

- every external specifier in the emitted tree is a declared peer, a commons id, or one of the four
  ids in the table above — so a new undeclared dependency fails the build
- every `org/forgerock/commons/ui/common/**` id this package imports **exists in the emitted
  ui-commons tree** — the cross-package contract, which no version range can express
- the two packages collide on zero paths
- the AMD and ES module builds expose exactly the same ids (D19)

Eight ids are stubbed under Node and named in the output: `KBADelegate`, `NavigationFilter`,
`ThemeManager`, `bootstrap`, `config/AppConfiguration`, `form2js`, `jquery`, `js2form`.

One trap worth knowing before writing any harness against this tree: commons' `main/Configuration`
replaces `console.log`/`.debug`/`.info`/`.error`/`.warn` with no-ops **at module scope** unless
`AppConfiguration.loggerLevel === "debug"`. A script that reports with `console.log` goes silent
mid-run — no error, exit code 0, indistinguishable from a hang. `build/verify-esm.mjs` writes through
`process.stdout.write` and supplies an `AppConfiguration` stub declaring `"debug"` for that reason.

## Dependencies

| peer | version | why |
|---|---|---|
| `@openidentityplatform/ui-commons` | `3.2.0-SNAPSHOT` | see above. Exact, not a range: both modules build from one Maven reactor at one `${project.version}` and release together. Task 3.12 replaces it with a registry range. |
| `bootstrap` | `^3.3.5` | `profile/UserProfileView` imports it for tab behaviour, as a bare side-effect import. `LIBS-INVENTORY.md` row 12: the Maven artifact's `custom` classifier is a naming fiction — it is MD5-identical to `bootstrap@3.3.5`'s own `dist/js/bootstrap.js`. |
| `handlebars` | `^4.7.7` | 2 modules |
| `jquery` | `^3.7.1` | 10 modules |
| `lodash` | `>=3.10.1` | the one range that is not a caret — see below |

They are peers rather than dependencies because the consuming product composes commons by flat file
overlay into one global namespace. A nested second copy means two module registries and failing
`instanceof` checks across the boundary, not a subtle version skew.

**Four of these five peers are not optional, and npm 7+ installs missing peers automatically.**
Installing this tarball into a tree that lacks them will add `bootstrap`, `handlebars` and `jquery`
to the consumer's `node_modules` and write them into its `package-lock.json`. Task 3.7 treats a
dirty `git status` after a clean build as its failure signal, so expect that lockfile churn and
decide there whether to commit it or pre-declare the three — it is a consequence of the peer shape
`ui-commons` established, not something this package can avoid on its own.

### `lodash` is the one range that is not a caret

Identical to `ui-commons`, and it has to stay identical or the conflict simply moves.
`openam-ui-ria` ships lodash 3.10.1 at runtime while pinning 4.18.1 as a build-time
`devDependency`, and lodash is the only one of these peers present in its npm tree at all. A
`^3.10.1` here would make the packed tarball impossible to install into the sole phase-1 consumer —
measured on `ui-commons`, `ERESOLVE` — which would hard-fail task 3.7.

Do not solve it in the consumer with `--legacy-peer-deps`: that suppresses every peer check in the
tree, not this one.

### `peerDependenciesMeta.optional` on ui-commons is temporary

`@openidentityplatform/ui-commons` is marked optional, and **that does not weaken the version
guarantee** — measured against npm 10.9.7: absent, `npm install` succeeds instead of failing E404;
present at a non-matching version, npm still refuses; present at `3.2.0-SNAPSHOT`, it installs
clean. npm continues to forbid the mismatched second copy the peer declaration exists to prevent.
What it gives up is the missing-peer warning.

It is there because ui-commons is on no registry until task 3.11, and without it npm cannot build a
tree for this module at all — which would break the `npm install` that `frontend-maven-plugin` binds
at `initialize`, and so the Maven build. `omit=peer` does not help (measured: npm resolves the peer
edge even when omitting installation). **Task 3.11 removes the entry.**

## Related

- `ui/build/npm-package-lib.js` — the emitter shared with `ui/commons`
- `ui/commons/NPM-PACKAGE.md` — the same document for the commons package
- `ui/NOTES-dual-build.md` — the discovery this is built on; §1 payload, §2 module ids
- `ui/LIBS-INVENTORY.md` — the Maven-artifact-to-npm mapping, task 3.1
