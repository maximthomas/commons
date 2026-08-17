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
 * Node resolve hook standing in for the alias a real ES module consumer configures.
 *
 * This is the harness half of build/verify-esm.mjs, and it exists because the generated tree
 * cannot be imported by Node unaided. Every internal specifier is a **bare, extensionless**
 * commons id:
 *
 *     import * as loaderRuntime from "org/forgerock/commons/ui/common/util/esm/LoaderRuntime";
 *
 * Two separate things stop Node resolving that. A bare specifier is looked up as a *package*
 * named `org`, and no "exports" entry in this package can claim it — "exports" only ever answers
 * for specifiers already addressed to this package. And Node never appends an extension, so even
 * an alias has to supply the ".js" itself.
 *
 * A bundler consumer solves both with one alias entry: webpack `resolve.alias` and Vite
 * `resolve.alias` both take the prefix and both apply `resolve.extensions` afterwards. Node has
 * no such setting, so the equivalent here is this hook. What it does — prefix substitution plus
 * ".js" — is exactly what NPM-PACKAGE.md tells a consumer to configure, which is the point: if
 * this hook has to do something the documented alias cannot, the documentation is wrong.
 */

import { pathToFileURL } from "node:url";

const ID_PREFIX = "org/forgerock/commons/ui/common/";

let esmRoot = null;
let stubs = {};
let aliases = {};

export function initialize (data) {
    esmRoot = data.esmRoot;
    stubs = data.stubs || {};
    aliases = data.aliases || {};
}

export function resolve (specifier, context, next) {
    if (specifier.startsWith(ID_PREFIX)) {
        return {
            url: pathToFileURL(esmRoot + "/" + specifier + ".js").href,
            format: "module",
            shortCircuit: true
        };
    }

    /*
     * Peer dependencies the caller has chosen to stand in for. Only jquery needs this, and only
     * because of Node rather than because of anything in this package: jQuery 3 exports a
     * *factory* — `function (window, noGlobal)` — when it is loaded without a `window` carrying a
     * `document`, so `$.Deferred` is undefined and any commons module that uses it fails on
     * import in Node. Measured: `typeof $` is "function" with `$.length === 1` and no `.Deferred`.
     * That is not a defect in the emitted tree; in a browser jQuery resolves to the real object.
     *
     * Stubbing is declared by the caller and named in the check output rather than being silently
     * absent, so nobody reads a passing run as "commons works against real jQuery in Node".
     */
    if (Object.prototype.hasOwnProperty.call(stubs, specifier)) {
        return { url: stubs[specifier], format: "module", shortCircuit: true };
    }

    /*
     * Identifiers the product rebinds to a different package, resolved normally afterwards.
     * These are not test scaffolding: package.json's //peerDependencies-underscore records that
     * 25 commons modules import `underscore` and that it is not a dependency of anything here —
     * openam-ui-ria's require.config.map points it at lodash, and an ES module consumer has to
     * supply the same rebinding. Doing it here means a passing run is evidence that the rebinding
     * documented in NPM-PACKAGE.md is sufficient, rather than evidence about a tree nobody has
     * to configure.
     */
    if (Object.prototype.hasOwnProperty.call(aliases, specifier)) {
        return next(aliases[specifier], context);
    }

    return next(specifier, context);
}
