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
 * Verifies that the emitted ES module tree loads through the aliases NPM-PACKAGE.md prescribes,
 * and that the contract with the ui-commons peer is real. Run:  npm run verify:esm
 * ============================================================================================
 *
 * WHY THIS EXISTS SEPARATELY FROM build/npm-package.js
 *
 * That script asserts the *shape* of what it emitted — counts, paths, no surviving loader API.
 * Every one of those checks would pass on a tree that cannot resolve a single commons id, which
 * is this package's entire reason to exist: 9 of its 14 modules import them directly and all 12
 * under org/ reach them transitively. Only importing the tree finds that.
 *
 * WHAT THIS DOES NOT DO, AND WHY IT IS NOT PAPERED OVER
 *
 * Ten of the fourteen modules cannot be imported under bare Node, and the reason is Node rather
 * than anything in the emitted tree: commons' util/UIUtils assigns `$.fn.emptySelect` at module
 * scope (UIUtils.js:137), and jQuery 3 without a `window` carrying a `document` yields a factory
 * function with no `.fn` at all. Every module reaching commons' view layer inherits that.
 *
 * The fix is jsdom, and it belongs to task 3.5's CI job — not to a stub grown until the import
 * happens to succeed. ui-commons' own harness records the same rule for the same reason: a stub
 * that grows to imitate jQuery stops testing the code and starts testing the imitation. So the
 * four modules that genuinely need no DOM are imported for real, and the cross-package contract
 * the other ten depend on is asserted statically rather than pretended at.
 *
 * ONE MEASURED HAZARD, RECORDED BECAUSE IT COSTS AN HOUR TO REDISCOVER
 *
 * commons' main/Configuration silences the global console at module scope — `console.log`,
 * `.debug`, `.info`, `.error` and `.warn` are all replaced with no-ops unless the product's
 * config/AppConfiguration reports `loggerLevel === "debug"` (Configuration.js, right after the
 * imports). Importing anything that reaches Configuration therefore makes a harness written with
 * console.log go silent mid-run, with no error and exit code 0 — it looks exactly like a hang or
 * a crash. Two independent guards below: every line here is written with process.stdout.write,
 * and the AppConfiguration stub declares loggerLevel "debug".
 */

import assert from "node:assert/strict";
import module from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UI_ROOT = path.resolve(MODULE_ROOT, "..");
const ESM_ROOT = path.join(MODULE_ROOT, "target", "npm", "esm");
const AMD_ROOT = path.join(MODULE_ROOT, "target", "npm", "amd");
const WWW_ROOT = path.join(MODULE_ROOT, "target", "npm", "www");

const ID_PREFIX = "org/forgerock/commons/ui/user";
const COMMONS_PREFIX = "org/forgerock/commons/ui/common";

if (!fs.existsSync(ESM_ROOT)) {
    process.stderr.write(
        "\n[verify-esm] target/npm/esm does not exist. Run `npm run build:npm` first.\n\n"
    );
    process.exit(1);
}

/*
 * Where the ui-commons peer comes from.
 *
 * node_modules first, because that is how a consumer resolves it and how this will work once task
 * 3.11 publishes the package. The sibling module's emitted tree is the fallback, because inside
 * this reactor the peer is deliberately unresolvable — D18 distributes it as a Maven-attached
 * tarball and package.json marks it optional so npm can build a tree at all. Either way this is
 * the *emitted* commons tree, not its sources: the ids have to resolve against what ships.
 */
const COMMONS_CANDIDATES = [
    path.join(MODULE_ROOT, "node_modules", "@openidentityplatform", "ui-commons", "esm"),
    path.join(UI_ROOT, "commons", "target", "npm", "esm")
];
const COMMONS_ROOT = COMMONS_CANDIDATES.find((p) => fs.existsSync(p));

if (!COMMONS_ROOT) {
    process.stderr.write(
        "\n[verify-esm] cannot find the @openidentityplatform/ui-commons ES module build. Looked in:\n" +
        COMMONS_CANDIDATES.map((p) => "    " + p).join("\n") +
        "\n\nBuild the sibling module first:  (cd ../commons && npm run build:npm)\n\n"
    );
    process.exit(1);
}

const EMPTY_STUB = new URL("../../build/empty-module-stub.mjs", import.meta.url).href;

/*
 * The four ids this package imports that are neither peers nor commons. Listed explicitly rather
 * than pattern-matched, so a fifth appearing in the sources fails this run instead of being
 * absorbed silently — every entry is something a consumer is obliged to bind before ui-user runs.
 * NPM-PACKAGE.md has the table of what each must resolve to.
 */
const CONSUMER_SUPPLIED = ["KBADelegate", "form2js", "js2form"];

// Rebound by the product to a different package entirely (openam-ui-ria's require.config.map).
const REBOUND = ["underscore"];

const STUBS = Object.assign(
    { jquery: new URL("../../build/jquery-node-stub.mjs", import.meta.url).href },
    Object.fromEntries(CONSUMER_SUPPLIED.map((id) => [id, EMPTY_STUB])),
    // Bare side-effect import in profile/UserProfileView; nothing reads a value from it.
    { bootstrap: EMPTY_STUB },
    // ui-commons' own product-supplied ids, reached transitively through the peer. loggerLevel is
    // "debug" deliberately — see the console-silencing note in this file's header.
    {
        ThemeManager: EMPTY_STUB,
        NavigationFilter: EMPTY_STUB,
        "config/AppConfiguration": new URL("./app-configuration-stub.mjs", import.meta.url).href
    }
);

const ALIASES = { underscore: "lodash" };

/*
 * The two aliases NPM-PACKAGE.md tells an ES module consumer to configure — narrow, one per
 * package. A single broader `org/forgerock/commons` prefix pointed at either package breaks the
 * other; NOTES-dual-build.md section 2 case C measured that for RequireJS `paths`, and it is the
 * same shape here.
 */
module.register("../../build/esm-resolve-hooks.mjs", import.meta.url, {
    data: {
        prefixes: [
            { prefix: ID_PREFIX + "/", root: ESM_ROOT },
            { prefix: COMMONS_PREFIX + "/", root: COMMONS_ROOT }
        ],
        stubs: STUBS,
        aliases: ALIASES
    }
});

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

const load = (id) => import(pathToFileURL(path.join(ESM_ROOT, id + ".js")).href);

const stripComments = (code) => code.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (match, literal) => literal || ""
);

const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { return walk(full, base); }
    return full.endsWith(".js") && entry.name !== "package.json"
        ? [path.relative(base, full).split(path.sep).join("/")]
        : [];
});

/** Every specifier the emitted tree imports, including bare side-effect imports. */
const importedSpecifiers = () => {
    const found = new Set();
    for (const rel of walk(ESM_ROOT)) {
        const code = stripComments(fs.readFileSync(path.join(ESM_ROOT, rel), "utf8"));
        for (const m of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)) {
            found.add(m[1]);
        }
    }
    return found;
};

/*
 * 1. The tree imports for real, across the package boundary.
 *
 * delegates/KBADelegate is the right entry point for this package: it is the deepest module that
 * needs no DOM, and it reaches jquery, lodash and three separate ui-commons modules
 * (AbstractDelegate, Configuration, Constants). If either alias is wrong, or the peer's emitted
 * tree does not contain what this one imports, it fails here.
 */
check("the ES module tree imports across the ui-commons peer, through the documented aliases", async () => {
    const kbaDelegate = (await load(ID_PREFIX + "/delegates/KBADelegate")).default;

    assert.equal(typeof kbaDelegate.getInfo, "function",
        "KBADelegate should expose its own API");
    assert.ok(Object.getPrototypeOf(kbaDelegate),
        "and should be built on commons' AbstractDelegate prototype");
});

check("the DOM-free modules all import", async () => {
    // The two config leaves have no dependencies at all; the two delegates reach commons but not
    // its view layer. The other ten need jsdom — see this file's header.
    for (const id of [
        "config/messages/UserMessages",
        "config/routes/UserRoutesConfig",
        ID_PREFIX + "/delegates/AnonymousProcessDelegate",
        ID_PREFIX + "/delegates/KBADelegate"
    ]) {
        const loaded = await load(id);
        assert.ok(loaded.default, id + " should have a default export");
    }
});

check("the config leaves are the product's to compose, and stay dependency-free", async () => {
    // NPM-PACKAGE.md tells a consumer to bind these two individually rather than aliasing the
    // config/ prefix, which belongs to the product. That advice only holds while they are leaves.
    for (const id of ["config/messages/UserMessages", "config/routes/UserRoutesConfig"]) {
        const code = stripComments(fs.readFileSync(path.join(ESM_ROOT, id + ".js"), "utf8"));
        assert.doesNotMatch(code, /\bimport\b/,
            id + " has grown an import; NPM-PACKAGE.md describes it as a leaf");
    }

    const routes = (await load("config/routes/UserRoutesConfig")).default;
    assert.equal(routes.profile.view, "UserProfileView",
        "the profile route must name the logical view id the product rebinds, not a module path");
});

/*
 * 2. Nothing a consumer has to bind may go unrecorded.
 *
 * The package's whole consumer contract is "install these peers, bind these ids". If a source
 * change adds an import of something that is neither, a consumer finds out as a resolution
 * failure at build time with no clue what to supply, and the documentation goes quietly stale.
 */
check("every external import is a declared peer, a commons id, or a documented bound id", () => {
    const sourcePackage = JSON.parse(
        fs.readFileSync(path.join(MODULE_ROOT, "package.json"), "utf8"));
    const peers = Object.keys(sourcePackage.peerDependencies)
        .filter((p) => p !== "@openidentityplatform/ui-commons");

    const external = [...importedSpecifiers()].filter(
        (s) => !s.startsWith(ID_PREFIX + "/") && !s.startsWith(COMMONS_PREFIX + "/"));

    const accounted = new Set([...peers, ...REBOUND, ...CONSUMER_SUPPLIED]);
    const unaccounted = external.filter((s) => !accounted.has(s)).sort();

    assert.deepEqual(unaccounted, [],
        "these are imported but recorded nowhere — add a peer or a bound id, and say so in " +
        "NPM-PACKAGE.md");

    // And the reverse: a bound id nothing imports any more is a stale claim on the consumer.
    for (const id of [...CONSUMER_SUPPLIED, ...REBOUND]) {
        assert.ok(external.includes(id), "documented bound id no longer imported: " + id);
    }
    for (const peer of peers) {
        assert.ok(external.includes(peer), "declared peer no longer imported: " + peer);
    }
});

/*
 * 3. The peer contract, checked rather than declared.
 *
 * A version range says which ui-commons is acceptable; it cannot say that the modules this
 * package imports are in it. If commons renames or moves one, nothing in either build fails —
 * the consumer gets an unresolved import at *its* build time, naming a file it does not own.
 */
check("every commons id this package imports exists in the ui-commons build", () => {
    const commonsIds = [...importedSpecifiers()].filter((s) => s.startsWith(COMMONS_PREFIX + "/"));

    assert.ok(commonsIds.length > 0, "precondition: this package imports commons at all");

    const missing = commonsIds
        .filter((id) => !fs.existsSync(path.join(COMMONS_ROOT, id + ".js")))
        .sort();

    assert.deepEqual(missing, [],
        "imported from @openidentityplatform/ui-commons but absent from its emitted tree at " +
        COMMONS_ROOT);
});

check("the two packages do not collide on a single path", () => {
    // The reason two copy steps need no ordering, and the reason a consumer can overlay both into
    // one directory. If this ever fails, NPM-PACKAGE.md's "order does not matter" is wrong.
    const commonsWww = path.join(COMMONS_ROOT, "..", "www");
    // Not a skip. COMMONS_ROOT itself is hard-failed above if it is missing, and www/ is its
    // sibling in any correctly emitted ui-commons package, so its absence means the peer tree is
    // malformed rather than unavailable. Returning early here would report "ok" for a comparison
    // that never ran, which is exactly the shape of a check that cannot fail.
    assert.ok(fs.existsSync(commonsWww),
        "the ui-commons peer at " + COMMONS_ROOT + " has no sibling www/, so the two packages " +
        "cannot be compared for path collisions -- rebuild ui-commons");

    const listAll = (dir) => {
        const out = [];
        (function recurse (d) {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, e.name);
                if (e.isDirectory()) { recurse(full); }
                else if (e.name !== "package.json") {
                    out.push(path.relative(dir, full).split(path.sep).join("/"));
                }
            }
        }(dir));
        return out;
    };

    const ours = new Set([...listAll(ESM_ROOT), ...listAll(WWW_ROOT)]);
    const theirs = [...listAll(COMMONS_ROOT), ...listAll(commonsWww)];
    const collisions = theirs.filter((p) => ours.has(p)).sort();

    assert.deepEqual(collisions, [],
        "ui-commons and ui-user now write the same path, so overlay order decides which wins");
});

/*
 * 4. The product override paths, verbatim.
 *
 * openam-ui-ria overrides five of this module's files through the last-wins composition overlay,
 * matched by path and by nothing else. Rename or relocate one and AM's override silently stops
 * winning: the build passes, the package installs, and nothing fails until a user opens their
 * profile. build/expected-payload.txt catches a rename in general; this names the five that are
 * known to be load-bearing, so the failure message says why it matters.
 */
check("the paths openam-ui-ria overrides are present, unmoved and unrenamed", () => {
    const overridden = [
        "templates/user/UserProfileTemplate.html",
        "templates/user/process/registration/userDetails-initial.html",
        "templates/user/process/reset/resetStage-initial.html",
        "templates/user/process/reset/userQuery-initial.html",
        "locales/en/translation.json"
    ];

    const missing = overridden.filter((rel) => !fs.existsSync(path.join(WWW_ROOT, rel)));

    assert.deepEqual(missing, [],
        "openam-ui-ria overrides these by path through the last-wins overlay. Moving or renaming " +
        "one does not fail any build — it silently stops AM's override from winning, and surfaces " +
        "when a user opens their profile.");
});

/*
 * 5. The two builds are the same modules.
 *
 * D19 keeps one id space across both, which is what lets a consumer reason about them
 * interchangeably and what task 3.4 sets out to prove behaviourally. This is the cheap structural
 * half: the same ids, present in both trees.
 */
check("the AMD and ES module builds expose exactly the same module ids", () => {
    const amd = walk(AMD_ROOT).sort();
    const esm = walk(ESM_ROOT).sort();

    assert.deepEqual(esm, amd,
        "the two trees have diverged; every AMD module must have an ES module counterpart at the " +
        "same id, and nothing may appear in one alone");
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
    " checks passed\n" +
    "[verify-esm] ui-commons peer resolved from: " + COMMONS_ROOT + "\n" +
    "[verify-esm] stubbed for Node: " + Object.keys(STUBS).sort().join(", ") + "\n" +
    "[verify-esm] 10 of 14 modules need a DOM to import and are not imported here — see the " +
    "header; task 3.5 owns that\n");

if (failed) {
    process.stderr.write(
        "\n[verify-esm] The emitted ES module build is broken. This runs against target/npm/esm,\n" +
        "so rebuild with `npm run build:npm` before assuming the source is at fault.\n\n"
    );
    process.exit(1);
}
