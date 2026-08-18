# AMD parity — the commons npm packages vs `commons.ui:user:zip:www`

Parity check of the **AMD output of `@openidentityplatform/ui-commons` and
`@openidentityplatform/ui-user`** (tasks 3.2 and 3.3) against the **contents of
`commons.ui:user:zip:www`**, the distribution those packages are meant to replace, judged by a
consumer that was not modified.

This is task 3.4's record. It exists because the Migration Plan's rollback paragraph rests on one
claim — *"the AMD output is behaviourally identical, so nothing else moves"* — and that claim needed
measuring rather than asserting. Tasks 3.6 and 3.7 read this document before acting; it is written
to stand on its own.

**Result: the AMD output passes on test results and on nothing stronger.** An unmodified consumer
produces the identical test set, all passing, either side. The trees are not identical and the
optimised bundle is not identical, and both of those are stated below rather than folded into the
headline.

| Bar | Met? | Measured |
|---|---|---|
| (a) byte-identical tree | **NO** | 79 of 173 shared files differ — every `.js` module, and all of them |
| (b) identical r.js bundle | **NO** | 395,730 B / `f710b7a4c20ddf570b7fcaad857e8ad9` → 396,542 B / `0a28cbb18bd5606062e77c02ebc8ab6a` |
| (c) identical test results from an unmodified consumer | **YES** | 33 tests, 0 failed, 0 skipped, 0 todo, identical sorted test set, no consumer change |

Recorded 2026-08-18. Repo `commons`, branch `features/ui-migration`, commit
`e5224abc6fd70994a3d95a2595d94e34ed84df16`. Version under test `3.2.0-SNAPSHOT` on both modules.
Working tree clean before and after; no consumer file was modified at any point, and nothing was
fixed in response to a difference.

---

## Gate verdict — task 3.4

**Bar (c) is the criterion, by explicit decision on 2026-08-18, and on that criterion the task
passes.** The decision was taken with the differences below in front of it, not by default: bars (a)
and (b) were both measured to fail first, the failures were characterised, and (c) was chosen
knowing that. It is recorded here so that a later reader does not mistake the weakest bar that was
passed for the bar that was set.

The same decision declined to fix the one runtime-visible difference (a new global `_typeof`,
below) inside this task. That would have meant a verification task silently patching the output it
verifies, which is how a green result stops meaning anything. It is recorded as a known difference,
not as a defect closed.

**A second decision, taken at the same time: the wider consumer is deferred to tasks 3.7 and 3.8.**
`commons/ui/mock` is the only consumer run here. It is a floor, not a ceiling — its measured limits
are in [What the consumer actually covers](#what-the-consumer-actually-covers). `openam-ui-ria` is
the consumer that matters, 3.7 switches it to the AMD tarballs and 3.8 runs the phase-0a Playwright
suite against the result, so the deeper evidence is scheduled rather than skipped. The risk this
accepts is stated plainly: if the AMD output is not interchangeable in a way mock cannot see, that
surfaces at 3.8 rather than here.

## What this verdict does not assert

It is narrower than a clean bill of health, and the difference is the reason the bar had to be
chosen rather than assumed.

- **Not that the outputs are the same.** They are not. 79 of 79 module files differ, because the
  Maven zip ships `src/main/js` verbatim and the package ships that same source through Babel.
- **Not that a consumer cannot observe the difference.** One is observable without any test
  noticing: the package's AMD files introduce a top-level `function _typeof`, so `window._typeof`
  exists where the zip created no global at all. See
  [The one difference that can matter](#the-one-difference-that-can-matter--a-new-global-_typeof).
- **Not that the AMD tree as a whole is exercised.** mock's bundle reaches 38 of the 79 modules and
  5 of `ui-user`'s 14, and its `ui-user` test contributes zero tests. Nothing here says the other 41
  modules are interchangeable; it says nothing about them.
- **Not that this holds under a consumer that transpiles again.** `openam-ui-ria` runs its own Babel
  over its composition directory. Double transpilation was not measured.

---

## Environment

### The builds under test

| | source | emitted to | AMD files |
|---|---|---|---|
| `@openidentityplatform/ui-commons` | `commons/src/main/js` | `commons/target/npm/amd/` | 65 `.js` + `package.json` |
| `@openidentityplatform/ui-user` | `user/src/main/js` | `user/target/npm/amd/` | 14 `.js` + `package.json` |

Produced by `npm run build:npm` in each module (`build/npm-package.js` → `ui/build/npm-package-lib.js`).
Neither is wired into Maven yet — that is task 3.6 — so `target/npm` does not exist after a plain
`mvn install` and was generated explicitly for this measurement. Static payload alongside:
`commons/target/npm/www/` 63 files, `user/target/npm/www/` 31 files.

### The distribution being replaced

`user/target/org.openidentityplatform.commons.ui.user-www` — the assembly's `dir`-format output,
verified equal to the 213 entries of `…user-www.zip`. This is what `commons.ui:user:zip:www`
delivers to a consumer today.

**The zip ships the source verbatim.** Verified with `cmp` over all 79 module files against
`commons/src/main/js` and `user/src/main/js`: 79 compared, 0 differing. Maven applies no resource
filtering to these modules. Every difference recorded below is therefore attributable to the Babel
pass in the package emitter and to nothing else.

### Toolchain

macOS 15 (darwin 24.6.0) · Node v22.20.0 · npm 10.9.3 · Apache Maven 3.9.16 ·
`@babel/parser` and `@babel/generator` 7.29.8 (used for the AST classification, from
`commons/node_modules`).

---

## The consumer

**Used: `commons/ui/mock`.** It declares exactly one commons artefact,
`org.openidentityplatform.commons.ui:user:zip:www`, unpacks it into `target/www`, runs `r.js` over
it through `grunt-contrib-requirejs`, and runs a QUnit suite through `grunt-contrib-qunit` under
headless Chrome.

**Its `Gruntfile.js`, `pom.xml`, `src/main/js`, `src/main/resources` and `src/test/qunit` were not
touched at any point.** Verified additionally that `mock/src/main/js` and `mock/src/main/resources`
share **zero** paths with the package trees, so the overlay used in step 2 could not have shadowed a
consumer file.

**Not used: `openig-ui`** (48 AMD modules) or `openam-ui-ria`. Skipped on cost, and deferred to 3.7
and 3.8 by the decision recorded above.

---

## Step 1 — baseline: the consumer against the Maven zip

`rm -rf commons/target user/target mock/target` — never `mvn clean`, because `clean-external` would
delete the 57 `commons.ui.libs` artefacts from `~/.m2` and they are published to no repository —
then `mvn install` from `commons/ui`.

- **Built:** yes. `BUILD SUCCESS`, all four reactor modules.
- **QUnit:** `33 tests completed in 603ms, with 0 failed, 0 skipped, and 0 todo.` Every test OK:

```
form2js usage > boolean fields
UIUtils Functions > Static Select
Base64 Functions > Base64.encodeUTF8
Base64 Functions > Base64.encodeUTF8 - 2 pad chars
Base64 Functions > Base64.encodeUTF8 - 1 pad char
Base64 Functions > Base64.decodeUTF8
Base64 Functions > Base64.decodeUTF8 - 1 pad char
Base64 Functions > Base64.decodeUTF8 - 2 pad chars
Base64 Functions > Base64.encodeUTF8/decodeUTF8 - various punctuation characters
Base64 Functions > Mime.encodeHeader
OAuth Functions > oAuth redirect uri
OAuth Functions > oAuth request url
Router Functions > getLink
Queue Functions > core operations
AbstractModel Functions > create with server-assigned id
AbstractModel Functions > create with client-supplied id
AbstractModel Functions > read operation
AbstractModel Functions > update operations
AbstractModel Functions > delete operations
AbstractModel Functions > patch operations
AbstractModel Functions > custom get method to support JSONPointer
ValidatorsManager Functions > bindValidators
ValidatorsManager Functions > bindValidatorsForField
ValidatorsManager Functions > evaluateValidator
ValidatorsManager Functions > evaluateDependentFields
ValidatorsManager Functions > evaluateAllValidatorsForField
ObjectUtil Functions > toJSONPointerMap
ObjectUtil Functions > getValueFromPointer
ObjectUtil Functions > isEqualSet
ObjectUtil Functions > findItemsNotInSet
ObjectUtil Functions > walkDefinedPath
ObjectUtil Functions > generatePatchSet
AbstractCollection Functions > query operations
```

- **Bundle:** `mock/target/www/main.js` — **395,730 bytes**, MD5 **`f710b7a4c20ddf570b7fcaad857e8ad9`**.
  Source map `main.js.map` — 1,248,971 bytes, MD5 `a55b92f33ea3491d85731ecf650443b6`.

**It is green today.** Nothing needed fixing, so the baseline is a real baseline and not a
pre-existing failure being carried forward.

**`r.js` is deterministic here.** The tree was re-unpacked from the zip, snapshotted, and
`grunt build` re-run standalone: same 395,730 bytes, same digest, same 33 tests. Any bundle
difference in step 2 is therefore caused by the swap and not by build nondeterminism.

**Test *order* is not deterministic** (async module loading). Two runs of the *same* zip input
produced the 33 tests in different orders. All comparisons below are over the sorted set.

---

## Step 2 — the same consumer, pointed at the AMD output

The pristine `target/www` snapshot was restored, then the four package trees were overlaid onto it —
changing only what the consumer consumes:

```
cp -R commons/target/npm/amd/. mock/target/www/
cp -R commons/target/npm/www/. mock/target/www/
cp -R user/target/npm/amd/.    mock/target/www/
cp -R user/target/npm/www/.    mock/target/www/
```

Then the identical `grunt build` (`eslint`, `less`, `requirejs`, `sync:test`, `qunit`). Verified
after the overlay that all 79 module files in `target/www` were byte-identical to the package's. The
40 third-party `libs/`+`css/` files from the zip were left in place — the packages declare them as
npm peers, so a real consumer supplies them separately, and keeping them is the faithful emulation.

- **Built:** yes. `grunt build` exit 0. eslint clean, less clean, `r.js` clean.
- **QUnit:** `33 tests completed in 548ms, with 0 failed, 0 skipped, and 0 todo.`
  **The sorted test set is byte-identical to the baseline's** — the same 33 names listed above, all
  OK, zero FAILED.
- **Bundle:** `mock/target/www/main.js` — **396,542 bytes** (+812), MD5
  **`0a28cbb18bd5606062e77c02ebc8ab6a`**. Source map — 1,223,579 bytes, MD5
  `5eb565cc06f31021d1f7dce2388369a8`.

### Consumer source change required: **none.**

No file under `mock/` was edited — not `src`, not `Gruntfile.js`, not `pom.xml`. Had one been
needed, that would have been the answer to this task and the answer would have been *not
interchangeable*.

---

## The r.js bundle

Not byte-identical: 395,730 → 396,542 bytes, different digest. Decomposed by splitting both bundles
at each `define("<id>"` boundary — 61 chunks each, 60 module ids.

**Module order — identical.** All 60 ids appear in the same order in both bundles. No reordering.

**Line breaks — 6 chunks differ by whitespace only.** `jquery`, `backbone`, `handlebars`,
`ChangesPending`, `AbstractUserProfileTab` and `CommonConfig` differ in bytes but not in length.
uglify2's `max_line_len` (32,000) wraps by position, so the 801-byte growth at the head of the file
shifts every subsequent wrap point and `\n` lands elsewhere. Same characters, same code. Not
observable. **Ignoring line breaks, 57 of 61 chunks are byte-identical.**

**Real code delta — 4 chunks.** That is the whole difference:

| chunk | bytes | what changed |
|---|---|---|
| `org/forgerock/commons/ui/common/util/ObjectUtil` | +2 | `typeof t[1]` → `_typeof(t[1])` |
| `org/forgerock/commons/ui/common/util/UIUtils` | +3 | `typeof e` → `_typeof(e)` |
| `org/forgerock/commons/ui/common/components/Messages` | +6 | two `typeof` → `_typeof(…)` |
| *(bundle head, before the first `define`)* | +801 | three hoisted `function _typeof(e){…}` declarations |

**Source map.** `//# sourceMappingURL=main.js.map` is identical either side. The `.map` file itself
differs (1,248,971 → 1,223,579 bytes) because it embeds the sources and the sources are reformatted.
A consumer observes this only in devtools.

**License comments.** Not a factor. `preserveLicenseComments: false` in mock's `r.js` config strips
them from both bundles. The package's AMD files do retain the CDDL header — `licenceHeader()` in the
emitter preserves it — so the difference never reaches the bundle.

**Which of these a consumer could observe:** the hoisted `_typeof` declarations, and only those. See
below.

---

## The one difference that can matter — a new global `_typeof`

`@babel/plugin-transform-typeof-symbol`, pulled in by `preset-env`, rewrites `typeof x` to a helper
that reports `"symbol"` for Symbol values on engines with a broken `typeof`, and injects the helper.
The helper is emitted as a **top-level function declaration**:

```js
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && … }
```

In a classic script — which is how both RequireJS and a `<script>` tag load these files — a
top-level `function _typeof` becomes **`window._typeof`**. uglify2 then hoists all three occurrences
to byte offset 0 of the bundle, ahead of jQuery.

**Verified, not inferred:**

- The 79 module files in the **zip declare no top-level binding at all** — zero matches for a
  top-level `function`/`var`/`let`/`const` across all 79.
- `function _typeof` is the **only** top-level binding introduced anywhere in the 79-file package
  tree — zero other matches.
- It appears in exactly **5 of 79** files: `util/CustomPolyfill.js`, `util/ObjectUtil.js`,
  `util/UIUtils.js`, `components/Messages.js`, `main/AbstractDelegate.js`. Three of the five reach
  mock's bundle; `CustomPolyfill` and `AbstractDelegate` are not bundled but ship the same
  declaration.
- Babel rewrote only the `typeof` sites whose operand it could not prove non-Symbol — **6 sites
  across the 5 files**, leaving 9 plain `typeof` in place. `Messages` 2, `AbstractDelegate` 1,
  `CustomPolyfill` 1, `ObjectUtil` 1, `UIUtils` 1.
- **`_typeof` is the only Babel helper injected into the entire tree.** No `_createClass`,
  `_inherits` or `_classCallCheck` anywhere: no file in either package contains an ES `class`
  declaration, so `@babel/plugin-transform-classes` is a no-op here.

**Assessment.**

- *Intra-bundle:* three identical declarations in one scope. Legal in sloppy mode, last wins, all
  bodies identical. Harmless.
- *The behaviour of `typeof` itself:* unchanged for every value these modules pass it — strings,
  objects, `undefined`. No test moved, and none would have.
- *Cross-boundary:* any consumer code or library that reads or writes a global named `_typeof` would
  now collide. Low risk, and `openam-ui-ria`'s own Babel step emits the byte-identical helper for its
  own sources, so a collision there is benign. But it is **a real change to the global namespace
  that the Maven zip does not make, and it is invisible to every assertion in the QUnit suite.**

**Whether anything in `openam-ui-ria`, `openidm-ui-*` or `openig-ui` reads or writes `_typeof` was
not determined** — only `commons/ui` was in scope. That search is the cheap way to close this, and
it belongs with 3.7.

**This is a property of `preset-env`'s plugin set in 3.2/3.3, not of the AMD packaging.** Dropping
`transform-typeof-symbol` would remove 100% of the injected-helper surface and take the bundle to 60
of 61 chunks identical modulo line-wrapping. That was deliberately **not** done here — see the gate
verdict.

---

## Per-file MD5 manifest diff

`user/target/org.openidentityplatform.commons.ui.user-www` against the union of
`commons/target/npm/{amd,www}` and `user/target/npm/{amd,www}` (174 files), flattened the way a
consumer overlays them. The two package trees share no paths, so the flattening is lossless.

```
in both:            173      equal digest:  94      differing digest:  79
only in the zip:     40
only in the package:  1
```

### In both, equal digest — 94 files

Every one is static payload: templates, partials, less/css, images, locales. **The entire non-JS
payload of the packages is byte-identical to the zip's.** Nothing in this list needs a judgement.

    css/common/common.less  cb4a3cad19bc71e276e2ee0ed712bc85
    css/common/forgerock-variables.less  e9b57f662ccf0c47cff7dd7336ea43d2
    css/common/helpers.less  10f1b37a504fa2a50125356de93ab42c
    css/common/list.less  65f92db5ec19b4143210f20c460ce052
    css/common/review.less  308accc9bfec6d2849370c86862edcc9
    css/common/structure.less  23edd1d1a7190fd005f902b21b9b2e6f
    css/common/structure/alert-system.less  4c544135f9ae9a0115ba324e0802d5c7
    css/common/structure/backgrid.less  77ba533bd97f4dac7528c4c407f1750d
    css/common/structure/base.less  53e95e7f890e5ac4e1f86cfb3fa86496
    css/common/structure/buttons.less  2c1698a2e13e4ff11c45373fcd01be3c
    css/common/structure/codemirror.less  b92af2930c2358e83e73bf0ad35d2abb
    css/common/structure/config.json  b53d9e9ab592f2def188d8178797e16d
    css/common/structure/dialogs.less  16f34dc696019e67feefa80fb023a783
    css/common/structure/dropdown-menu.less  f14048e42e03f633d2ef5334aa2aa3e6
    css/common/structure/form.less  993243ec43253d94bfbd40eb880b59f8
    css/common/structure/navbar.less  bc76f3f51fa56bdf5246fcd2b3ef542e
    css/common/structure/page-footer.less  a4f638e1f19063a0188200607eac6466
    css/common/structure/page-header.less  223d8e568098c0000941c8e3d1799fba
    css/common/structure/panel.less  32083c84d5c9e838c9f499ec49bf516a
    css/common/structure/popover.less  b633c1830c1d30a6e1094e67e3439add
    css/common/structure/selfservice.less  d9ca8a09afb59f3bf1b99d8d234d8acd
    css/common/structure/sortable-list.less  3c3a7024d2b89425f8cc5ae76de2d142
    css/common/structure/tabs.less  41a3e72c2c0a6bb8d59ddd8be045d8dd
    css/common/structure/toggle.less  4af13607bd4d2446c587a3fbcf1ac9b5
    css/common/structure/toolbar.less  ed66eaf98574d2a1fb27929ad0ba6faf
    css/common/structure/validation-rules.less  06ea431baf97307144f9f6764c76f7d8
    css/common/structure/wells.less  308accc9bfec6d2849370c86862edcc9
    css/common/theme.less  0037d58a90964e319959185006c5d184
    css/common/theme/base.less  6fd2e00aaa3797da6f5e0c287620c400
    css/common/theme/buttons.less  ede7e13b216c97bd15371f96971f716c
    css/common/theme/dialogs.less  a182ec9f25741da2550ae56bff38ea80
    css/common/theme/dropdown-menu.less  b7829efdef70c69da97c92e72314cb25
    css/common/theme/navbar.less  1f19353c1326b557587c21e4fcd1c205
    css/common/theme/page-header.less  07d381309749bf248d990271cae91150
    css/common/theme/panel.less  0f152ae213fda070a12d6c20d0ee9355
    css/common/theme/selfservice.less  4c7898a0b0ab491175b5379f766ac6aa
    css/common/theme/tabs.less  9f0c4f3b06b8fe6e38f80fd09dc6a4e3
    favicon.ico  2983db6a524832a47322862487cb4bd0
    images/datatable/sort_asc.png  f3dd0212b70a4291ab8980412436a2a7
    images/datatable/sort_both.png  085f334d21ad36b2db51b6a15d02344f
    images/datatable/sort_desc.png  a9723f3e23faa0a25004e05c5d16f6bb
    images/login-logo.png  8a762acb40bd747fc586694b9f3144ef
    images/logo-horizontal.png  d24bd35ba40364149162b903a10f44bc
    images/passphrase/mail.png  593ba280ac000582f860c1b7554beb7f
    images/passphrase/report.png  c1c892bc05e26dc3af72bac7a4c56bf9
    images/passphrase/twitter.png  00961b64e280d828cb0b8647509ad73e
    images/passphrase/user.png  3f95c102b6396d41c08d037ca07f0429
    locales/en/translation.json  a4f53017d753e11cc79cd6cc1d2ff64a
    oauthReturn.html  aa8cab5e3b6880371fdca054d8cc8ddb
    partials/form/_basicInput.html  0da89d78a19578a6b884a2109f956b4d
    partials/form/_basicSaveReset.html  87cabe270cb96121586a916dc67eb915
    partials/process/_kbaItem.html  90e6c8877399925813b0054b0f0c744d
    partials/profile/_kbaItem.html  caf06db1a66f92ae49ef0fccd1607007
    partials/providers/_providerButton.html  dbc82f20a6bece0acf145670b32ea584
    templates/common/404.html  7cd4452e381b14ea4a315463e4951c6c
    templates/common/ChangesPendingTemplate.html  1e6721e37a291caafd78b1abd47b4d07
    templates/common/DefaultBaseTemplate.html  1a383d670bb012a732987f9e96be9786
    templates/common/DialogTemplate.html  a647ea625d6643c29966c34e956b9d3d
    templates/common/EmptyTemplate.html  be6f65c1e8b926c2429a32ea1763c644
    templates/common/EnableCookiesTemplate.html  79a01c1996013b1056508f6e11f4e869
    templates/common/FooterTemplate.html  b37b61653e3b14d09c469934cc576097
    templates/common/LoginBaseTemplate.html  f67a239d35f1b13b7e886a94850e6ee2
    templates/common/LoginDialog.html  e8246c6ef78aad67abc4b839802b4c53
    templates/common/LoginHeaderTemplate.html  958dfcc31578677613a721c587350c63
    templates/common/LoginTemplate.html  483fd355b29b66a138a4314294d0d26c
    templates/common/MediumBaseTemplate.html  c332f3f2d85b422b2a594bf22565d405
    templates/common/NavigationTemplate.html  62ee926e4521ba98d9bb25f2cb2a99d0
    templates/common/UnauthorizedTemplate.html  6259cef63988fd97e8d8288a97543af9
    templates/user/AnonymousProcessBaseTemplate.html  a9f56b7e87f0c13885f5d152cb1944d8
    templates/user/AnonymousProcessWrapper.html  a445b7a2199bea1ef562cac49bf51575
    templates/user/ConfirmPasswordDialogTemplate.html  6e7d5448665b0262ca6d90f4aa0af204
    templates/user/process/GenericEndPage.html  fd8be9a52721e34831b64322ddf5ffb1
    templates/user/process/GenericInputForm.html  ed73de6a480c1f0c2bd425bccd1eb24a
    templates/user/process/KBAQuestionTemplate.html  cf4f12c3ca66a898a8372faf4d279eb3
    templates/user/process/KBATemplate.html  790c92aab6846051bcff0916ea0c0a73
    templates/user/process/registration/captcha-initial.html  b5cc54b949358dea8738aa36d0766e3e
    templates/user/process/registration/emailValidation-initial.html  eaaff8a579fbd783cb2f033818eed428
    templates/user/process/registration/emailValidation-validateCode.html  8b975f956464fd5f7d5012c04a81c263
    templates/user/process/registration/kbaSecurityAnswerDefinitionStage-initial.html  9acce44fcf6745b002b018e7c21eb558
    templates/user/process/registration/termsAndConditions-initial.html  b82588524adcfa861f3aef95026d6d36
    templates/user/process/registration/userDetails-initial.html  5bf0547fea5d40520d8d2979d09a02df
    templates/user/process/reset/captcha-initial.html  b5cc54b949358dea8738aa36d0766e3e
    templates/user/process/reset/emailValidation-initial.html  1171da9106dad2040375392e3bcb9f1d
    templates/user/process/reset/emailValidation-validateCode.html  8b975f956464fd5f7d5012c04a81c263
    templates/user/process/reset/kbaSecurityAnswerVerificationStage-initial.html  ee2988c574c5d480420b593d141684f0
    templates/user/process/reset/resetStage-initial.html  ab87f391c56ca6609a16b7a2352cca3e
    templates/user/process/reset/userQuery-initial.html  7b3bc928af0825c2821f5d9962639070
    templates/user/process/username/captcha-initial.html  b5cc54b949358dea8738aa36d0766e3e
    templates/user/process/username/emailUsername-end.html  a2e8aae82da9fde69d245341f2accd0c
    templates/user/process/username/kbaSecurityAnswerVerificationStage-initial.html  820def30d73fe9c03f8eab292f398262
    templates/user/process/username/retrieveUsername-end.html  4331425b147a8091d9a4a65d63174275
    templates/user/process/username/userQuery-initial.html  d3a24d830307c108ecd5794c2b786c06
    templates/user/UserProfileKBATab.html  dc37d87bf809a0cd109b68c7482c1920
    templates/user/UserProfileTemplate.html  a023c2a7fd5e3296aeecd40309a82832

### In both, differing digest — 79 files

All 79 are `.js` module files, and they are **all** of the `.js` module files. Not one AMD module is
byte-identical to its zip counterpart.

**Root cause, measured.** Two facts pin it exactly. First, the zip's `.js` files are byte-identical
to `commons/src/main/js` and `user/src/main/js` — 79 compared with `cmp`, 0 differing. Second,
re-running the emitter's exact Babel configuration over the zip's file reproduces the package's file
**byte for byte, for all 79**, with zero mismatches:

```
commons: files=65 babel_reproduces=65 mismatch=0 identical_to_source=0
user:    files=14 babel_reproduces=14 mismatch=0 identical_to_source=0
```

So the delta is exactly one transform — `zip file` → Babel(`sourceType: "script"`,
`preset-env {targets: "> 0.2%, not dead, last 2 versions", modules: false}`,
`plugin-transform-classes {loose: true}`) → `package file`. Nothing else was added, removed or
rewritten.

**What Babel actually changed**, classified by comparing ASTs — parsed with `@babel/parser`,
comments stripped, re-printed through `@babel/generator` — rather than by reading text:

| class | files | what differs | can it matter at runtime? |
|---|---:|---|---|
| A | 30 | Re-indentation only, 4 spaces → 2. Raw text identical with all whitespace removed. | No. |
| B | 5 | Re-indentation plus comment repositioning — a trailing `// …` moved to its own line. AST identical. | No. |
| C | 37 | A/B, plus Babel's function-name inference: `foo: function () {}` → `foo: function foo() {}`. AST identical once function-expression ids are dropped. | Only via `Function.prototype.name`, which nothing in this codebase reads. |
| D | 5 | C, plus `@babel/plugin-transform-typeof-symbol`: a top-level `function _typeof` is injected and 6 `typeof x` sites become `_typeof(x)`. | **Yes** — adds a global `_typeof`. See above. Semantics of `typeof` unchanged for every value passed. |
| E | 1 | `ServiceInvoker.js`. Babel named the function expression `rejectHandler`, which would shadow the enclosing `var rejectHandler`, so it renamed the variable to `_rejectHandler`. Both the declaration and its two call sites move consistently; the function expression gains the original name. | No. Confined to the `define()` closure — not exported, not reachable by name from outside. A comment on line 134 still refers to "the rejectHandler above", which is now cosmetically stale. |
| Z | 1 | `ValidatorsUtils.js`. String escape form normalised for code points ≤ `0xFF`: `ó` → `\xF3`, in the 6 fragments concatenated into `obj.namePattern = new RegExp(…)`. | No. Verified: all 29 string literal **values** in the file are identical between the two, so the `RegExp` is built from identical strings — only the escape spelling in the source differs. |

Full list — path, zip digest, package digest, class:

    config/errorhandlers/CommonErrorHandlers.js                              ffdd439a7c17b69fff9c971400c47396  d1f0398086fbe5883a1e75cb57194182  [A]
    config/messages/CommonMessages.js                                        0d0b3dec73070178eec1ab3965877bc7  0c71d2fee854486c87fafad5bb69381c  [A]
    config/messages/UserMessages.js                                          6997baf24dbb7938d66cae2a02c9093e  f5729e348df746b9336a8a96a7503100  [A]
    config/process/CommonConfig.js                                           e6837aa8a5eecf4aaf535a0f21ae9335  daf811c38d1d4224e724179345d6f1b0  [C]
    config/routes/CommonRoutesConfig.js                                      cfbddaded2cacad515aba62e67c2e338  144523a1ac849c91fdb1ecda5925702d  [A]
    config/routes/UserRoutesConfig.js                                        19fa32f63f82ec51092b77619f2d0713  c6f3e0788345cbac8ad69d0a7e10baed  [A]
    config/validators/CommonValidators.js                                    2f003c30d7d183bfd250e2615d11edf7  e7053540ded84cd300135cd939c42305  [C]
    org/forgerock/commons/ui/common/backgrid/Backgrid.js                     4979d8df30a96f4262eb2af6ca4f7c11  38103d14e9cbde32e7163ba8ad6e6c94  [A]
    org/forgerock/commons/ui/common/backgrid/extension/ThemeablePaginator.js c5af7176e89df892d0bff014fec4ee59  8ad4b702f1b50df66f98bd98d22bdf92  [C]
    org/forgerock/commons/ui/common/backgrid/extension/ThemeableSelectAllCell.js 27ee49a24fd3fda2aad33eba58867d50  551f08374ab4c459404f8fcc0adca087  [C]
    org/forgerock/commons/ui/common/backgrid/extension/ThemeableServerSideFilter.js d26bf7f4a4cab07b2cb81c766063c494  49120f4b06e6110cb5a052616c91ee28  [C]
    org/forgerock/commons/ui/common/components/BootstrapDialog.js            bed4297482d61f446f91200e2b698c85  7378e2206f28e91c2d7375826faecae1  [A]
    org/forgerock/commons/ui/common/components/BootstrapDialogView.js        9ff645bc187df6e433a64937a96aba87  6cd2f1e6bdbb3e987d5b39258dda2b1f  [C]
    org/forgerock/commons/ui/common/components/Breadcrumbs.js                ea7e195e03cec5b75a7e4ebf334c6cea  9802b1b562eee6a9c81e4e08230a78a2  [C]
    org/forgerock/commons/ui/common/components/ChangesPending.js             01a7b34ec651d88f77968fd44c440071  48884065c516e00eca458ce9544c815a  [C]
    org/forgerock/commons/ui/common/components/ConfirmationDialog.js         c9e5361a1306f72e6a88f5a0400bb9d5  665df727b633cf6ce427cc2fc63a310b  [C]
    org/forgerock/commons/ui/common/components/Dialog.js                     ea0d1f0198c9bef216ac25fed2c7d7da  6a1db0fe2226e63589ae2c983a024edf  [C]
    org/forgerock/commons/ui/common/components/Footer.js                     0ef8ed2574759d026e3b07183b63ec8c  c229ace6fce396703a8e0ffc090343f2  [C]
    org/forgerock/commons/ui/common/components/hoc/withRouter.js             04e62a56a3b9c322d9d284dd5af78fd7  d04276e9277371f221f52024e5255eba  [C]
    org/forgerock/commons/ui/common/components/hoc/withRouterPropType.js     2b23c8dbcc3652c454d47c712322889b  bdd5ef960fa1d69b1ac5fefa46824680  [A]
    org/forgerock/commons/ui/common/components/LoginHeader.js                c98253c75326a11db18169993de55a06  ade58a65fd3c7d4f9a99ddddf4fc96a7  [A]
    org/forgerock/commons/ui/common/components/Messages.js                   ba4c29f676d97d4e0e945f85c8cc7663  bbf5595d9d9cd413583b5098e29e38be  [D]
    org/forgerock/commons/ui/common/components/Navigation.js                 06841f140221046ae8dd5e3ded878dba  b1b10a7e5e8aa0233a9ac24c39c6d56f  [C]
    org/forgerock/commons/ui/common/components/navigation/filters/RoleFilter.js 5d417bcf65e45733486e6b81708e15bb  6a5864b893a2d9d0f929ba3ff67b7489  [C]
    org/forgerock/commons/ui/common/components/popup/PopupCtrl.js            f162fb3acc3dc716af631ee251cda176  4c73dd4486ad47b314b2dc56ac5c7f23  [A]
    org/forgerock/commons/ui/common/components/popup/PopupView.js            3dcc87866d6735daa09f7df0daedd579  dbf3db0b5c3c61fc409164b23724a3fe  [A]
    org/forgerock/commons/ui/common/EnableCookiesView.js                     08f77c7ebff91e95a19ea62f4623bbbd  333eb8745f9fba1c7ef0d0f6b7cd8ed6  [C]
    org/forgerock/commons/ui/common/LoginDialog.js                           a0a27f3453657cfb56b4fba46d99681f  6908e2d9578f24d1b828fb4ee4d2c03d  [C]
    org/forgerock/commons/ui/common/LoginView.js                             184953c6f79c613ebe1bcd08a7faf682  ec19e883d1f26786b428622150fb4d02  [C]
    org/forgerock/commons/ui/common/main.js                                  cfa8935a67ddd26e727d4d8254a6d518  eab96438e6f36f97de698072a3bae44e  [A]
    org/forgerock/commons/ui/common/main/AbstractCollection.js               cb1b6446aedd8c502f5bea60ada98a21  3f2fc49aaf4db234fb57fde4a36ab4d5  [C]
    org/forgerock/commons/ui/common/main/AbstractConfigurationAware.js       292395ec519b1538a0fdc66ea6d0f2d8  f845327282728eb2dc3ddb665387c62a  [A]
    org/forgerock/commons/ui/common/main/AbstractDelegate.js                 edadbe28d7c1b221e86b417429e0b247  0f6a1f740c6d81b58e4d8621c4d9f8ea  [D]
    org/forgerock/commons/ui/common/main/AbstractModel.js                    bc7551bcbcb86bbf729985e59a0fd293  e5cce5a20f61ede72ff5fddb73158081  [C]
    org/forgerock/commons/ui/common/main/AbstractView.js                     69aa0ac21149b56f107f90db092f5157  c02265df01b34d4daa624c5c14e8605e  [C]
    org/forgerock/commons/ui/common/main/Configuration.js                    f54835eef1ab6b4c7e809c18de70ebb4  5c0319dc112657995e0a1d7da68aae6a  [A]
    org/forgerock/commons/ui/common/main/ErrorsHandler.js                    c2b6586ba59b3bc9f71f5ea4a2ef905c  d5b089e639af2bd2b2b259aea4881076  [B]
    org/forgerock/commons/ui/common/main/EventManager.js                     12cf0ba11395b19811918510e00c38fc  04fc2bd3092c518a7debebe580348253  [A]
    org/forgerock/commons/ui/common/main/i18nManager.js                      6b28714219bf2d9087509149098a3ee4  8c541a01f0497a7562d1c2454818e74b  [A]
    org/forgerock/commons/ui/common/main/ProcessConfiguration.js             7f2da2428bc2bdf8436c34f2d4127a2b  5f8a502abe34cf23ec324f0c7459e453  [A]
    org/forgerock/commons/ui/common/main/ReactAdapterView.js                 5b2a502fa2a3d957955b69bec9d7f1a5  081de0ebc45aedbeac39bfc1ad53b752  [C]
    org/forgerock/commons/ui/common/main/Router.js                           69f3d68c6cbe224cf27c6b0425093dc3  d392c304f651ca61318e618aa45a4a85  [C]
    org/forgerock/commons/ui/common/main/ServiceInvoker.js                   fa96755e537222c1129aab4980e52f94  68d5e2db39c333043765f3d9329cf00b  [E]
    org/forgerock/commons/ui/common/main/SessionManager.js                   0c362a5dca73f5129c2cf7696fe36167  072e47619b57c9dc94413fac485aacaa  [A]
    org/forgerock/commons/ui/common/main/SpinnerManager.js                   5967196e3039a5a46644fefd55a9190c  371053b1b404a7d0e76dc462783624ce  [B]
    org/forgerock/commons/ui/common/main/ValidatorsManager.js                ea2221a1f4e5cf3536c65acee5ce80f0  e439e7f61227602e5ed049c498816742  [A]
    org/forgerock/commons/ui/common/main/ViewManager.js                      eaf3a235be69c7b735922a7b34a6510b  84f427f7b46393be1dd348df87d9d3c3  [C]
    org/forgerock/commons/ui/common/NotFoundView.js                          0954961901ac0d379e477195a98c293c  b9532d9627016c071637b492704d0aad  [A]
    org/forgerock/commons/ui/common/SiteConfigurator.js                      64e8b435e5fec781c4820c24dc187c47  3c8fce620768535c2f7e831a76a5404e  [A]
    org/forgerock/commons/ui/common/UnauthorizedView.js                      f6e0020f9e0e648172dfdb2c3df874ed  da4f822c147d061a5947f0e156a45327  [C]
    org/forgerock/commons/ui/common/util/AutoScroll.js                       8a184abc39c0903fc6ffc1b7ad99cf7e  504f3cac95b51accb31846af0029fc5d  [B]
    org/forgerock/commons/ui/common/util/BackgridUtils.js                    e9eec8d95591cc51c4b37ae5e64b6df4  24158352f846e1d7c3248beef7cf66b8  [C]
    org/forgerock/commons/ui/common/util/Base64.js                           17d624ff64049f399e2707e94b0c4f93  20122d22d1340bd77ae86d1841737ac2  [B]
    org/forgerock/commons/ui/common/util/Constants.js                        026d37076587ded9b6c180c7dec555cf  942c1dd9e9c41aa15b3b94b6dba08a5b  [A]
    org/forgerock/commons/ui/common/util/CookieHelper.js                     4c9d9f63159576aafed05b4a737169ff  007307a9a60cb07ec122e3e647257c3d  [B]
    org/forgerock/commons/ui/common/util/CustomPolyfill.js                   2751a65a88272a46d416fba090a40082  4ea4ebe3deaffeac22f305085b264186  [D]
    org/forgerock/commons/ui/common/util/DateUtil.js                         d87962ea7637a1f6ddfbf3ac8407f853  06803065fdf262b75e5038e7b9dda93a  [A]
    org/forgerock/commons/ui/common/util/FormGenerationUtils.js              647be4be71ee836e470c30bb2736ce34  fd0541e2f92b7fac4551e7f1f8205a84  [A]
    org/forgerock/commons/ui/common/util/Mime.js                             6d0fd991609142149a82694658bf8cdb  2e873da7ebcc97eb34e1cbbc37863060  [A]
    org/forgerock/commons/ui/common/util/ModuleLoader.js                     53352c136a96df122b6373d31aa34592  842d8c0dd9d4c69ebb038b4faf9cd1d1  [C]
    org/forgerock/commons/ui/common/util/OAuth.js                            27f630cd7ddc762ab922833224b134b3  bcadb1e2d2227c99c64f4d05e0fc046d  [A]
    org/forgerock/commons/ui/common/util/ObjectUtil.js                       dca139fad2b6b81622a6a4246620b502  823402efbf3a26430089a76f02129639  [D]
    org/forgerock/commons/ui/common/util/Queue.js                            1814cb623322e78e4859b90e165772a6  65973b069a5b5a905e0008777a66a606  [C]
    org/forgerock/commons/ui/common/util/reactify.js                         5917c32d0db85258f1f3ab7b9705d783  212ec780e9c4c957c9cce73dea650296  [C]
    org/forgerock/commons/ui/common/util/UIUtils.js                          24354281db65b5594682878807b209a6  daa43fd36e805a3232cf63b3bc6c0b96  [D]
    org/forgerock/commons/ui/common/util/URIUtils.js                         cfbf511e55ab9930229197915caf5c8a  b9f0473b3f53032b7244331fa11addb8  [A]
    org/forgerock/commons/ui/common/util/ValidatorsUtils.js                  64a3d84ff25938c770244eff4a45f2b9  be4bcb8179855be84b16d19ef2bd9715  [Z]
    org/forgerock/commons/ui/user/anonymousProcess/AnonymousProcessView.js   e569efe8367ee7f24ca0d65d709cf95f  70a8c541c729f7ea234e13baac56adec  [C]
    org/forgerock/commons/ui/user/anonymousProcess/ForgotUsernameView.js     ff92662a1da1df3e41aff4b0eb45f0a4  4ce2a9de6991a8ddd3daaa08ac841d52  [A]
    org/forgerock/commons/ui/user/anonymousProcess/KBAQuestionView.js        c858bf870444f2a00c5cf0933af8ce6b  8c682c43b6e7f61e80a3d37615a258d6  [C]
    org/forgerock/commons/ui/user/anonymousProcess/KBAView.js                cd153bd821ff2add9e6dcd1742027632  bbb59fafc0f4bdc66fb066091626d478  [C]
    org/forgerock/commons/ui/user/anonymousProcess/PasswordResetView.js      15bf11458462f1a0d122afbd31d2003c  5d52776ec6994117235373c5227ea519  [A]
    org/forgerock/commons/ui/user/anonymousProcess/SelfRegistrationView.js   bcea5fb1986e6a19a29958ffe7c5ce78  eeb5263df6cda63cc99ca38296e4c0cd  [C]
    org/forgerock/commons/ui/user/delegates/AnonymousProcessDelegate.js      4b318ba7b5c36d9c55f1071d10b418d7  1a985eee9e6bc04c62e6cb6ea2723fec  [C]
    org/forgerock/commons/ui/user/delegates/KBADelegate.js                   e00ef8ad794bb285a20f192591b4de2d  336f2e49d4d14dde10a102f82fd7a919  [A]
    org/forgerock/commons/ui/user/profile/AbstractUserProfileTab.js          112c654fa2b77651e7553b07a2bc0852  4331add23a88486965e02e2e5f8cbda9  [C]
    org/forgerock/commons/ui/user/profile/ConfirmPasswordDialog.js           152f92f30dc1ba56d15317761d83cded  131e4420f5ac1cde2f4d8246155e9dd5  [C]
    org/forgerock/commons/ui/user/profile/UserProfileKBATab.js               4643f3eaa0f39e19ef2ebeb75cdcbdf9  a8903679effdf65a785ea27ddaa033a8  [C]
    org/forgerock/commons/ui/user/profile/UserProfileView.js                 2ba030446a0b7c1a6c2acc7b25edefcf  9f2ef1acb456fb2b5e14e30baa16c90a  [C]

### Only in the zip — 40 files

Every one is a third-party library or its stylesheet/font, contributed to the zip by the
`org.openidentityplatform.commons.ui.libs` Maven `dependencySet`s in
`commons/src/main/assembly/zip.xml` and `user/src/main/assembly/zip.xml`. None is commons source.

**This is the designed asymmetry, not a gap.** These are `peerDependencies` of the npm packages
(`commons/package.json`, `user/package.json`), because a nested second copy of jquery/lodash/
backbone/react in a UI composed by flat overlay means two plugin registries and failing `instanceof`
checks across the boundary.

**A consumer migrating off the zip must supply all 40 itself** — this is the single largest piece of
work the migration hands to a consumer, and 3.7 is where it lands for `openam-ui-ria`. In this
measurement they were left in place from the zip, which is what a real consumer's `npm install`
would do.

Seven are libraries no commons module imports (`backbone-relational`, `bootstrap`, `form2js`,
`jquery.ba-dotimeout`, `js2form`, `requirejs`, `selectize`) and are correspondingly absent from the
peer lists; `requirejs` is the loader itself. `form2js`/`js2form` have **no npm package at all** —
`LIBS-INVENTORY.md` section 6 records them as `maxatwork/form2js` at a pinned git commit. Those two
are the ones a migrating consumer will find hardest to replace.

    css/backgrid-filter.min-0.3.7.css  67cbc21114e94691bb1cc38e249d4db5
    css/backgrid-paginator.min-0.3.5.css  fded3185fa06a4806baa664711a706cb
    css/backgrid.min-0.3.5.less  8eb051caa0863f5e28ca07f310d0d153
    css/bootstrap-3.3.5-custom.css  957474c344c7131fb8e093449cc4893a
    css/bootstrap-dialog-1.34.4-min.css  e8d761e48219bcb418a146770c26c3fe
    css/fontawesome/css/font-awesome.min.css  4fbd15cb6047af93373f4f895639c8bf
    css/fontawesome/fonts/fontawesome-webfont.eot  32400f4e08932a94d8bfd2422702c446
    css/fontawesome/fonts/fontawesome-webfont.svg  f775f9cca88e21d45bebe185b27c0e5b
    css/fontawesome/fonts/fontawesome-webfont.ttf  a3de2170e4e9df77161ea5d3f31b2668
    css/fontawesome/fonts/fontawesome-webfont.woff  a35720c2fed2c7f043bc7e4ffb45e073
    css/fontawesome/fonts/fontawesome-webfont.woff2  db812d8a70a4e88e888744c1c9a27e89
    css/fontawesome/fonts/FontAwesome.otf  87d8ca3ddc57e7d2da6226e480f90457
    css/fontawesome/less/variables.less  49b82ead1bba3097f60dd1c8d4128a3c
    css/selectize-0.12.1-bootstrap3.css  d75b17ebe7200b2ff0b8d20d32853c35
    css/titatoggle-1.2.6-min.css  cc98233652b6d90119c0c202e5028515
    libs/backbone-1.1.2-min.js  9c3e3189b75efd56066402f80c3e781b
    libs/backbone-relational-0.9.0-min.js  2282dafb7fea1291a78fd389e5afeff9
    libs/backbone.paginator.min-2.0.2-min.js  7ef9bd3e64b30585f714b9e386df6d75
    libs/backgrid-filter.min-0.3.7-min.js  af6fb96aa2e6519098358b9fbd2cd176
    libs/backgrid-paginator.min-0.3.5-min.js  c08f46d1c64b6c6517264fb13e84312d
    libs/backgrid-select-all-0.3.5-min.js  9cefb2ccf039f56e4310b03a30bac1df
    libs/backgrid.min-0.3.5-min.js  248635b0bcc55409ee5976320f2e8ce8
    libs/bootstrap-3.3.5-custom.js  8015042d0b4ac125867af5b096b175ce
    libs/bootstrap-dialog-1.34.4-min.js  5ce8851dc823429a42ab6147554403cc
    libs/dragula-3.6.7-min.js  8ef652fe9e78af44f287ac3c92d4a07f
    libs/form2js-2.0-769718a.js  897ec696be559d5bb804b0803616efc5
    libs/handlebars-4.7.7.js  c4d39d28c89d97c1c510b03067015f84
    libs/i18next-1.7.3-min.js  35578b3a6b9c4592c52b742017d3ffd2
    libs/jquery-3.7.1-min.js  2c872dbe60f4ba70fb85356113d8b35e
    libs/jquery.ba-dotimeout-1.0-min.js  f10a418e5706963ae4b98710b25b44a8
    libs/jquery.placeholder-2.0.8.js  d7098f9b5df7c2fdf5119c7428a19441
    libs/js2form-2.0-769718a.js  fc83dc6af4259d45638391faa8fc9b29
    libs/lodash-3.10.1-min.js  7629cac4f079926ef505e2271bb5135f
    libs/moment-2.28.0-min.js  bb51b2cdde2dec6ee91604f77df6cf75
    libs/react-15.2.1-min.js  a4137323c75e65beca5a3ca602d78a87
    libs/react-dom-15.2.1-min.js  981fd81aa9e74564eadc59331f03e23c
    libs/requirejs-2.3.7-min.js  01252f25e96768861bd3effa7bf8889e
    libs/selectize-0.12.1-min.js  7a8aec7b45f095debbdd50703b06e6c3
    libs/spin-2.0.1-min.js  104d92cec8a995e6ee3fcde85dce4832
    libs/xdate-0.8-min.js  68f8cdcac085adbaf0a5e8271e6f66a4

### Only in the package — 1 file

    package.json  20aa8b1b7e0e20721c95840859f15642

`amd/package.json`, containing `{"type": "commonjs", "sideEffects": true}`. It exists to stop Node
resolving the `./amd` tree as ES modules. In the overlay it lands at `target/www/package.json`,
where nothing reads it — RequireJS and `r.js` never consult `package.json`. **Inert**, and confirmed
to have had no effect on the `r.js` run.

---

## What the consumer actually covers

Recorded because the gate verdict rests on it, and because 3.7 should know what was and was not
already checked.

**38 of the 79 modules reach the r.js bundle.** The bundle contains 60 module ids, of which 38 are
from these two packages. The other 41 are not in the bundle at all and are fetched individually by
RequireJS from `target/www` when a test or a view requires them.

**One thing mock does better than expected:** because those 41 load as raw AMD files, the run
exercises **both** delivery routes — the `r.js`-optimised one and the raw-file one. `Base64`,
`OAuth`, `Queue` and `AbstractCollection` are tested through the raw-file route specifically.

**`ui-user` is effectively untested.** Only 5 of its 14 modules reach the bundle
(`AbstractUserProfileTab`, `ConfirmPasswordDialog`, `UserProfileView`, `UserMessages`,
`UserRoutesConfig`). And `mock/src/test/qunit/tests/main.js` has `// "./user/AnonymousProcessView"`
**commented out**, so the one user-side QUnit file that `sync:test` copies into
`target/test/tests/user/` on every build is never loaded. The advertised "1 file from
`user/src/test/qunit`" contributes zero tests. Pre-existing; not touched.

**The 33 tests are utility-level.** `Base64`, `OAuth`, `Router`, `Queue`, `ObjectUtil`, `UIUtils`,
`ValidatorsManager`, `AbstractModel`, `AbstractCollection`, `form2js`. No view renders, no
`EventManager` round trip, no `Router` navigation.

The 41 modules not in the bundle:

    org/forgerock/commons/ui/common/backgrid/Backgrid
    org/forgerock/commons/ui/common/backgrid/extension/ThemeablePaginator
    org/forgerock/commons/ui/common/backgrid/extension/ThemeableSelectAllCell
    org/forgerock/commons/ui/common/backgrid/extension/ThemeableServerSideFilter
    org/forgerock/commons/ui/common/components/BootstrapDialog
    org/forgerock/commons/ui/common/components/Breadcrumbs
    org/forgerock/commons/ui/common/components/ConfirmationDialog
    org/forgerock/commons/ui/common/components/Dialog
    org/forgerock/commons/ui/common/components/hoc/withRouter
    org/forgerock/commons/ui/common/components/hoc/withRouterPropType
    org/forgerock/commons/ui/common/components/LoginHeader
    org/forgerock/commons/ui/common/components/popup/PopupCtrl
    org/forgerock/commons/ui/common/components/popup/PopupView
    org/forgerock/commons/ui/common/EnableCookiesView
    org/forgerock/commons/ui/common/LoginDialog
    org/forgerock/commons/ui/common/main/AbstractCollection
    org/forgerock/commons/ui/common/main/AbstractDelegate
    org/forgerock/commons/ui/common/main/ReactAdapterView
    org/forgerock/commons/ui/common/main/ViewManager
    org/forgerock/commons/ui/common/NotFoundView
    org/forgerock/commons/ui/common/UnauthorizedView
    org/forgerock/commons/ui/common/util/AutoScroll
    org/forgerock/commons/ui/common/util/BackgridUtils
    org/forgerock/commons/ui/common/util/Base64
    org/forgerock/commons/ui/common/util/CustomPolyfill
    org/forgerock/commons/ui/common/util/DateUtil
    org/forgerock/commons/ui/common/util/FormGenerationUtils
    org/forgerock/commons/ui/common/util/Mime
    org/forgerock/commons/ui/common/util/OAuth
    org/forgerock/commons/ui/common/util/Queue
    org/forgerock/commons/ui/common/util/reactify
    org/forgerock/commons/ui/common/util/ValidatorsUtils
    org/forgerock/commons/ui/user/anonymousProcess/AnonymousProcessView
    org/forgerock/commons/ui/user/anonymousProcess/ForgotUsernameView
    org/forgerock/commons/ui/user/anonymousProcess/KBAQuestionView
    org/forgerock/commons/ui/user/anonymousProcess/KBAView
    org/forgerock/commons/ui/user/anonymousProcess/PasswordResetView
    org/forgerock/commons/ui/user/anonymousProcess/SelfRegistrationView
    org/forgerock/commons/ui/user/delegates/AnonymousProcessDelegate
    org/forgerock/commons/ui/user/delegates/KBADelegate
    org/forgerock/commons/ui/user/profile/UserProfileKBATab

---

## What this leaves for 3.6, 3.7 and 3.8

- **3.6** — the payload manifest this document confirms is the one to diff the tarball's file list
  against. Note the shape: 94 static files byte-identical to the zip, 79 `.js` modules that are the
  Babel-transpiled form of the zip's, 40 third-party files deliberately absent because they are
  peers, and `amd/package.json` deliberately present.
- **3.7** — the 40 zip-only files are what `openam-ui-ria` must source elsewhere once the
  `commons.ui:user:zip:www` dependency and its `unpack-forgerock-ui-user` execution go. `form2js`
  and `js2form` have no npm package. Also cheap and worth doing there: grep `openam-ui-ria` for a
  global named `_typeof`.
- **3.8** — the real evidence. This document's verdict is deliberately narrow, and the phase-0a
  suite against `openam-ui-ria` on the AMD tarballs is what would catch an incompatibility mock
  cannot see, particularly in the 41 unbundled modules and in `ui-user`.

---

## How this was produced

1. **Confirmed both AMD builds exist** — `commons/package.json` and `user/package.json` name
   `target/npm` as the output; both trees were regenerated with `npm run build:npm`.
2. **Baseline first.** `rm -rf commons/target user/target mock/target` — never `mvn clean` — then
   `mvn install` from `commons/ui`. Build log and QUnit output written to files and grepped, not
   dumped.
3. **Determinism check.** The zip tree re-unpacked, snapshotted, `grunt build` re-run standalone;
   identical bundle bytes and digest, so step 4's delta is attributable to the swap.
4. **Swap.** Pristine `target/www` restored, the four package trees overlaid onto it, the identical
   `grunt build` re-run. Nothing under `mock/` edited.
5. **Manifest diff.** MD5 per file over both trees, compared with `join`/`comm`. Independently
   reproduced from the trees on disk when this document was written: 173 in both, 94 equal, 79
   differing, 40 zip-only, 1 package-only — matching the measurement exactly.
6. **Classification.** Each of the 79 differing files parsed with `@babel/parser` and re-printed
   through `@babel/generator` with comments stripped, then compared: whitespace-normalised raw text
   for class A, generated output for B/Z, generated output with function-expression ids dropped for
   C, presence of the injected helper for D, identifier-set difference for E. String literal
   **values** compared separately for Z.
7. **Bundle decomposition.** Both bundles split at `define("<id>"` boundaries and compared chunk by
   chunk, with and without line breaks normalised.

---

## Restore

**The consumer is back on the Maven zip and still builds.** `rm -rf mock/target`, then `mvn install`
from `commons/ui/mock`:

- `BUILD SUCCESS`
- `mock/target/www/main.js` — 395,730 bytes, MD5 `f710b7a4c20ddf570b7fcaad857e8ad9` — **identical to
  the step 1 baseline**
- `33 tests completed in 667ms, with 0 failed, 0 skipped, and 0 todo.`

`git status` clean. No `npm link` and no global install were used at any point; `npm ls -g` contains
neither commons package.

`~/.m2` is intact: 57 `org.openidentityplatform.commons.ui.libs` artefact directories present, and
the `commons.ui` `commons`/`user`/`mock` coordinates carry only `pom` and `zip:www`. **No `tgz:npm`
artefact exists anywhere in `~/.m2` — nothing has been packaged into Maven (3.6) or published to any
registry (3.11).**

---

## Incidental findings

**`commons/package-lock.json` is stale relative to `commons/package.json`.** Any `mvn install` in
`commons/ui` runs `npm install` at `initialize`, which rewrites two fields in the committed lock:

```
-      "license": "CDDL-1.0",        +      "license": "CDDL-1.1",
-        "lodash": "^3.10.1",        +        "lodash": ">=3.10.1",
```

Both are task 3.2 decisions that landed in `package.json` without the lock being regenerated. The
consequence is that a clean build dirties the working tree — which matters directly to task 3.7,
whose failure signal is *"treat a dirty `git status` after a clean build as the failure signal"*. The
lock was reverted here rather than committed; **it should be regenerated and committed before 3.7
relies on that signal.** `user/package-lock.json` does not have this problem.

**`mock/src/test/qunit/tests/main.js` does not load the `ui-user` test.** See
[What the consumer actually covers](#what-the-consumer-actually-covers). Pre-existing; not touched.

---

## What could not be determined

- **Whether anything in the wider product reads or writes a global `_typeof`.** Only `commons/ui`
  was in scope. The collision risk is bounded by inspection of these two packages, not by a search
  of `openam-ui-ria`, `openidm-ui-*` or `openig-ui`.
- **Behaviour of the 41 unbundled modules and of 9 of `ui-user`'s 14.** mock neither bundles nor
  tests them.
- **Whether the transpile is interchangeable under a consumer that transpiles again on top.**
  `openam-ui-ria` runs its own Babel over its composition directory. Double transpilation of the
  package's output was not measured.
- **`openig-ui` and `openam-ui-ria` as consumers.** Not run — deferred to 3.7 and 3.8 by the
  decision recorded in the gate verdict.
