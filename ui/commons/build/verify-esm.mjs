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
 * Verifies that the emitted ES module tree actually loads, and that the LoaderRuntime seam
 * honours its contract.  Run:  npm run verify:esm    (after npm run build:npm)
 * ============================================================================================
 *
 * WHY THIS EXISTS SEPARATELY FROM build/npm-package.js
 *
 * That script asserts the *shape* of what it emitted — counts, paths, no surviving loader API,
 * main.js in step with its AMD original. Every one of those checks passed on a tree whose single
 * most important function was broken: `loadModule` tested only `__esModule` to decide whether it
 * held a module record, which is a marker Babel and webpack stamp on transpiled CommonJS and
 * which a *native* ES module namespace does not carry. So every one of the 20 ModuleLoader.load
 * call sites got the namespace object instead of the module, and `ViewManager.changeView` would
 * have thrown "Unable to determine view type" on every route. Nothing that inspects text could
 * have caught it. Only importing the tree and calling the function does.
 *
 * The assertions below are therefore not a general test suite — task 3.5 owns the real one, run
 * against both builds in CI. They are the specific things that have already been wrong once, or
 * that cannot be checked any other way, pinned so they cannot regress quietly.
 */

import assert from "node:assert/strict";
import module from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ESM_ROOT = path.join(MODULE_ROOT, "target", "npm", "esm");
const ID_PREFIX = "org/forgerock/commons/ui/common";

if (!fs.existsSync(ESM_ROOT)) {
    process.stderr.write(
        "\n[verify-esm] target/npm/esm does not exist. Run `npm run build:npm` first.\n\n"
    );
    process.exit(1);
}

const PRODUCT_STUB = new URL("../../build/empty-module-stub.mjs", import.meta.url).href;

/*
 * The three ids the consuming product owns. Listed explicitly rather than pattern-matched, so
 * that a fourth one appearing in the sources fails this run instead of being absorbed silently —
 * every entry here is something a consumer is obliged to bind before commons will load.
 */
const PRODUCT_SUPPLIED = ["ThemeManager", "NavigationFilter", "config/AppConfiguration"];

const STUBS = Object.assign(
    { jquery: new URL("../../build/jquery-node-stub.mjs", import.meta.url).href },
    Object.fromEntries(PRODUCT_SUPPLIED.map((id) => [id, PRODUCT_STUB]))
);

// The identifiers the consuming product rebinds, exactly as NPM-PACKAGE.md says it must.
const ALIASES = {
    underscore: "lodash"
};

module.register("../../build/esm-resolve-hooks.mjs", import.meta.url, {
    data: {
        prefixes: [{ prefix: ID_PREFIX + "/", root: ESM_ROOT }],
        stubs: STUBS,
        aliases: ALIASES
    }
});

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

const load = (id) => import(pathToFileURL(path.join(ESM_ROOT, id + ".js")).href);

/*
 * 1. The tree imports at all.
 *
 * ModuleLoader is the right entry point: it is the module every runtime view lookup goes through,
 * it imports the seam, and it imports a real peer dependency (jquery), so a broken specifier
 * anywhere along that chain surfaces here.
 */
check("the ES module tree imports, through the documented alias", async () => {
    const moduleLoader = await load(ID_PREFIX + "/util/ModuleLoader");
    assert.equal(typeof moduleLoader.default.load, "function", "ModuleLoader.load should exist");
});

/*
 * 1b. Nothing a consumer has to bind may go unrecorded.
 *
 * The package's whole consumer contract is "install these peers, rebind these ids". If a source
 * change adds an import of something that is neither, a consumer finds out as a resolution
 * failure at build time with no clue what to supply — and the documentation goes quietly stale.
 * This derives the real answer from the emitted tree and compares it to what package.json claims,
 * so the two cannot drift apart.
 */
check("every external import is a declared peer, a documented rename, or product-supplied", () => {
    const sourcePackage = JSON.parse(
        fs.readFileSync(path.join(MODULE_ROOT, "package.json"), "utf8")
    );
    const peers = Object.keys(sourcePackage.peerDependencies);

    // The five ids commons imports under a different name from the npm package that provides
    // them. A consumer aliases these; they are not extra dependencies.
    const RENAMES = {
        "backgrid-selectall": "backgrid-select-all",
        "backgrid.paginator": "backgrid-paginator",
        "bootstrap-dialog": "bootstrap3-dialog",
        placeholder: "jquery-placeholder",
        spin: "spin.js"
    };

    // Rebound to a different package entirely by the product (require.config.map).
    const REBOUND = ["underscore"];

    const stripComments = (code) => code.replace(
        /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
        (match, literal) => literal || ""
    );

    const found = new Set();
    (function collect (dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { collect(full); continue; }
            if (!full.endsWith(".js")) { continue; }

            const code = stripComments(fs.readFileSync(full, "utf8"));
            for (const m of code.matchAll(/(?:from|import\s*\()\s*["']([^"']+)["']/g)) {
                if (!m[1].startsWith(ID_PREFIX + "/")) { found.add(m[1]); }
            }
        }
    }(ESM_ROOT));

    const accounted = new Set([
        ...peers, ...Object.keys(RENAMES), ...REBOUND, ...PRODUCT_SUPPLIED
    ]);
    const unaccounted = [...found].filter((s) => !accounted.has(s)).sort();

    assert.deepEqual(unaccounted, [],
        "these are imported but recorded nowhere — add a peer, a rename or a product id, and " +
        "say so in NPM-PACKAGE.md");

    // And the reverse: a rename that no longer names a real peer is a stale claim.
    for (const [spelling, pkg] of Object.entries(RENAMES)) {
        assert.ok(found.has(spelling), "documented rename no longer imported: " + spelling);
        assert.ok(peers.includes(pkg), "rename target is not a declared peer: " + pkg);
    }

    for (const id of PRODUCT_SUPPLIED) {
        assert.ok(found.has(id), "product-supplied id no longer imported: " + id);
    }
});

/*
 * 2-4. The unwrap. Three shapes reach `resolveModule`'s caller and all three have to come back as
 * the module's own value, because ModuleLoader hands the result straight to callers that index
 * into it — AbstractConfigurationAware `_.extend(configuration[key], loaded)` and
 * ProcessConfiguration `_.flatten(_.toArray(arguments))` among them.
 */
check("a native ES module namespace unwraps to its default export", async () => {
    const { configure, loadModule } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");
    const namespace = await load(ID_PREFIX + "/util/Base64");

    assert.equal(namespace.__esModule, undefined, "precondition: no __esModule on a namespace");
    assert.equal(namespace[Symbol.toStringTag], "Module", "precondition: it is a namespace");

    configure({ resolveModule: () => namespace });
    const loaded = await loadModule(ID_PREFIX + "/util/Base64");

    assert.equal(loaded, namespace.default, "should be the default export, not the namespace");
    assert.equal(typeof loaded.encodeUTF8, "function", "and should be usable");
});

check("a Babel/webpack interop object unwraps to its default export", async () => {
    const { configure, loadModule } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");
    const interop = { __esModule: true, default: { render: () => "view" } };

    configure({ resolveModule: () => interop });
    assert.equal(await loadModule("anything"), interop.default);
});

check("a plain value passes through untouched", async () => {
    const { configure, loadModule } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");
    const plain = { render: () => "view" };

    configure({ resolveModule: () => plain });
    assert.equal(await loadModule("anything"), plain);
});

/*
 * 5-7. Failure has to be legible. A registry that does not cover an id is the likeliest thing to
 * go wrong in a consumer's wiring, and commons asks for three ids no glob of its source tree
 * matches. Resolving with `undefined` would put the failure somewhere unrelated with the id gone.
 */
check("an id the resolver does not cover rejects, naming the id", async () => {
    const { configure, loadModule } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");

    configure({ resolveModule: () => undefined });
    await assert.rejects(loadModule("bootstrap"), (e) => {
        assert.match(e.message, /bootstrap/, "the message must name the id that was missing");
        return true;
    });
});

check("a resolver that throws synchronously rejects rather than throwing", async () => {
    const { configure, loadModule } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");

    configure({ resolveModule: () => { throw new TypeError("glob miss"); } });

    // The call itself must not throw — indexing into an import.meta.glob map that has no entry
    // is a synchronous TypeError, and loadModule is documented to return a Promise.
    const returned = loadModule("missing");
    assert.ok(returned instanceof Promise, "loadModule must return a Promise, never throw");
    await assert.rejects(returned, TypeError);
});

check("no resolver configured rejects with an actionable message", async () => {
    const { configure, loadModule } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");

    configure({ resolveModule: null });
    await assert.rejects(loadModule("x"), /resolveModule/);
});

/*
 * 8-11. toUrl. Both call sites it replaces resolve URLs the deployed product cache-busts today
 * via RequireJS's urlArgs, so the seam has to be able to express that (design decision D4).
 */
check("toUrl resolves against baseUrl and appends urlArgs", async () => {
    const { configure, toUrl } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");

    configure({ baseUrl: "/XUI", urlArgs: "v=14.0.0", resolveUrl: null });
    assert.equal(toUrl("templates/common/404.html"), "/XUI/templates/common/404.html?v=14.0.0");

    configure({ urlArgs: null });
    assert.equal(toUrl("/templates/x.html"), "/XUI/templates/x.html", "leading slash not doubled");
});

check("toUrl appends urlArgs with & when the path already has a query", async () => {
    const { configure, toUrl } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");

    configure({ baseUrl: "/XUI/", urlArgs: "v=1", resolveUrl: null });
    assert.equal(toUrl("locales/en/x.json?a=b"), "/XUI/locales/en/x.json?a=b&v=1");
});

check("urlArgs may be a function, as RequireJS allows", async () => {
    const { configure, toUrl } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");

    configure({ baseUrl: "/XUI/", urlArgs: (p) => "from=" + p.length, resolveUrl: null });
    assert.equal(toUrl("a.html"), "/XUI/a.html?from=6");
});

check("resolveUrl replaces toUrl's own resolution entirely", async () => {
    const { configure, toUrl } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");

    configure({ baseUrl: "/XUI/", urlArgs: "v=1", resolveUrl: (p) => "https://cdn/" + p });
    assert.equal(toUrl("a.html"), "https://cdn/a.html", "the override wins over base and args");

    configure({ resolveUrl: null });
});

/*
 * 12. moduleConfig. i18nManager reads `.i18nLoad` straight off the result, so this must never be
 * able to hand back something that cannot be indexed.
 */
check("moduleConfig never returns null", async () => {
    const { configure, moduleConfig } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");

    configure({ moduleConfig: null });
    assert.deepEqual(moduleConfig(), {}, "null must be treated as none, not as the value");

    configure({ moduleConfig: { i18nLoad: "current" } });
    assert.equal(moduleConfig().i18nLoad, "current");
});

/*
 * 13. The one other place that unwraps a dynamic import. ViewManager lazily imports
 * ReactAdapterView by literal id; its patched form has to parse, resolve the seam, and use the
 * same unwrap rather than a second spelling of it.
 */
check("ViewManager's lazy React adapter unwrap goes through the seam", () => {
    const source = fs.readFileSync(path.join(ESM_ROOT, ID_PREFIX + "/main/ViewManager.js"), "utf8");

    assert.match(source, /import\("org\/forgerock\/commons\/ui\/common\/main\/ReactAdapterView"\)/,
        "the literal-id require([...]) should have become a traceable dynamic import()");
    assert.match(source, /loaderRuntime\.unwrapModule\(/,
        "the unwrap must go through the seam, not be rewritten inline");
    assert.doesNotMatch(source, /__reactAdapterModule\.default \|\|/,
        "the inline `mod.default || mod` idiom should be gone");

    /*
     * Asserted on the source rather than by importing it, and the reason is worth recording for
     * task 3.5 rather than working around here. ViewManager reaches components/Messages, which
     * instantiates a Backbone View at *module scope* (Messages.js:126). Backbone's setElement
     * does `element instanceof $`, so it needs a real jQuery bound to a real document —
     * measured: "Right-hand side of 'instanceof' is not an object" with the stub in place.
     *
     * That is Node lacking a DOM, not a defect in the emitted tree. The fix is jsdom, which is
     * a test-environment decision belonging to task 3.5's CI job, not a stub grown until the
     * import happens to succeed — a stub that imitates jQuery well enough to satisfy Backbone
     * is testing the imitation. The seam itself is covered end to end by the ModuleLoader check
     * below, which needs no DOM.
     */
});

check("unwrapModule is exported and reduces all three shapes", async () => {
    const { unwrapModule } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");
    const namespace = await load(ID_PREFIX + "/util/Base64");
    const plain = { render: () => "view" };

    assert.equal(unwrapModule(namespace), namespace.default, "native namespace");
    assert.equal(unwrapModule({ __esModule: true, default: plain }), plain, "Babel interop");
    assert.equal(unwrapModule(plain), plain, "plain value");
});

/*
 * 15. End to end through the real ModuleLoader, which is what the 20 call sites actually use.
 */
check("ModuleLoader.load returns the unwrapped module through the seam", async () => {
    const { configure } = await load(ID_PREFIX + "/util/esm/LoaderRuntime");
    const moduleLoader = (await load(ID_PREFIX + "/util/ModuleLoader")).default;
    const registry = { [ID_PREFIX + "/util/Base64"]: await load(ID_PREFIX + "/util/Base64") };

    configure({ resolveModule: (id) => registry[id] });

    const base64 = await moduleLoader.load(ID_PREFIX + "/util/Base64");
    assert.equal(typeof base64.encodeUTF8, "function", "callers get the module, not a namespace");
    assert.equal(base64.decodeUTF8(base64.encodeUTF8("hello")), "hello", "and it works");
});

// ---------------------------------------------------------------------------------------------

let failed = 0;

for (const { name, fn } of checks) {
    try {
        await fn();
        process.stdout.write("  ok    " + name + "\n");
    } catch (e) {
        failed += 1;
        process.stdout.write("  FAIL  " + name + "\n        " +
            String(e && e.message).split("\n").join("\n        ") + "\n");
    }
}

process.stdout.write("\n[verify-esm] " + (checks.length - failed) + "/" + checks.length +
    " checks passed (stubbed for Node: " + Object.keys(STUBS).join(", ") + ")\n");

if (failed) {
    process.stderr.write(
        "\n[verify-esm] The emitted ES module build is broken. This runs against target/npm/esm,\n" +
        "so rebuild with `npm run build:npm` before assuming the source is at fault.\n\n"
    );
    process.exit(1);
}
