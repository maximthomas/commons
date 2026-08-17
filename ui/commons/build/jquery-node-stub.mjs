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
 * The narrowest possible stand-in for jQuery, for build/verify-esm.mjs only.
 *
 * jQuery 3 needs a `window` with a `document` and yields a factory function without one, so it
 * cannot supply `$.Deferred` under bare Node. Only `util/ModuleLoader` is on the path this
 * verification exercises, and it uses exactly one jQuery API — `$.Deferred()`, as the promise it
 * hands back to callers.
 *
 * Deliberately not a general jQuery shim. If a check ever needs more of jQuery than this, that is
 * the signal to bring in a real DOM (jsdom) rather than to grow this file: a stub that grows to
 * imitate a library stops testing the code and starts testing the imitation.
 */

function Deferred () {
    var settle = {};
    var promise = new Promise(function (resolve, reject) {
        settle.resolve = resolve;
        settle.reject = reject;
    });

    return {
        resolve: settle.resolve,
        reject: settle.reject,
        promise: function () { return promise; },
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise)
    };
}

export default {
    Deferred: Deferred,
    when: function (value) { return Promise.resolve(value); }
};
