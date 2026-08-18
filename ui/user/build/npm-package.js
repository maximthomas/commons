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
 * Emits @openidentityplatform/ui-user into target/npm.
 * ============================================================================================
 *
 * The emit itself lives in ../../build/npm-package-lib.js, shared with ui/commons — read that
 * file for how the two trees are produced, why the AMD build is deliberately absent from
 * "exports", and what the payload record is for. This file is the part that is only true of user.
 *
 * WHAT IS DIFFERENT HERE, AND WHY THERE IS SO LITTLE OF IT
 *
 * ui/commons needs four ES module patches, two hand-written modules and a LoaderRuntime seam,
 * because its sources use RequireJS APIs that have no ES module equivalent. This module needs
 * none of that, and that is a measured property of its 14 sources rather than an assumption:
 *
 *     named define("id", ...)      0     (commons has 2, which pin its id space)
 *     ./-relative dependencies     0     (commons has 2 files with them)
 *     require.toUrl / require([ ]) 0
 *     module.config()              0
 *
 * So every file converts cleanly, `esmPatches` is empty, and there is no src/main/esm tree. The
 * shared emitter still runs absolutiseImports and the surviving-loader-API check over the output;
 * both are no-ops today and are exactly what should fail if one of those zeroes stops being zero.
 *
 * WHAT THIS PACKAGE DOES NOT CONTAIN
 *
 * Commons. 9 of these 14 modules import org/forgerock/commons/ui/common/** ids directly, and all
 * 12 under org/ reach them transitively — only the two config/ leaves have no dependencies. Those
 * resolve to the sibling @openidentityplatform/ui-commons package — declared as a peerDependency,
 * see the note in package.json for why that rather than embedding a copy. The ids are left
 * exactly as the AMD source writes them, so an ESM consumer aliases two prefixes and an AMD
 * consumer copies two trees. NPM-PACKAGE.md has both routes.
 *
 * The toolchain is resolved here rather than in the shared library on purpose: `require` resolves
 * from the requiring file's location, so a bare require inside ui/build would look in
 * ui/build/node_modules and never find this module's dependencies. Passing them in keeps each
 * module's own node_modules authoritative.
 */

"use strict";

var path = require("path");
var babel = require("@babel/core");
var amdToEs6 = require("@buxlabs/amd-to-es6");
var emitter = require("../../build/npm-package-lib.js");

var MODULE_ROOT = path.resolve(__dirname, "..");
var ID_PREFIX = "org/forgerock/commons/ui/user";

emitter.build({
    moduleRoot: MODULE_ROOT,
    idPrefix: ID_PREFIX,
    babel: babel,
    amdToEs6: amdToEs6,

    /*
     * 12 org/forgerock/commons/ui/user/** + 2 config/** AMD modules, and the same 14 as ES
     * modules — no hand-written overrides, so amd and esm are equal and `hand` is 0. www is
     * everything in src/main/resources: 26 templates + 4 partials + 1 locale.
     *
     * The 40 templates and 5 partials named in task 3.3 are the *composed tree's* totals from
     * ui/NOTES-dual-build.md §1, where 40 = 14 contributed by commons + 26 by user and
     * 5 = 1 + 4. Commons' half ships in commons' own package; this one carries user's half in
     * full, which is the same rule 3.2 applied — a module packages its own src/main/resources
     * verbatim and nothing else.
     */
    expected: { amd: 14, esm: 14, www: 31, hand: 0 },

    exportsNote: "The AMD build under ./amd is deliberately absent from \"exports\". " +
        "RequireJS and r.js resolve by file path and never read package.json — see the header " +
        "of ui/build/npm-package-lib.js and NOTES-dual-build.md section 2. An AMD consumer uses " +
        "a RequireJS paths entry or a copy step. There is deliberately no \".\" entry either: " +
        "this package has no aggregate module, and unlike ui-commons there is no main.js to " +
        "point one at. Note that \"exports\" does not resolve the ES module tree's internal " +
        "specifiers in any case — they are bare, extensionless ids, including the " +
        "org/forgerock/commons/ui/common ids that resolve to the ui-commons peer. An ESM " +
        "consumer serves both prefixes with one alias each. NPM-PACKAGE.md has the routes.",
    exports: {
        "./esm/*": "./esm/*",
        "./www/*": "./www/*",
        "./package.json": "./package.json"
    },
    files: ["amd", "esm", "www", "LICENSE.md", "MANIFEST.txt", "NPM-PACKAGE.md"]
});
