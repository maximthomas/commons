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

/**
 * Node resolve hook standing in for the aliases a real ES module consumer configures. Shared by
 * every ui module's build/verify-esm.mjs.
 *
 * It exists because a generated tree cannot be imported by Node unaided. Every internal specifier
 * is a **bare, extensionless** module id:
 *
 *     import AbstractView from "org/forgerock/commons/ui/common/main/AbstractView";
 *
 * Two separate things stop Node resolving that. A bare specifier is looked up as a *package* named
 * `org`, and no "exports" entry in any package can claim it — "exports" only ever answers for
 * specifiers already addressed to that package. And Node never appends an extension, so even an
 * alias has to supply the ".js" itself.
 *
 * A bundler consumer solves both with one alias entry per prefix: webpack `resolve.alias` and Vite
 * `resolve.alias` both take a prefix and both apply `resolve.extensions` afterwards. Node has no
 * such setting, so the equivalent here is this hook. What it does — prefix substitution plus ".js"
 * — is exactly what each NPM-PACKAGE.md tells a consumer to configure, which is the point: if this
 * hook has to do something the documented alias cannot, the documentation is wrong.
 *
 * `prefixes` is a LIST rather than a single entry because a module may import ids belonging to a
 * sibling package. ui/user's modules import org/forgerock/commons/ui/common ids that resolve to
 * @openidentityplatform/ui-commons, and pointing both prefixes at their respective emitted trees
 * is precisely the two-alias configuration its NPM-PACKAGE.md prescribes. Longest prefix wins, so
 * the narrow …/ui/common and …/ui/user entries cannot be shadowed by a broader one — the same
 * constraint NOTES-dual-build.md §2 case C measured for RequireJS `paths`.
 */

import { pathToFileURL } from "node:url";

let prefixes = [];
let stubs = {};
let aliases = {};

export function initialize (data) {
    // Longest first, so a narrow prefix always wins over a broader one that contains it.
    prefixes = (data.prefixes || []).slice().sort((a, b) => b.prefix.length - a.prefix.length);
    stubs = data.stubs || {};
    aliases = data.aliases || {};
}

export function resolve (specifier, context, next) {
    for (const entry of prefixes) {
        if (specifier.startsWith(entry.prefix)) {
            return {
                url: pathToFileURL(entry.root + "/" + specifier + ".js").href,
                format: "module",
                shortCircuit: true
            };
        }
    }

    /*
     * Peer dependencies, and ids with no package at all, that the caller has chosen to stand in
     * for. jquery needs it for a reason that is about Node rather than about any of these
     * packages: jQuery 3 exports a *factory* — `function (window, noGlobal)` — when loaded without
     * a `window` carrying a `document`, so `$.Deferred` is undefined and any module using it fails
     * on import. Measured: `typeof $` is "function" with `$.length === 1` and no `.Deferred`.
     *
     * Stubbing is declared by the caller and named in the check output rather than being silently
     * absent, so nobody reads a passing run as "this works against the real libraries in Node".
     */
    if (Object.prototype.hasOwnProperty.call(stubs, specifier)) {
        return { url: stubs[specifier], format: "module", shortCircuit: true };
    }

    /*
     * Identifiers the product rebinds to a different package, resolved normally afterwards.
     * These are not test scaffolding: `underscore` is imported by 25 commons modules and 3 user
     * modules and is a dependency of neither — openam-ui-ria's require.config.map points it at
     * lodash, and an ES module consumer must supply the same rebinding. Doing it here means a
     * passing run is evidence that the rebinding each NPM-PACKAGE.md documents is sufficient,
     * rather than evidence about a tree nobody has to configure.
     */
    if (Object.prototype.hasOwnProperty.call(aliases, specifier)) {
        return next(aliases[specifier], context);
    }

    return next(specifier, context);
}
