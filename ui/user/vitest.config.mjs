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
 * Imports the emitted ES module build under a DOM.  Run:  npm run test:esm
 * ============================================================================================
 *
 * Task 3.5, closing something task 3.3 left named rather than done. build/verify-esm.mjs's own
 * header says it:
 *
 *     "Ten of the fourteen modules cannot be imported under bare Node ... The fix is jsdom, and
 *      it belongs to task 3.5's CI job — not to a stub grown until the import happens to
 *      succeed."
 *
 * and its final line prints "10 of 14 modules need a DOM to import and are not imported here —
 * see the header; task 3.5 owns that" on every run. This is that.
 *
 * WHAT THIS IS NOT. It is not a behavioural test suite, and it must not be mistaken for one.
 * ui-user has no behavioural tests on either build: its single QUnit file,
 * src/test/qunit/AnonymousProcessView.js, is commented out of ui/mock's test list and therefore
 * runs against the AMD build no more than against this one. Writing one is not this task's, and
 * pretending an import check is one would be worse than the gap.
 *
 * The alias block is the same two-prefix configuration NPM-PACKAGE.md tells a consumer to
 * configure and build/verify-esm.mjs registers as Node resolve hooks — one prefix per package,
 * narrow, because a single broader `org/forgerock/commons` prefix pointed at either package
 * breaks the other (NOTES-dual-build.md section 2 case C measured that shape for RequireJS
 * `paths`).
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const MODULE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const UI_ROOT = path.resolve(MODULE_ROOT, "..");
const ESM_ROOT = path.join(MODULE_ROOT, "target", "npm", "esm");

const ID_PREFIX = "org/forgerock/commons/ui/user";
const COMMONS_PREFIX = "org/forgerock/commons/ui/common";

if (!fs.existsSync(ESM_ROOT)) {
    throw new Error(
        "target/npm/esm does not exist. Run `npm run build:npm` before `npm run test:esm`."
    );
}

/*
 * Where the ui-commons peer comes from — the same two candidates, in the same order and for the
 * same reasons, as build/verify-esm.mjs. node_modules first because that is how a consumer will
 * resolve it once task 3.11 publishes the package; the sibling module's emitted tree as the
 * fallback, because inside this reactor the peer is deliberately unresolvable. Either way it is
 * the EMITTED commons tree and never its sources: the ids have to resolve against what ships.
 */
const COMMONS_CANDIDATES = [
    path.join(MODULE_ROOT, "node_modules", "@openidentityplatform", "ui-commons", "esm"),
    path.join(UI_ROOT, "commons", "target", "npm", "esm")
];
const COMMONS_ROOT = COMMONS_CANDIDATES.find((p) => fs.existsSync(p));

if (!COMMONS_ROOT) {
    throw new Error(
        "cannot find the @openidentityplatform/ui-commons ES module build. Looked in:\n" +
        COMMONS_CANDIDATES.map((p) => "    " + p).join("\n") +
        "\n\nBuild the sibling module first:  (cd ../commons && npm run build:npm)"
    );
}

const EMPTY_STUB = path.resolve(UI_ROOT, "build", "empty-module-stub.mjs");
const APP_CONFIGURATION_STUB = path.resolve(MODULE_ROOT, "build", "app-configuration-stub.mjs");

/*
 * The ids this package imports that are neither peers nor commons, plus commons' own
 * product-supplied ones reached transitively through the peer. Listed explicitly rather than
 * pattern-matched, so a new one appearing in the sources fails this run instead of being absorbed
 * silently — build/verify-esm.mjs keeps the same list for the same reason, and NPM-PACKAGE.md has
 * the table of what a consumer must bind each to.
 *
 * config/AppConfiguration gets its own stub rather than the empty one, and that is load-bearing:
 * commons' main/Configuration replaces console.log, .debug, .info, .error and .warn with no-ops
 * at module scope unless the product's config reports loggerLevel "debug". The stub reports it.
 * Without that, a failure in here reports itself to a console that has been silenced.
 */
const CONSUMER_SUPPLIED = ["KBADelegate", "form2js", "js2form", "bootstrap", "ThemeManager", "NavigationFilter"];

/*
 * ONE COPY OF EVERY SHARED LIBRARY, and this is a correctness requirement rather than a tidiness
 * one.
 *
 * This module's node_modules and ui-commons' are two separate trees, so `import $ from "jquery"`
 * resolves differently depending on which package's file is asking: ui-user's modules would get
 * this module's jQuery and ui-commons' modules the sibling's. That is precisely the hazard
 * package.json's //peerDependencies note describes — "two plugin registries and failing
 * instanceof checks across the commons/product boundary, not a subtle version skew" — and it
 * would be *invented by the harness*, because a real consumer installs both packages into one
 * flat node_modules and every peer resolves once. Concretely: commons' util/UIUtils assigns
 * `$.fn.emptySelect`, and a ui-user view holding a different jQuery would not have it.
 *
 * ui-commons' node_modules is the one to resolve from because it declares the full peer set at
 * the pinned versions; this module declares five. Anything unresolvable there — `bootstrap` is,
 * and is stubbed above — falls through to normal resolution and shows up as a resolution error
 * rather than as a second copy.
 */
const requireFromCommons = createRequire(path.join(COMMONS_ROOT, "resolve-from-here.js"));
const readPeers = (dir) =>
    Object.keys(JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).peerDependencies || {});
const SHARED_PEERS = [...new Set([...readPeers(MODULE_ROOT), ...readPeers(path.join(UI_ROOT, "commons"))])]
    .filter((id) => !id.startsWith("@openidentityplatform/") && !CONSUMER_SUPPLIED.includes(id))
    .map((id) => {
        try {
            return { find: new RegExp("^" + id.replace(/[.]/g, "\\.") + "$"), replacement: requireFromCommons.resolve(id) };
        } catch {
            return null;
        }
    })
    .filter(Boolean);

export default defineConfig({
    resolve: {
        alias: [
            { find: new RegExp("^" + ID_PREFIX + "/"), replacement: ESM_ROOT + "/" + ID_PREFIX + "/" },
            { find: new RegExp("^" + COMMONS_PREFIX + "/"), replacement: COMMONS_ROOT + "/" + COMMONS_PREFIX + "/" },
            { find: /^config\/AppConfiguration$/, replacement: APP_CONFIGURATION_STUB },
            { find: /^underscore$/, replacement: "lodash" },
            ...CONSUMER_SUPPLIED.map((id) => ({ find: new RegExp("^" + id + "$"), replacement: EMPTY_STUB })),
            ...SHARED_PEERS
        ]
    },
    test: {
        environment: "jsdom",
        include: ["src/test/vitest/**/*.test.mjs"],
        setupFiles: ["src/test/vitest/consumer-bindings.mjs"],
        server: {
            deps: {
                inline: [/target[\\/]npm[\\/]esm[\\/]/]
            }
        }
    }
});
