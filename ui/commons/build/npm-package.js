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
 * Emits @openidentityplatform/ui-commons into target/npm.
 * ============================================================================================
 *
 * The emit itself lives in ../../build/npm-package-lib.js, shared with ui/user — read that file
 * for how the two trees are produced, why the AMD build is deliberately absent from "exports",
 * and what the payload record is for. This file is the part that is only true of commons.
 *
 * The toolchain is resolved here rather than in the shared library on purpose: `require` resolves
 * from the requiring file's location, so a bare require inside ui/build would look in
 * ui/build/node_modules and never find this module's dependencies. Passing them in keeps each
 * module's own node_modules authoritative and makes the dependency visible in the module that
 * declares it.
 */

"use strict";

var path = require("path");
var babel = require("@babel/core");
var amdToEs6 = require("@buxlabs/amd-to-es6");
var emitter = require("../../build/npm-package-lib.js");

var MODULE_ROOT = path.resolve(__dirname, "..");
var ID_PREFIX = "org/forgerock/commons/ui/common";
var LOADER_RUNTIME_ID = ID_PREFIX + "/util/esm/LoaderRuntime";

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

/**
 * The hand-written ESM main.js restates the AMD original's dependency array as imports. Nothing
 * links the two, so this compares them and fails on divergence.
 */
function assertMainInSync (esmMain, ctx) {
    var fs = require("fs");
    var amdSource = fs.readFileSync(
        path.join(MODULE_ROOT, "src", "main", "js", ID_PREFIX + "/main.js"), "utf8");
    var depBlock = amdSource.match(/define\(\s*"[^"]+"\s*,\s*\[([\s\S]*?)\]/);

    if (!depBlock) {
        ctx.fail("could not read the dependency array from the AMD " + ID_PREFIX + "/main.js");
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
        ctx.fail(
            "src/main/esm/" + ID_PREFIX + "/main.js is out of step with the AMD original:\n" +
            (missing.length ? "  missing imports: " + missing.join(", ") + "\n" : "") +
            (extra.length ? "  imports not in the AMD source: " + extra.join(", ") + "\n" : "") +
            "\nmain.js is hand-written because the generator throws on it; it has to be updated\n" +
            "by hand when the AMD dependency array changes."
        );
    }
}

emitter.build({
    moduleRoot: MODULE_ROOT,
    idPrefix: ID_PREFIX,
    babel: babel,
    amdToEs6: amdToEs6,
    esmPatches: ESM_PATCHES,
    loaderRuntimeId: LOADER_RUNTIME_ID,

    /*
     * 60 org/** + 5 config/** AMD modules; the same 65 as ES modules plus the ESM-only
     * LoaderRuntime helper; 36 less + 14 templates + 1 partial + 9 images + 1 json + favicon.ico
     * + oauthReturn.html as www. These are the counts recorded in ui/NOTES-dual-build.md §1.
     */
    expected: { amd: 65, esm: 66, www: 63, hand: 2 },

    exportsNote: "The AMD build under ./amd is deliberately absent from \"exports\". " +
        "RequireJS and r.js resolve by file path and never read package.json — see the " +
        "header of ui/build/npm-package-lib.js and NOTES-dual-build.md section 2. An AMD " +
        "consumer uses a narrow RequireJS paths entry or a copy step. Note that \"exports\" " +
        "does not resolve the ES module tree's own internal specifiers either: those are bare, " +
        "extensionless commons ids, which an ESM consumer serves with one alias entry. " +
        "NPM-PACKAGE.md has both routes.",
    exports: {
        ".": "./esm/" + ID_PREFIX + "/main.js",
        "./esm/*": "./esm/*",
        "./www/*": "./www/*",
        "./package.json": "./package.json"
    },
    files: ["amd", "esm", "www", "LICENSE.md", "MANIFEST.txt", "NPM-PACKAGE.md"],

    onHandWritten: function (rel, contents, ctx) {
        if (rel === ID_PREFIX + "/main.js") { assertMainInSync(contents, ctx); }
    }
});
