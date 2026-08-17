/**
 * The contents of this file are subject to the terms of the Common Development and
 * Distribution License (the License). You may not use this file except in compliance with the
 * License.
 *
 * You can obtain a copy of the License at legal/CDDLv1.0.txt. See the License for the
 * specific language governing permission and limitations under the License.
 *
 * When distributing Covered Software, include this CDDL Header Notice in each file and include
 * the License file at legal/CDDLv1.0.txt. If applicable, add the following below the CDDL
 * Header, with the fields enclosed by brackets [] replaced by your own identifying
 * information: "Portions copyright [year] [name of copyright owner]".
 *
 * Portions copyright 2026 3A Systems, LLC.
 */

/*
 * ============================================================================================
 * Emits the @openidentityplatform/ui-commons package into target/npm.
 * ============================================================================================
 *
 * ONE SOURCE, TWO BUILDS. The AMD sources under src/main/js are the single source of truth.
 * The ES module tree is *generated* from them; nothing under src/main/js is written by this
 * script, and the Maven www zip is unaffected because it assembles target/classes, which Maven
 * fills from the two <resource> directories (src/main/js, src/main/resources) and nothing else.
 * Generated output must therefore never be written beside the sources — only under target/.
 *
 * ---------------------------------------------------------------------------------------------
 * WHY THE AMD BUILD IS NOT IN package.json "exports"
 * ---------------------------------------------------------------------------------------------
 * Because "exports" would do nothing for it. RequireJS and r.js resolve a module id to a file by
 * concatenating baseUrl (or a `paths` prefix) with the id and appending ".js". Neither reads
 * package.json — not "main", not "exports", not "module". This was measured, not assumed: a
 * throwaway package carrying a deliberately bogus "main" and "exports" was loaded through
 * requirejs 2.3.7 (the version openam-ui-ria builds with) and the load failed with
 *
 *     Tried loading "org/forgerock/commons/ui/common/main/Router" at
 *     <app>/org/forgerock/commons/ui/common/main/Router.js then tried node's require(...)
 *
 * with a perfectly valid "exports" field sitting in the package the whole time. See
 * commons/ui/NOTES-dual-build.md section 2 for the full spike.
 *
 * So an AMD consumer reaches ./amd one of two ways, neither involving package.json:
 *
 *   1. A RequireJS `paths` entry. It MUST be pinned to the full narrow prefix:
 *
 *          paths: { "org/forgerock/commons/ui/common":
 *                       "node_modules/@openidentityplatform/ui-commons/amd/org/forgerock/commons/ui/common" }
 *
 *      A broader "org/forgerock/commons" prefix breaks the sibling ui-user package, whose
 *      modules live at org/forgerock/commons/ui/user/** and would then be looked for inside
 *      this package. Note that a `paths` entry also *wins over* a same-path file in the
 *      consumer's own tree, which inverts the last-wins overlay the Grunt composition relies on.
 *
 *   2. A copy step: copy ./amd into the consumer's composition directory ahead of its own
 *      sources, which is what openam-ui-ria's copy:compose already does for the unpacked zip.
 *      This preserves last-wins, so a product file at the same path still overrides.
 *
 * "exports" in the emitted package.json therefore describes the ES module build only, plus the
 * static payload under ./www. That asymmetry is deliberate. Do not "fix" it by adding
 * "./amd/*" — that would imply a resolution mechanism that does not exist for AMD consumers,
 * and would suggest the entry is what makes the AMD build reachable when it is not.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT IT EMITS
 * ---------------------------------------------------------------------------------------------
 *   target/npm/amd/   65 .js  AMD, ids intact, transpiled (see TRANSPILE below)
 *   target/npm/esm/   66 .js  generated ES modules + one hand-written ESM-only helper
 *   target/npm/www/   63      templates, partials, less, images, favicon.ico, oauthReturn.html
 *
 * The www tree is not reachable through any module id: templates are fetched at run time by URL
 * and the less files are @imported by flat composition-relative path. They are shipped because
 * a consumer that does not get them fails much later and somewhere unrelated — a missing
 * template surfaces as a blank view, not as a resolution error.
 */

"use strict";

var fs = require("fs");
var path = require("path");
var babel = require("@babel/core");
var amdToEs6 = require("@buxlabs/amd-to-es6");

var MODULE_ROOT = path.resolve(__dirname, "..");
var JS_SRC = path.join(MODULE_ROOT, "src", "main", "js");
var RES_SRC = path.join(MODULE_ROOT, "src", "main", "resources");
var ESM_SRC = path.join(MODULE_ROOT, "src", "main", "esm");
var OUT = path.join(MODULE_ROOT, "target", "npm");

var ID_PREFIX = "org/forgerock/commons/ui/common";
var LOADER_RUNTIME_ID = ID_PREFIX + "/util/esm/LoaderRuntime";

/*
 * The licence text, taken from the repository root rather than copied into this module.
 *
 * The tarball used to declare a licence and carry no text to read. Copying rather than duplicating
 * the file keeps one authority: a second checked-in copy beside this build would be free to drift
 * from the repository's, which is the failure this is fixing rather than one to reintroduce.
 *
 * LICENCE_HEADING pins the version, because "the declared identifier and the shipped text disagree"
 * is precisely the defect found here — package.json said CDDL-1.0 against a repository licensed
 * under 1.1. Asserting the heading means changing one without the other fails the build instead of
 * shipping. Update both together, or neither.
 */
var LICENCE_SRC = path.resolve(MODULE_ROOT, "..", "..", "LICENSE.md");
var LICENCE_HEADING = /COMMON DEVELOPMENT AND DISTRIBUTION LICENSE \(CDDL\) Version (\d+\.\d+)/;

/*
 * The committed record of every path the packed tarball should contain — the file task 3.6 diffs
 * `npm pack` against. It is checked in, and this build asserts the emitted tree against it path
 * for path.
 *
 * That it is checked in rather than generated is the whole point. An earlier shape of this script
 * wrote the manifest from the same directory walk that produced the tree, which made 3.6's
 * "acceptance is the tarball's file list diffed against the manifest" a comparison of a run
 * against itself: it could not fail. A file that moves or is renamed keeps the counts identical
 * and passes a count-only check too. Only a record that predates the run can catch either.
 *
 * Regenerate deliberately, never reflexively:  node build/npm-package.js --update-payload-record
 * and commit the diff alongside whatever change to the sources caused it.
 */
var PAYLOAD_RECORD = path.join(__dirname, "expected-payload.txt");
var UPDATE_RECORD = process.argv.indexOf("--update-payload-record") !== -1;

/*
 * Counts, checked first because the message is far easier to read than a 199-line path diff when
 * a whole directory goes missing. These are the counts recorded in commons/ui/NOTES-dual-build.md
 * section 1. They are a coarse net under the path record above, not a substitute for it: dropping
 * a directory produces a package that installs and builds cleanly and breaks at run time.
 */
var EXPECTED = {
    // 60 org/** + 5 config/**
    amd: 65,
    // the same 65, plus the ESM-only LoaderRuntime helper
    esm: 66,
    // 36 less + 14 templates + 1 partial + 9 images + 1 json + favicon + oauthReturn
    www: 63,
    // hand-written ESM files under src/main/esm
    hand: 2
};

/*
 * TRANSPILE. The AMD tree is emitted through Babel with the same presets openam-ui-ria applies
 * to this code today (Gruntfile.js babel.transpileJS), minus @babel/preset-react, which commons
 * does not need — it uses React.createElement/createClass directly and contains no JSX syntax.
 *
 * It is transpiled rather than copied verbatim because a consumer wiring the package through a
 * RequireJS `paths` entry never runs it through its own Babel step: those files sit outside the
 * composition directory the transpile task walks, so whatever this package ships is what reaches
 * the browser. Running the consumer's own presets here brings the `paths` route close to what the
 * copy route already produces, rather than shipping something newer than either.
 *
 * Note what that does and does not do. Under these targets Babel leaves arrow functions and
 * template literals alone — every browser in the range supports them — so the two files with
 * arrows and the one with a template literal come out much as they went in, exactly as they do
 * through openam-ui-ria's own transpile today. This step is for equivalence with the consumer's
 * pipeline, not for reaching ES5. A consumer needing ES5 has to say so with its own targets.
 *
 * "close to", not "identical to", and the difference is exactly one line. openam-ui-ria's own
 * options (Gruntfile.js babel.transpileJS) leave `sourceType` at Babel's default of "module" and
 * `preset-env`'s `modules` at "auto", so its output carries a "use strict" prologue; measured,
 * running those options over util/Base64.js emits `"use strict";` as line 1 while this build's
 * options do not. Nothing else differs — an AMD file has no import/export for the CommonJS
 * transform to rewrite, so the `define()` call survives either way.
 *
 * sourceType "script" with modules:false is deliberate and stays, in full knowledge of that gap.
 * These are AMD script files, not ES modules. The divergence runs in the safe direction: strict
 * mode is a *narrowing* of sloppy mode, so code that runs under the copy route's strict prologue
 * also runs without it, while the reverse is not true (octal literals, `with`, duplicate
 * parameter names and `arguments.callee` are all strict-mode errors). Shipping the sloppy form
 * therefore cannot break a consumer that transpiles on top of it, and it keeps the semantics
 * this library has had in every distribution that does not transpile at all — openidm-ui and
 * openig-ui among them. Do not "align" this by dropping sourceType without re-reading that
 * asymmetry; the alignment would be cosmetic and the risk would be real.
 */
var BABEL_OPTIONS = {
    babelrc: false,
    configFile: false,
    sourceType: "script",
    compact: false,
    presets: [
        [require.resolve("@babel/preset-env"), {
            targets: "> 0.2%, not dead, last 2 versions",
            modules: false
        }]
    ],
    plugins: [
        [require.resolve("@babel/plugin-transform-classes"), { loose: true }]
    ]
};

/*
 * The four AMD files using loader APIs that have no ES module equivalent. The generator emits
 * them without complaint but leaves the loader calls in place, where they would be silently
 * broken — `require` simply does not exist in an ES module. Rather than maintain hand-written
 * ESM copies of these files (UIUtils alone is 400+ lines, and two diverging copies of a file
 * this central is a worse problem than the one it solves), the generated output is patched at
 * exactly the call sites, and every patch asserts its own hit count. If the AMD source changes
 * shape, the build fails here instead of shipping a broken ES module.
 *
 * `main.js` is not in this list: the generator throws on it outright, so it is hand-written
 * under src/main/esm along with the LoaderRuntime helper it needs.
 */
var ESM_PATCHES = {
    "org/forgerock/commons/ui/common/main/i18nManager.js": {
        needsLoaderRuntime: true,
        edits: [
            {
                // AMD's `module` pseudo-dependency becomes an import of a package called
                // "module", which does not exist. Drop it and route module.config() through
                // the seam.
                find: /^import Module from "module";\n/m,
                replace: "",
                count: 1,
                why: "drop the bogus 'module' pseudo-dependency import"
            },
            {
                find: /\bModule\.config\(\)/g,
                replace: "loaderRuntime.moduleConfig()",
                count: 1,
                why: "module.config() -> LoaderRuntime.moduleConfig()"
            },
            {
                find: /\brequire\.toUrl\(/g,
                replace: "loaderRuntime.toUrl(",
                count: 1,
                why: "require.toUrl() -> LoaderRuntime.toUrl() (i18next resGetPath)"
            }
        ]
    },
    "org/forgerock/commons/ui/common/util/UIUtils.js": {
        needsLoaderRuntime: true,
        edits: [
            {
                find: /\brequire\.toUrl\(/g,
                replace: "loaderRuntime.toUrl(",
                count: 1,
                why: "require.toUrl() -> LoaderRuntime.toUrl() (template fetch)"
            }
        ]
    },
    "org/forgerock/commons/ui/common/main/ViewManager.js": {
        // The seam is imported for unwrapModule alone — resolution here needs no help, because
        // the id is a literal.
        needsLoaderRuntime: true,
        edits: [
            {
                // The only dynamic require in commons whose id is a literal, so it becomes a
                // plain import() a bundler can still trace.
                //
                // The unwrap goes through the seam rather than being written out again here.
                // An earlier version did `mod.default || mod` inline, which works but is a
                // second idiom for a decision that has already been wrong once: `__esModule`
                // alone misses native namespaces, and having two spellings of "is this a module
                // record" is how that survived review the first time. One implementation, one
                // place to fix.
                find: new RegExp(
                    "require\\(\\[(\"org/forgerock/commons/ui/common/main/ReactAdapterView\")\\]," +
                    "\\s*function\\s*\\(\\s*(\\w+)\\s*\\)\\s*\\{"
                ),
                replace: "import($1).then(function (__reactAdapterModule) {\n" +
                    "        var $2 = loaderRuntime.unwrapModule(__reactAdapterModule);",
                count: 1,
                why: "lazy require([literal id]) -> dynamic import() + seam unwrap"
            }
        ]
    },
    "org/forgerock/commons/ui/common/util/ModuleLoader.js": {
        needsLoaderRuntime: true,
        edits: [
            {
                // The id here is assembled at run time, so import() cannot serve it. This is the
                // call every view lookup goes through, and D1's registry is what fills it.
                find: /require\(\[libPath\],\s*promise\.resolve\);/,
                replace: "loaderRuntime.loadModule(libPath).then(promise.resolve, promise.reject);",
                count: 1,
                why: "require([runtime id]) -> LoaderRuntime.loadModule()"
            }
        ]
    }
};

// ---------------------------------------------------------------------------------------------

function fail (message) {
    process.stderr.write("\n[npm-package] BUILD FAILED: " + message + "\n\n");
    process.exit(1);
}

function walk (dir, filter) {
    var found = [];
    if (!fs.existsSync(dir)) { return found; }

    (function recurse (current) {
        fs.readdirSync(current, { withFileTypes: true }).forEach(function (entry) {
            var full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                recurse(full);
            } else if (!filter || filter(full)) {
                found.push(path.relative(dir, full).split(path.sep).join("/"));
            }
        });
    }(dir));

    return found.sort();
}

function write (target, contents) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
}

/**
 * Extracts the leading licence header from a source file. The ES module generator reprints from
 * an AST and drops every comment, which would strip the CDDL header from all 65 files of a
 * distributed package.
 */
function licenceHeader (source) {
    var match = source.match(/^\s*\/\*[\s\S]*?\*\//);
    return match ? match[0].trim() + "\n\n" : "";
}

/**
 * Rewrites `./`-relative imports to the absolute commons id the rest of the tree uses.
 *
 * Two AMD files declare dependencies relatively — `main.js` (twelve of them) and `util/OAuth.js`
 * (`./URIUtils`) — and the generator carries the relative form straight through. That leaves the
 * ES module build with two import styles, one of which nothing can resolve: extensionless and
 * relative is unresolvable by Node outright, and a consumer aliasing the commons id prefix never
 * sees a relative specifier to alias. Normalising here means the whole tree imports the way
 * NPM-PACKAGE.md says it does — by the same absolute ids the AMD build uses.
 */
function absolutiseImports (rel, code) {
    var dir = path.posix.dirname(rel);

    return code.replace(
        /(\bfrom\s*|\bimport\s*\(?\s*)("|')(\.\.?\/[^"']+)\2/g,
        function (match, keyword, quote, specifier) {
            var absolute = path.posix.normalize(path.posix.join(dir, specifier));
            return keyword + quote + absolute + quote;
        }
    );
}

function applyEdits (id, code, spec) {
    spec.edits.forEach(function (edit) {
        var hits = code.match(edit.find);
        var actual = hits ? (edit.find.global ? hits.length : 1) : 0;

        if (actual !== edit.count) {
            fail(
                "ES module patch did not apply as expected in " + id + "\n" +
                "  patch:    " + edit.why + "\n" +
                "  pattern:  " + edit.find + "\n" +
                "  expected: " + edit.count + " occurrence(s)\n" +
                "  found:    " + actual + "\n\n" +
                "The AMD source has changed shape. Update the patch in build/npm-package.js so\n" +
                "the ES module build keeps working — do NOT relax this check. The loader call it\n" +
                "targets has no ES module equivalent and would ship silently broken."
            );
        }

        code = code.replace(edit.find, edit.replace);
    });

    if (spec.needsLoaderRuntime) {
        code = "import * as loaderRuntime from \"" + LOADER_RUNTIME_ID + "\";\n" + code;
    }

    return code;
}

/**
 * Removes comments while leaving string literals intact, so the loader-API check below reads
 * code rather than prose. The hand-written ES modules describe the very APIs they exist to
 * replace, and both files name them in their documentation.
 */
function stripComments (code) {
    return code.replace(
        /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
        function (match, stringLiteral) { return stringLiteral || ""; }
    );
}

/**
 * The ES module build must contain no surviving AMD loader API. This is the net under the
 * per-file patches: it catches a loader call in a file nobody thought to patch.
 */
function assertNoLoaderApiSurvives (esmDir) {
    var offences = [];

    walk(esmDir, function (f) { return f.endsWith(".js"); }).forEach(function (rel) {
        var code = stripComments(fs.readFileSync(path.join(esmDir, rel), "utf8"));
        [
            { pattern: /\brequire\.toUrl\(/, what: "require.toUrl(" },
            { pattern: /\brequire\.config\(/, what: "require.config(" },
            { pattern: /\brequirejs\s*[(.]/, what: "requirejs(" },
            { pattern: /\brequire\(\s*\[/, what: "require([...])" },
            { pattern: /^import .* from "module";$/m, what: "import from \"module\"" },
            { pattern: /\bdefine\(\s*[["]/, what: "define(" },
            // Both specifier positions, not just the static one. absolutiseImports rewrites
            // `from "./x"` and `import("./x")` alike, so checking only the first left the net
            // with a hole exactly where the rewriter had a bug to have.
            { pattern: /\bfrom\s*["']\.\.?\//, what: "relative static import (should be an absolute id)" },
            { pattern: /\bimport\s*\(\s*["']\.\.?\//, what: "relative dynamic import (should be an absolute id)" }
        ].forEach(function (check) {
            if (check.pattern.test(code)) { offences.push(rel + " -> " + check.what); }
        });
    });

    if (offences.length) {
        fail(
            "AMD loader APIs survived into the ES module build:\n    " + offences.join("\n    ") +
            "\n\nEach of these is undefined in an ES module and would fail at run time."
        );
    }
}

/**
 * The hand-written ESM main.js restates the AMD original's dependency array as imports. Nothing
 * links the two, so this compares them and fails on divergence.
 */
function assertMainInSync (esmMain) {
    var amdSource = fs.readFileSync(path.join(JS_SRC, ID_PREFIX + "/main.js"), "utf8");
    var depBlock = amdSource.match(/define\(\s*"[^"]+"\s*,\s*\[([\s\S]*?)\]/);

    if (!depBlock) {
        fail("could not read the dependency array from the AMD " + ID_PREFIX + "/main.js");
    }

    var amdDeps = (depBlock[1].match(/"([^"]+)"/g) || []).map(function (quoted) {
        return quoted.slice(1, -1).replace(/^\.\//, ID_PREFIX + "/");
    }).sort();

    var esmDeps = (esmMain.match(/^import "([^"]+)";$/gm) || []).map(function (line) {
        return line.replace(/^import "/, "").replace(/";$/, "");
    }).sort();

    var missing = amdDeps.filter(function (d) { return esmDeps.indexOf(d) === -1; });
    var extra = esmDeps.filter(function (d) { return amdDeps.indexOf(d) === -1; });

    if (missing.length || extra.length) {
        fail(
            "src/main/esm/" + ID_PREFIX + "/main.js is out of step with the AMD original:\n" +
            (missing.length ? "  missing imports: " + missing.join(", ") + "\n" : "") +
            (extra.length ? "  imports not in the AMD source: " + extra.join(", ") + "\n" : "") +
            "\nmain.js is hand-written because the generator throws on it; it has to be updated\n" +
            "by hand when the AMD dependency array changes."
        );
    }
}

/**
 * Every path `npm pack` will put in the tarball, in the order it will be diffed.
 *
 * This walks the emitted tree rather than reasoning about "files", so it stays honest if that
 * list changes. The five metadata entries are the ones the earlier count-based manifest silently
 * omitted, which left task 3.6's diff starting with five spurious "extra" lines: package.json is
 * always packed regardless of "files", and the two nested type markers sit inside packed
 * directories.
 */
function packedPaths (outDir, emitted) {
    var packed = ["package.json"];

    emitted.files.forEach(function (entry) {
        var full = path.join(outDir, entry);
        if (!fs.existsSync(full)) { return; }

        if (fs.statSync(full).isDirectory()) {
            walk(full).forEach(function (rel) { packed.push(entry + "/" + rel); });
        } else {
            packed.push(entry);
        }
    });

    return packed.sort();
}

/**
 * Asserts the emitted tree against the committed record, and reports the difference as paths
 * rather than as a count, because "one file fewer" is not an actionable message.
 */
function assertPayloadMatchesRecord (packed) {
    if (UPDATE_RECORD) {
        write(PAYLOAD_RECORD, [
            "# @openidentityplatform/ui-commons — expected tarball payload.",
            "# COMMITTED RECORD. Task 3.6 diffs `npm pack` output against this; build/npm-package.js",
            "# asserts the emitted tree against it on every run. Regenerate only on a deliberate",
            "# payload change, with `node build/npm-package.js --update-payload-record`, and commit",
            "# the diff together with the source change that caused it.",
            ""
        ].concat(packed).join("\n") + "\n");

        process.stdout.write("[npm-package] payload record REGENERATED: " +
            path.relative(MODULE_ROOT, PAYLOAD_RECORD) + " (" + packed.length + " paths)\n");
        return;
    }

    if (!fs.existsSync(PAYLOAD_RECORD)) {
        fail(
            "the committed payload record is missing: " +
            path.relative(MODULE_ROOT, PAYLOAD_RECORD) + "\n" +
            "Create it with: node build/npm-package.js --update-payload-record"
        );
    }

    var expected = fs.readFileSync(PAYLOAD_RECORD, "utf8").split("\n")
        .map(function (line) { return line.trim(); })
        .filter(function (line) { return line && line.charAt(0) !== "#"; });

    var added = packed.filter(function (p) { return expected.indexOf(p) === -1; });
    var removed = expected.filter(function (p) { return packed.indexOf(p) === -1; });

    if (added.length || removed.length) {
        fail(
            "the emitted payload does not match the committed record (" +
            path.relative(MODULE_ROOT, PAYLOAD_RECORD) + "):\n" +
            (removed.length ? "  MISSING (in the record, not emitted):\n    " +
                removed.join("\n    ") + "\n" : "") +
            (added.length ? "  UNEXPECTED (emitted, not in the record):\n    " +
                added.join("\n    ") + "\n" : "") +
            "\nA file that moved or was renamed keeps every count identical and reaches a\n" +
            "consumer as a resolution failure at run time. If this change is intended, rerun\n" +
            "with --update-payload-record and commit the record alongside the source change."
        );
    }
}

/**
 * Copies the repository licence into the payload, and refuses to ship if it disagrees with the
 * identifier `package.json` declares.
 *
 * SPDX writes CDDL 1.1 as "CDDL-1.1", so the version in the heading maps to the identifier by
 * substitution; anything else is a licence this check has not been taught and should stop the
 * build rather than be guessed at.
 */
function emitLicence (declared) {
    if (!fs.existsSync(LICENCE_SRC)) {
        fail(
            "the licence text is missing: " + LICENCE_SRC + "\n" +
            "package.json declares \"license\": \"" + declared + "\", so the tarball must carry the\n" +
            "text. Restore the repository LICENSE.md, or change LICENCE_SRC if it has moved."
        );
    }

    var text = fs.readFileSync(LICENCE_SRC, "utf8");
    var heading = LICENCE_HEADING.exec(text);

    if (!heading) {
        fail(
            "cannot read a CDDL version from the heading of " + LICENCE_SRC + ".\n" +
            "This check exists so the declared identifier and the shipped text cannot drift apart.\n" +
            "If the licence genuinely changed, update LICENCE_HEADING and package.json together."
        );
    }

    var fromText = "CDDL-" + heading[1];

    if (fromText !== declared) {
        fail(
            "the declared licence and the shipped licence text disagree.\n" +
            "  package.json \"license\": " + declared + "\n" +
            "  " + path.relative(MODULE_ROOT, LICENCE_SRC) + " heading: " + fromText + "\n" +
            "That mismatch is what this check was added for — it went unnoticed until task 3.2's\n" +
            "review. Change both together, or neither."
        );
    }

    fs.copyFileSync(LICENCE_SRC, path.join(OUT, "LICENSE.md"));
}

// ---------------------------------------------------------------------------------------------

function build () {
    var sourcePackage = JSON.parse(fs.readFileSync(path.join(MODULE_ROOT, "package.json"), "utf8"));

    fs.rmSync(OUT, { recursive: true, force: true });

    // --- 1. AMD: transpile, ids and layout untouched -----------------------------------------
    var jsFiles = walk(JS_SRC, function (f) { return f.endsWith(".js"); });

    jsFiles.forEach(function (rel) {
        var source = fs.readFileSync(path.join(JS_SRC, rel), "utf8");
        var result = babel.transformSync(source, Object.assign({ filename: rel }, BABEL_OPTIONS));

        if (!result || typeof result.code !== "string") {
            fail("Babel produced no output for " + rel);
        }

        write(path.join(OUT, "amd", rel), result.code + "\n");
    });

    // --- 2. ESM: generate, patch, then overlay the hand-written files -------------------------
    // Dotfiles are tooling, not sources. src/main/esm carries its own .eslintrc.js — the AMD
    // tree's config rejects `import`/`export` outright — and without this filter it is picked up
    // as a hand-written module, shadowing nothing and shipped in the package. The override guard
    // below catches that, but a build failure is a poor way to learn that a config file is not a
    // source file.
    var handWritten = walk(ESM_SRC, function (f) {
        return f.endsWith(".js") && path.basename(f).charAt(0) !== ".";
    });

    handWritten.forEach(function (rel) {
        // Every hand-written override except the ESM-only helper must shadow a real AMD source
        // file, or it is dead weight nobody will notice.
        if (rel.indexOf("/util/esm/") === -1 && jsFiles.indexOf(rel) === -1) {
            fail(
                "src/main/esm/" + rel + " overrides a file that does not exist in src/main/js.\n" +
                "Either the AMD source was moved or deleted, or the override is stale."
            );
        }
    });

    jsFiles.forEach(function (rel) {
        if (handWritten.indexOf(rel) !== -1) { return; }

        var source = fs.readFileSync(path.join(JS_SRC, rel), "utf8");
        var converted;

        try {
            converted = amdToEs6(source);
        } catch (e) {
            fail(
                "the ES module generator threw on " + rel + ": " + e.message + "\n" +
                "Add a hand-written ES module for this file under src/main/esm/ and document why."
            );
        }

        if (converted.indexOf("define(") !== -1) {
            fail("the ES module generator left a define() in " + rel + " — it was not converted");
        }

        converted = absolutiseImports(rel, converted);

        var spec = ESM_PATCHES[rel];
        if (spec) { converted = applyEdits(rel, converted, spec); }

        write(path.join(OUT, "esm", rel), licenceHeader(source) + converted.trim() + "\n");
    });

    handWritten.forEach(function (rel) {
        var contents = fs.readFileSync(path.join(ESM_SRC, rel), "utf8");
        if (rel === ID_PREFIX + "/main.js") { assertMainInSync(contents); }
        write(path.join(OUT, "esm", rel), contents);
    });

    assertNoLoaderApiSurvives(path.join(OUT, "esm"));

    // --- 3. www: the payload that has no module id -------------------------------------------
    walk(RES_SRC).forEach(function (rel) {
        fs.mkdirSync(path.dirname(path.join(OUT, "www", rel)), { recursive: true });
        fs.copyFileSync(path.join(RES_SRC, rel), path.join(OUT, "www", rel));
    });

    // --- 4. package.json ----------------------------------------------------------------------
    var emitted = {
        name: sourcePackage.name,
        version: sourcePackage.version,
        description: sourcePackage.description,
        license: sourcePackage.license,
        // Kept per design decision D18: phase 1 distributes this package as a Maven-attached
        // tarball produced by `npm pack`, which honours "private"; only `npm publish` refuses.
        // Task 3.11 is what removes it, after the phase-1 gate.
        private: true,
        repository: sourcePackage.repository,
        "//exports": "The AMD build under ./amd is deliberately absent from \"exports\". " +
            "RequireJS and r.js resolve by file path and never read package.json — see the " +
            "header of build/npm-package.js and NOTES-dual-build.md section 2. An AMD consumer " +
            "uses a narrow RequireJS paths entry or a copy step. Note that \"exports\" does not " +
            "resolve the ES module tree's own internal specifiers either: those are bare, " +
            "extensionless commons ids, which an ESM consumer serves with one alias entry. " +
            "NPM-PACKAGE.md has both routes.",
        exports: {
            ".": "./esm/" + ID_PREFIX + "/main.js",
            "./esm/*": "./esm/*",
            "./www/*": "./www/*",
            "./package.json": "./package.json"
        },
        files: ["amd", "esm", "www", "LICENSE.md", "MANIFEST.txt", "NPM-PACKAGE.md"],
        sideEffects: true,
        peerDependencies: sourcePackage.peerDependencies,
        peerDependenciesMeta: sourcePackage.peerDependenciesMeta
    };

    write(path.join(OUT, "package.json"), JSON.stringify(emitted, null, 2) + "\n");

    var docs = path.join(MODULE_ROOT, "NPM-PACKAGE.md");
    if (fs.existsSync(docs)) {
        fs.copyFileSync(docs, path.join(OUT, "NPM-PACKAGE.md"));
    }

    emitLicence(emitted.license);

    /*
     * Node decides whether a .js file is an ES module or a script from the nearest package.json
     * "type", so without these two markers it reparses every generated module after failing to
     * read it as CommonJS, and warns on each one. They also state the difference between the two
     * trees in the one place a tool looks: ./esm is ES modules, ./amd is not. The root
     * package.json cannot carry either answer, because it would be wrong for the other tree.
     */
    /*
     * "sideEffects" is repeated in both markers rather than left to the root package.json.
     * A bundler reads the *nearest* description file, so a nested package.json that omits the
     * field shadows the root's answer with the default — which happens to be the same
     * conservative answer here, but by accident. Repeating it means the file that a bundler
     * actually consults says what this package means: these modules register handlers, extend
     * prototypes and populate registries on import, and tree-shaking them is not safe.
     */
    write(path.join(OUT, "esm", "package.json"),
        JSON.stringify({ type: "module", sideEffects: true }, null, 2) + "\n");
    write(path.join(OUT, "amd", "package.json"),
        JSON.stringify({ type: "commonjs", sideEffects: true }, null, 2) + "\n");

    // --- 5. manifest and payload assertions ---------------------------------------------------
    var isJs = function (f) { return f.endsWith(".js"); };
    var amdFiles = walk(path.join(OUT, "amd"), isJs);
    var esmFiles = walk(path.join(OUT, "esm"), isJs);
    var wwwFiles = walk(path.join(OUT, "www"));

    var counts = { amd: amdFiles.length, esm: esmFiles.length, www: wwwFiles.length,
        hand: handWritten.length };

    Object.keys(EXPECTED).forEach(function (key) {
        if (counts[key] !== EXPECTED[key]) {
            fail(
                "payload count mismatch for '" + key + "': expected " + EXPECTED[key] +
                ", emitted " + counts[key] + ".\n" +
                "If this change is intended, update EXPECTED in build/npm-package.js and the\n" +
                "manifest in NPM-PACKAGE.md together — task 3.6 diffs the packed tarball against\n" +
                "that manifest, and a package short of templates, partials or locales installs\n" +
                "cleanly, builds cleanly and fails at run time somewhere unrelated."
            );
        }
    });

    var byDir = {};
    wwwFiles.forEach(function (rel) {
        var top = rel.indexOf("/") === -1 ? "(root)" : rel.split("/")[0];
        byDir[top] = (byDir[top] || 0) + 1;
    });

    /*
     * MANIFEST.txt is written before the payload check so that it is itself in the payload, and
     * its body is the committed record rather than another walk of the tree — that is what makes
     * task 3.6's diff mean something. Its five metadata entries (package.json, MANIFEST.txt,
     * NPM-PACKAGE.md and the two nested type markers) are listed rather than omitted, so the diff
     * starts empty instead of starting five lines behind.
     */
    // Placeholder first: MANIFEST.txt is itself a packed path, so it has to exist before the walk
    // that enumerates them, and its body is only knowable afterwards.
    write(path.join(OUT, "MANIFEST.txt"), "");

    var packed = packedPaths(OUT, emitted);

    write(path.join(OUT, "MANIFEST.txt"), [
        "# @openidentityplatform/ui-commons payload manifest",
        "# The committed record from build/expected-payload.txt, which build/npm-package.js has",
        "# asserted this tree against. Task 3.6 diffs the packed tarball against this list.",
        "#",
        "# Sorted in code-unit order. Compare with `LC_ALL=C sort` on both sides — a bare `sort`",
        "# folds case and ignores the path separator, which turns an identical set into ~60 lines",
        "# of spurious diff. Measured at 199 paths: identical sets, 60+ line diff in the default",
        "# locale, empty diff under LC_ALL=C.",
        "#",
        "# amd/ " + amdFiles.length + "   esm/ " + esmFiles.length + "   www/ " + wwwFiles.length +
            "   total packed " + packed.length,
        "# www/ by directory: " + Object.keys(byDir).sort().map(function (d) {
            return d + "=" + byDir[d];
        }).join(" "),
        ""
    ].concat(packed).join("\n") + "\n");

    assertPayloadMatchesRecord(packed);

    process.stdout.write(
        "[npm-package] " + emitted.name + "@" + emitted.version + " -> " +
        path.relative(MODULE_ROOT, OUT) + "\n" +
        "[npm-package]   amd/ " + amdFiles.length + " files (transpiled, ids intact)\n" +
        "[npm-package]   esm/ " + esmFiles.length + " files (" + handWritten.length +
        " hand-written, " + (esmFiles.length - handWritten.length) + " generated)\n" +
        "[npm-package]   www/ " + wwwFiles.length + " files (" +
        Object.keys(byDir).sort().map(function (d) { return d + "=" + byDir[d]; }).join(" ") + ")\n"
    );
}

build();
