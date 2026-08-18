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
 * The dual-build emitter shared by every ui module that ships an npm package.
 * ============================================================================================
 *
 * Task 3.2 wrote this for commons/ui/commons; task 3.3 needed the same emit for commons/ui/user
 * and lifted it here rather than copying it. Two copies of a build that decides what a published
 * package contains is how the two packages come to disagree about their own rules — which tree
 * is transpiled, whether relative imports are normalised, what counts as a surviving loader API.
 * Each module's build/npm-package.js is now a configuration file: what its ids are, what it
 * ships, and what only it needs. Everything below is what they share.
 *
 * ONE SOURCE, TWO BUILDS. The AMD sources under src/main/js are the single source of truth. The
 * ES module tree is *generated* from them; nothing under src/main/js is written here, and the
 * Maven www zip is unaffected because it assembles target/classes, which Maven fills from the
 * two <resource> directories (src/main/js, src/main/resources) and nothing else. Generated
 * output must therefore never be written beside the sources — only under target/.
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
 *   1. A RequireJS `paths` entry, pinned to the full narrow id prefix. Note that a `paths` entry
 *      also *wins over* a same-path file in the consumer's own tree, which inverts the last-wins
 *      overlay the Grunt composition relies on.
 *   2. A copy step: copy ./amd into the consumer's composition directory ahead of its own
 *      sources, which is what openam-ui-ria's copy:compose already does for the unpacked zip.
 *      This preserves last-wins, so a product file at the same path still overrides.
 *
 * "exports" in an emitted package.json therefore describes the ES module build only, plus the
 * static payload under ./www. That asymmetry is deliberate. Do not "fix" it by adding "./amd/*"
 * — that would imply a resolution mechanism that does not exist for AMD consumers.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT IT EMITS
 * ---------------------------------------------------------------------------------------------
 *   <module>/target/npm/amd/   AMD, ids intact, transpiled (see BABEL_OPTIONS below)
 *   <module>/target/npm/esm/   generated ES modules, plus any hand-written overrides
 *   <module>/target/npm/www/   templates, partials, less, images, locales — everything in
 *                              src/main/resources, verbatim
 *
 * The www tree is not reachable through any module id: templates are fetched at run time by URL
 * and the less files are @imported by flat composition-relative path. They are shipped because a
 * consumer that does not get them fails much later and somewhere unrelated — a missing template
 * surfaces as a blank view, not as a resolution error.
 */

"use strict";

var fs = require("fs");
var path = require("path");

/*
 * TRANSPILE. The AMD tree is emitted through Babel with the same presets openam-ui-ria applies
 * to this code today (Gruntfile.js babel.transpileJS), minus @babel/preset-react, which no
 * commons module needs — they use React.createElement/createClass directly, with no JSX syntax.
 *
 * It is transpiled rather than copied verbatim because a consumer wiring a package through a
 * RequireJS `paths` entry never runs it through its own Babel step: those files sit outside the
 * composition directory the transpile task walks, so whatever the package ships is what reaches
 * the browser. Running the consumer's own presets here brings the `paths` route close to what
 * the copy route already produces, rather than shipping something newer than either.
 *
 * Note what that does and does not do. Under these targets Babel leaves arrow functions and
 * template literals alone — every browser in the range supports them — exactly as they survive
 * openam-ui-ria's own transpile today. This step is for equivalence with the consumer's
 * pipeline, not for reaching ES5. A consumer needing ES5 has to say so with its own targets.
 *
 * "close to", not "identical to", and the difference is exactly one line. openam-ui-ria's own
 * options leave `sourceType` at Babel's default of "module" and preset-env's `modules` at
 * "auto", so its output carries a "use strict" prologue; measured, running those options over
 * util/Base64.js emits `"use strict";` as line 1 while these options do not. Nothing else
 * differs — an AMD file has no import/export for the CommonJS transform to rewrite, so the
 * define() call survives either way.
 *
 * sourceType "script" with modules:false is deliberate and stays, in full knowledge of that gap.
 * These are AMD script files, not ES modules. The divergence runs in the safe direction: strict
 * mode is a *narrowing* of sloppy mode, so code that runs under the copy route's strict prologue
 * also runs without it, while the reverse is not true (octal literals, `with`, duplicate
 * parameter names and `arguments.callee` are all strict-mode errors). Shipping the sloppy form
 * therefore cannot break a consumer that transpiles on top of it, and it keeps the semantics
 * these libraries have had in every distribution that does not transpile at all — openidm-ui and
 * openig-ui among them. Do not "align" this by dropping sourceType without re-reading that
 * asymmetry; the alignment would be cosmetic and the risk would be real.
 *
 * It lives here rather than in each module's config because "the two packages are transpiled the
 * same way" is a property worth being unable to break by editing one file.
 */
var BABEL_PRESET_TARGETS = "> 0.2%, not dead, last 2 versions";

/*
 * The licence heading pattern, pinning the version. "The declared identifier and the shipped text
 * disagree" is a defect that has already happened once here — package.json said CDDL-1.0 against
 * a repository licensed under 1.1 — so asserting the heading means changing one without the other
 * fails the build instead of shipping. Update both together, or neither.
 */
var LICENCE_HEADING = /COMMON DEVELOPMENT AND DISTRIBUTION LICENSE \(CDDL\) Version (\d+\.\d+)/;

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
 * an AST and drops every comment, which would strip the CDDL header from every file of a
 * distributed package.
 */
function licenceHeader (source) {
    var match = source.match(/^\s*\/\*[\s\S]*?\*\//);
    return match ? match[0].trim() + "\n\n" : "";
}

/**
 * Rewrites `./`-relative imports to the absolute module id the rest of the tree uses.
 *
 * Some AMD files declare dependencies relatively, and the generator carries the relative form
 * straight through. That leaves the ES module build with two import styles, one of which nothing
 * can resolve: extensionless and relative is unresolvable by Node outright, and a consumer
 * aliasing an id prefix never sees a relative specifier to alias. Normalising here means the
 * whole tree imports by the same absolute ids the AMD build uses.
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

/**
 * Applies a module's declared ES module patches, asserting each one's hit count.
 *
 * A patch exists where an AMD loader API has no ES module equivalent: the generator emits those
 * calls without complaint and leaves them silently broken, because `require` simply does not
 * exist in an ES module. If the AMD source changes shape the build fails here rather than
 * shipping a module that cannot run.
 */
function applyEdits (id, code, spec, loaderRuntimeId) {
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
        code = "import * as loaderRuntime from \"" + loaderRuntimeId + "\";\n" + code;
    }

    return code;
}

/**
 * Removes comments while leaving string literals intact, so the loader-API check below reads
 * code rather than prose. The hand-written ES modules describe the very APIs they exist to
 * replace, and name them in their documentation.
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
 * Every path `npm pack` will put in the tarball, in the order it will be diffed.
 *
 * This walks the emitted tree rather than reasoning about "files", so it stays honest if that
 * list changes. Metadata entries are included rather than omitted: package.json is always packed
 * regardless of "files", and the nested type markers sit inside packed directories. Omitting them
 * left task 3.6's diff starting five lines behind.
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
 *
 * That the record is checked in rather than generated is the whole point. An earlier shape of
 * this build wrote the manifest from the same directory walk that produced the tree, which made
 * task 3.6's "acceptance is the tarball's file list diffed against the manifest" a comparison of
 * a run against itself: it could not fail. A file that moves or is renamed keeps the counts
 * identical and passes a count-only check too. Only a record that predates the run catches either.
 */
function assertPayloadMatchesRecord (ctx, packed) {
    if (ctx.updateRecord) {
        write(ctx.payloadRecord, [
            "# " + ctx.name + " — expected tarball payload.",
            "# COMMITTED RECORD. Task 3.6 diffs `npm pack` output against this; the shared emitter",
            "# in ui/build/npm-package-lib.js asserts the emitted tree against it on every run.",
            "# Regenerate only on a deliberate payload change, with",
            "#     node build/npm-package.js --update-payload-record",
            "# and commit the diff together with the source change that caused it.",
            ""
        ].concat(packed).join("\n") + "\n");

        process.stdout.write("[npm-package] payload record REGENERATED: " +
            path.relative(ctx.moduleRoot, ctx.payloadRecord) + " (" + packed.length + " paths)\n");
        return;
    }

    if (!fs.existsSync(ctx.payloadRecord)) {
        fail(
            "the committed payload record is missing: " +
            path.relative(ctx.moduleRoot, ctx.payloadRecord) + "\n" +
            "Create it with: node build/npm-package.js --update-payload-record"
        );
    }

    var expected = fs.readFileSync(ctx.payloadRecord, "utf8").split("\n")
        .map(function (line) { return line.trim(); })
        .filter(function (line) { return line && line.charAt(0) !== "#"; });

    var added = packed.filter(function (p) { return expected.indexOf(p) === -1; });
    var removed = expected.filter(function (p) { return packed.indexOf(p) === -1; });

    if (added.length || removed.length) {
        fail(
            "the emitted payload does not match the committed record (" +
            path.relative(ctx.moduleRoot, ctx.payloadRecord) + "):\n" +
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
 * identifier package.json declares.
 *
 * The licence is taken from the repository root rather than copied into each module. A second
 * checked-in copy beside a build would be free to drift from the repository's, which is the
 * failure this is fixing rather than one to reintroduce.
 *
 * SPDX writes CDDL 1.1 as "CDDL-1.1", so the version in the heading maps to the identifier by
 * substitution; anything else is a licence this check has not been taught and should stop the
 * build rather than be guessed at.
 */
function emitLicence (ctx, declared) {
    if (!fs.existsSync(ctx.licenceSrc)) {
        fail(
            "the licence text is missing: " + ctx.licenceSrc + "\n" +
            "package.json declares \"license\": \"" + declared + "\", so the tarball must carry the\n" +
            "text. Restore the repository LICENSE.md, or change licenceSrc if it has moved."
        );
    }

    var text = fs.readFileSync(ctx.licenceSrc, "utf8");
    var heading = LICENCE_HEADING.exec(text);

    if (!heading) {
        fail(
            "cannot read a CDDL version from the heading of " + ctx.licenceSrc + ".\n" +
            "This check exists so the declared identifier and the shipped text cannot drift apart.\n" +
            "If the licence genuinely changed, update LICENCE_HEADING and package.json together."
        );
    }

    var fromText = "CDDL-" + heading[1];

    if (fromText !== declared) {
        fail(
            "the declared licence and the shipped licence text disagree.\n" +
            "  package.json \"license\": " + declared + "\n" +
            "  " + path.relative(ctx.moduleRoot, ctx.licenceSrc) + " heading: " + fromText + "\n" +
            "That mismatch is what this check was added for — it went unnoticed until task 3.2's\n" +
            "review. Change both together, or neither."
        );
    }

    fs.copyFileSync(ctx.licenceSrc, path.join(ctx.out, "LICENSE.md"));
}

// ---------------------------------------------------------------------------------------------

/**
 * Emits a module's dual-build npm package into <moduleRoot>/target/npm.
 *
 * config:
 *   moduleRoot     absolute path to the ui module (the directory holding package.json)
 *   idPrefix       the module id prefix its own sources live under
 *   babel          the caller's @babel/core — injected, not required here, so each module
 *                  resolves the toolchain from its own node_modules
 *   amdToEs6       the caller's @buxlabs/amd-to-es6, same reason
 *   expected       { amd, esm, www, hand } payload counts, asserted before the path record
 *   exports        the "exports" map to emit
 *   files          the "files" array to emit
 *   exportsNote    the "//exports" note to emit beside it
 *   esmPatches     optional, keyed by source-relative path (see applyEdits)
 *   loaderRuntimeId  optional, the seam id patches import
 *   onHandWritten  optional (rel, contents) hook for module-specific override checks
 */
function build (config) {
    var ctx = {
        moduleRoot: config.moduleRoot,
        jsSrc: path.join(config.moduleRoot, "src", "main", "js"),
        resSrc: path.join(config.moduleRoot, "src", "main", "resources"),
        esmSrc: path.join(config.moduleRoot, "src", "main", "esm"),
        out: path.join(config.moduleRoot, "target", "npm"),
        payloadRecord: path.join(config.moduleRoot, "build", "expected-payload.txt"),
        licenceSrc: config.licenceSrc ||
            path.resolve(config.moduleRoot, "..", "..", "LICENSE.md"),
        updateRecord: process.argv.indexOf("--update-payload-record") !== -1
    };

    // The whole zip contract rests on generated output landing only under target/ (see ONE
    // SOURCE, TWO BUILDS above). Assert it rather than trusting it: the next statement is an
    // rmSync -r -f on this path, so a config that got moduleRoot wrong would delete whatever it
    // pointed at instead of failing.
    var targetRoot = path.join(config.moduleRoot, "target") + path.sep;
    if (!(ctx.out + path.sep).startsWith(targetRoot)) {
        fail("Refusing to emit outside target/: " + ctx.out + " is not under " + targetRoot);
    }

    var babelOptions = {
        babelrc: false,
        configFile: false,
        sourceType: "script",
        compact: false,
        presets: [
            [require.resolve("@babel/preset-env", { paths: [config.moduleRoot] }), {
                targets: BABEL_PRESET_TARGETS,
                modules: false
            }]
        ],
        plugins: [
            [require.resolve("@babel/plugin-transform-classes",
                { paths: [config.moduleRoot] }), { loose: true }]
        ]
    };

    var sourcePackage = JSON.parse(
        fs.readFileSync(path.join(config.moduleRoot, "package.json"), "utf8"));

    ctx.name = sourcePackage.name;

    fs.rmSync(ctx.out, { recursive: true, force: true });

    // --- 1. AMD: transpile, ids and layout untouched -----------------------------------------
    var jsFiles = walk(ctx.jsSrc, function (f) { return f.endsWith(".js"); });

    // D19: the ES module build keeps the AMD id space, so the id space has to stay what the
    // package says it is. Every source is either the module's own (under idPrefix) or one of the
    // config leaves the product composes over. A file anywhere else would ship an id no consumer
    // has been told to alias, and would collide with the sibling package the moment both are
    // installed. verify-esm.mjs checks amd/esm parity after the fact; this checks the space
    // itself, before anything is emitted.
    jsFiles.forEach(function (rel) {
        var id = rel.replace(/\\/g, "/");
        if (!id.startsWith(config.idPrefix + "/") && !id.startsWith("config/")) {
            fail("Module id outside the declared id space: " + id + "\n" +
                "  expected " + config.idPrefix + "/** or config/**");
        }
    });

    jsFiles.forEach(function (rel) {
        var source = fs.readFileSync(path.join(ctx.jsSrc, rel), "utf8");
        var result = config.babel.transformSync(
            source, Object.assign({ filename: rel }, babelOptions));

        if (!result || typeof result.code !== "string") {
            fail("Babel produced no output for " + rel);
        }

        write(path.join(ctx.out, "amd", rel), result.code + "\n");
    });

    // --- 2. ESM: generate, patch, then overlay the hand-written files -------------------------
    // Dotfiles are tooling, not sources. src/main/esm carries its own .eslintrc.js — the AMD
    // tree's config rejects `import`/`export` outright — and without this filter it is picked up
    // as a hand-written module, shadowing nothing and shipped in the package. The override guard
    // below catches that, but a build failure is a poor way to learn that a config file is not a
    // source file.
    var handWritten = walk(ctx.esmSrc, function (f) {
        return f.endsWith(".js") && path.basename(f).charAt(0) !== ".";
    });

    handWritten.forEach(function (rel) {
        // Every hand-written override except an ESM-only helper must shadow a real AMD source
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

        var source = fs.readFileSync(path.join(ctx.jsSrc, rel), "utf8");
        var converted;

        try {
            converted = config.amdToEs6(source);
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

        var spec = (config.esmPatches || {})[rel];
        if (spec) { converted = applyEdits(rel, converted, spec, config.loaderRuntimeId); }

        write(path.join(ctx.out, "esm", rel), licenceHeader(source) + converted.trim() + "\n");
    });

    handWritten.forEach(function (rel) {
        var contents = fs.readFileSync(path.join(ctx.esmSrc, rel), "utf8");
        if (config.onHandWritten) { config.onHandWritten(rel, contents, { fail: fail }); }
        write(path.join(ctx.out, "esm", rel), contents);
    });

    assertNoLoaderApiSurvives(path.join(ctx.out, "esm"));

    // --- 3. www: the payload that has no module id -------------------------------------------
    walk(ctx.resSrc).forEach(function (rel) {
        fs.mkdirSync(path.dirname(path.join(ctx.out, "www", rel)), { recursive: true });
        fs.copyFileSync(path.join(ctx.resSrc, rel), path.join(ctx.out, "www", rel));
    });

    // --- 4. package.json ----------------------------------------------------------------------
    var emitted = {
        name: sourcePackage.name,
        version: sourcePackage.version,
        description: sourcePackage.description,
        license: sourcePackage.license,
        // Kept per design decision D18: phase 1 distributes these packages as Maven-attached
        // tarballs produced by `npm pack`, which honours "private"; only `npm publish` refuses.
        // Task 3.11 is what removes it, after the phase-1 gate.
        private: true,
        repository: sourcePackage.repository,
        "//exports": config.exportsNote,
        exports: config.exports,
        files: config.files,
        sideEffects: true,
        peerDependencies: sourcePackage.peerDependencies,
        peerDependenciesMeta: sourcePackage.peerDependenciesMeta
    };

    write(path.join(ctx.out, "package.json"), JSON.stringify(emitted, null, 2) + "\n");

    var docs = path.join(config.moduleRoot, "NPM-PACKAGE.md");
    if (fs.existsSync(docs)) {
        fs.copyFileSync(docs, path.join(ctx.out, "NPM-PACKAGE.md"));
    }

    emitLicence(ctx, emitted.license);

    /*
     * Node decides whether a .js file is an ES module or a script from the nearest package.json
     * "type", so without these two markers it reparses every generated module after failing to
     * read it as CommonJS, and warns on each one. They also state the difference between the two
     * trees in the one place a tool looks: ./esm is ES modules, ./amd is not. The root
     * package.json cannot carry either answer, because it would be wrong for the other tree.
     *
     * "sideEffects" is repeated in both markers rather than left to the root package.json.
     * A bundler reads the *nearest* description file, so a nested package.json that omits the
     * field shadows the root's answer with the default — which happens to be the same
     * conservative answer here, but by accident. Repeating it means the file that a bundler
     * actually consults says what these packages mean: these modules register handlers, extend
     * prototypes and populate registries on import, and tree-shaking them is not safe.
     */
    write(path.join(ctx.out, "esm", "package.json"),
        JSON.stringify({ type: "module", sideEffects: true }, null, 2) + "\n");
    write(path.join(ctx.out, "amd", "package.json"),
        JSON.stringify({ type: "commonjs", sideEffects: true }, null, 2) + "\n");

    // --- 5. manifest and payload assertions ---------------------------------------------------
    var isJs = function (f) { return f.endsWith(".js"); };
    var amdFiles = walk(path.join(ctx.out, "amd"), isJs);
    var esmFiles = walk(path.join(ctx.out, "esm"), isJs);
    var wwwFiles = walk(path.join(ctx.out, "www"));

    var counts = { amd: amdFiles.length, esm: esmFiles.length, www: wwwFiles.length,
        hand: handWritten.length };

    /*
     * Counts, checked first because the message is far easier to read than a long path diff when
     * a whole directory goes missing. They are a coarse net under the path record above, not a
     * substitute for it: dropping a directory produces a package that installs and builds
     * cleanly and breaks at run time.
     */
    Object.keys(config.expected).forEach(function (key) {
        if (counts[key] !== config.expected[key]) {
            fail(
                "payload count mismatch for '" + key + "': expected " + config.expected[key] +
                ", emitted " + counts[key] + ".\n" +
                "If this change is intended, update `expected` in build/npm-package.js and the\n" +
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
     * task 3.6's diff mean something. Its metadata entries (package.json, MANIFEST.txt,
     * NPM-PACKAGE.md, LICENSE.md and the two nested type markers) are listed rather than omitted,
     * so the diff starts empty instead of starting several lines behind.
     */
    // Placeholder first: MANIFEST.txt is itself a packed path, so it has to exist before the walk
    // that enumerates them, and its body is only knowable afterwards.
    write(path.join(ctx.out, "MANIFEST.txt"), "");

    var packed = packedPaths(ctx.out, emitted);

    write(path.join(ctx.out, "MANIFEST.txt"), [
        "# " + emitted.name + " payload manifest",
        "# The committed record from build/expected-payload.txt, which the shared emitter in",
        "# ui/build/npm-package-lib.js has asserted this tree against. Task 3.6 diffs the packed",
        "# tarball against this list.",
        "#",
        "# Sorted in code-unit order. Compare with `LC_ALL=C sort` on both sides — a bare `sort`",
        "# folds case and ignores the path separator, which turns an identical set into dozens of",
        "# lines of spurious diff. Measured on the 199-path ui-commons tree: identical sets,",
        "# 60+ lines of diff in the default locale, empty diff under LC_ALL=C.",
        "#",
        "# `npm pack` and `tar -tzf` prefix every entry with `package/`; this list does not.",
        "# Strip that prefix before diffing or the comparison starts every line apart.",
        "#",
        "# amd/ " + amdFiles.length + "   esm/ " + esmFiles.length + "   www/ " + wwwFiles.length +
            "   total packed " + packed.length,
        "# www/ by directory: " + Object.keys(byDir).sort().map(function (d) {
            return d + "=" + byDir[d];
        }).join(" "),
        ""
    ].concat(packed).join("\n") + "\n");

    assertPayloadMatchesRecord(ctx, packed);

    process.stdout.write(
        "[npm-package] " + emitted.name + "@" + emitted.version + " -> " +
        path.relative(ctx.moduleRoot, ctx.out) + "\n" +
        "[npm-package]   amd/ " + amdFiles.length + " files (transpiled, ids intact)\n" +
        "[npm-package]   esm/ " + esmFiles.length + " files (" + handWritten.length +
        " hand-written, " + (esmFiles.length - handWritten.length) + " generated)\n" +
        "[npm-package]   www/ " + wwwFiles.length + " files (" +
        Object.keys(byDir).sort().map(function (d) { return d + "=" + byDir[d]; }).join(" ") + ")\n"
    );
}

module.exports = { build: build, fail: fail, walk: walk };
