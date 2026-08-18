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
 * Runs the commons suite against the EMITTED ES module build.  Run:  npm run test:esm
 * ============================================================================================
 *
 * Task 3.5. The point of this file is the alias block below, so read that first: the suite under
 * src/test/vitest resolves every commons module id to target/npm/esm — the tree `npm run
 * build:npm` emits — and never to src/main/js. A green run is therefore evidence about the build
 * the package ships, not about the sources it was generated from. Point the alias at src/main/js
 * and this suite still passes while saying nothing at all about the ES module build; that is the
 * one change to this file that would quietly destroy its purpose.
 *
 * WHY THIS SUITE EXISTS BESIDE src/test/qunit RATHER THAN REPLACING IT
 *
 * The two builds need exercising by the same assertions or they diverge unobserved, which is what
 * the requirement this task implements says in as many words. But there is no one runner that can
 * do it: the AMD build is loaded by RequireJS out of a flat composition directory and is tested
 * through commons/ui/mock's Grunt build under headless Chrome, and nothing in that harness can
 * load an ES module. So the assertions are stated twice, in two frameworks, over two builds:
 *
 *     src/test/qunit    QUnit, RequireJS, headless Chrome  ->  target/npm/amd  (via ui/mock)
 *     src/test/vitest   Vitest, jsdom                      ->  target/npm/esm  (this file)
 *
 * That duplication is the cost of the dual build and it is a real one — two copies of an
 * assertion drift. It is bounded deliberately: the ports are transcriptions, kept in the same
 * order, with the same test names, and each carries a header naming its QUnit original. When a
 * commons behaviour changes, both files change or the CI job that runs them together goes red on
 * one side only, which is exactly the signal that is wanted.
 *
 * The QUnit files are NOT edited to suit this suite. They are the AMD build's tests and they run
 * under a loader this one cannot reach.
 *
 * WHAT IS NOT PORTED, AND WHY
 *
 * src/test/qunit/form2js.js has no counterpart here. It imports `form2js` and `js2form` and
 * nothing else — it exercises maxatwork/form2js, not a single line of commons — and those two
 * are the ids LIBS-INVENTORY.md section 6 records as having no npm package in existence, pinned
 * git-commit files delivered only as commons.ui.libs Maven artefacts. There is nothing in the ES
 * module build for a port of it to test, and wiring it up would couple `npm run test:esm` to a
 * directory only a Maven build produces. So the ESM suite is 9 files to QUnit's 10, and that gap
 * is a stated limit of this task rather than an oversight.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const MODULE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const ESM_ROOT = path.join(MODULE_ROOT, "target", "npm", "esm");
const ID_PREFIX = "org/forgerock/commons/ui/common";

/*
 * Fail loudly rather than fall through to a resolution error 40 lines into a stack trace. The
 * emitted tree is a build output under target/, so a fresh clone has no such directory and this
 * is the single most likely way to run this suite wrong.
 */
if (!fs.existsSync(ESM_ROOT)) {
    throw new Error(
        "target/npm/esm does not exist. Run `npm run build:npm` before `npm run test:esm`."
    );
}

/*
 * The stub for identifiers the consuming PRODUCT owns and this package deliberately does not
 * contain. Shared with build/verify-esm.mjs so both harnesses stand in for a consumer the same
 * way; see the header of ../build/empty-module-stub.mjs for what reaches it.
 */
const PRODUCT_STUB = path.resolve(MODULE_ROOT, "..", "build", "empty-module-stub.mjs");
const PRODUCT_SUPPLIED = ["ThemeManager", "NavigationFilter", "config/AppConfiguration"];

export default defineConfig({
    resolve: {
        /*
         * An ARRAY, not an object, because order decides and the narrow entries have to be able
         * to win. Vite applies these in order and takes the first match.
         *
         * Entry 1 is the whole point of the file: it is the same prefix-plus-".js" substitution
         * that ../build/esm-resolve-hooks.mjs performs for `npm run verify:esm` under bare Node,
         * and the same one NPM-PACKAGE.md tells an ES module consumer to configure. Vite appends
         * the extension itself through resolve.extensions, so the replacement is a directory.
         *
         * Entry 2 is not test scaffolding. `underscore` is imported by 25 commons modules and is
         * a dependency of none: openam-ui-ria rebinds it to lodash in require.config.map and an
         * ES module consumer must supply the same alias. Doing it here means a passing run is
         * evidence that the documented rebinding is sufficient.
         *
         * Entries 3-5 are the three ids the consuming product owns. Listed explicitly rather than
         * pattern-matched, so a fourth appearing in the sources fails this run instead of being
         * absorbed silently — the same rule build/verify-esm.mjs applies for the same reason.
         */
        alias: [
            { find: new RegExp("^" + ID_PREFIX + "/"), replacement: ESM_ROOT + "/" + ID_PREFIX + "/" },
            { find: /^underscore$/, replacement: "lodash" },
            ...PRODUCT_SUPPLIED.map((id) => ({ find: new RegExp("^" + id + "$"), replacement: PRODUCT_STUB }))
        ]
    },
    test: {
        /*
         * jsdom rather than node: over half of these suites are jQuery-driven — event binding,
         * `$._data`, form fields, Handlebars output parsed back through `$()` — and the QUnit
         * originals run in a real browser. A node environment would force those assertions to be
         * rewritten into something weaker, which is the opposite of the point.
         */
        environment: "jsdom",
        include: ["src/test/vitest/**/*.test.mjs"],
        /*
         * The bindings a consumer of the ES module build has to make before importing
         * commons — currently one, `Backbone.$`. Read that file: it is a contract, not a
         * fixture, and it is where the difference between the two builds actually lives.
         */
        setupFiles: ["src/test/vitest/consumer-bindings.mjs"],
        /*
         * The emitted tree is ordinary ES modules and needs no transform, but it lives under
         * target/, which Vite treats as outside the project's source scope; inlining it keeps it
         * on the same module graph as the tests that import it.
         */
        server: {
            deps: {
                inline: [/target[\\/]npm[\\/]esm[\\/]/]
            }
        }
    }
});
