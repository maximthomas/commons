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
 * The ES module build's seam for the three RequireJS loader APIs that have no ES module
 * equivalent. This module exists **only in the ESM build** — there is no counterpart in
 * `src/main/js`, because under AMD the loader supplies all three directly.
 *
 * The AMD source uses:
 *
 * - `require.toUrl(path)` — `util/UIUtils` (template fetch) and `main/i18nManager`
 *   (i18next `resGetPath`). Resolves a path against the RequireJS `baseUrl`, i.e. the deployed
 *   web root. `import.meta.url` is *not* an equivalent: these paths resolve against the
 *   application root, not against the importing module's own location.
 * - `module.config()` — `main/i18nManager`, for the `i18nLoad` setting.
 * - `require([id], callback)` with an id only known at run time — `util/ModuleLoader.load`,
 *   which every view lookup goes through. A bare `import(id)` cannot serve this: the specifier
 *   is a string assembled at run time and no bundler can trace it.
 *
 * Rather than guess at these, the ESM build routes them through this module and the consuming
 * application injects the answers with {@link configure}. The runtime-id case is design
 * decision D1's registry (`import.meta.glob`) in the consuming build; until a consumer supplies
 * a resolver, {@link loadModule} rejects with a message naming what is missing rather than
 * failing somewhere unrelated.
 *
 * @example
 * import { configure } from "org/forgerock/commons/ui/common/util/esm/LoaderRuntime";
 *
 * const modules = import.meta.glob("./org/forgerock/**\/*.js");
 * const libraries = {
 *     "bootstrap": () => import("bootstrap"),
 *     "bootstrap-dialog": () => import("bootstrap3-dialog")
 * };
 *
 * configure({
 *     baseUrl: "/XUI/",
 *     urlArgs: "v=14.0.0",
 *     moduleConfig: { i18nLoad: "current" },
 *     resolveModule: (id) => (modules[`./${id}.js`] || libraries[id] || (() => undefined))()
 * });
 *
 * The `libraries` map is not defensive padding, and it cannot be collapsed into a bare
 * `import(id)` fall-through. Three of the ids commons passes are library names rather than module
 * paths — `main/AbstractView` and `components/Navigation` load `"bootstrap"`, and `util/UIUtils`
 * loads `"bootstrap-dialog"` — which the glob above matches neither of. `import(id)` on a
 * *runtime* string is untraceable by every bundler (nothing gets included in the build) and needs
 * an import map to resolve a bare specifier in the browser at all; the two entries above are
 * static strings, so a bundler traces them normally. Note also that `"bootstrap-dialog"` is one
 * of the ids the product rebinds — the npm package is `bootstrap3-dialog`.
 *
 * The final `(() => undefined)` is what makes an id nobody covered fail legibly: {@link loadModule}
 * rejects naming the id, rather than resolving with `undefined` and failing later in whatever
 * touched the result.
 */

var settings = {
    baseUrl: "",
    moduleConfig: {},
    resolveModule: null,
    urlArgs: null,
    resolveUrl: null
};

/**
 * Supplies the application-level answers the AMD loader used to provide.
 *
 * @param {Object} options Settings to apply; unspecified keys keep their current value.
 * @param {String} [options.baseUrl] Prefix {@link toUrl} resolves paths against. Equivalent to
 *                                   the RequireJS `baseUrl`. Defaults to `""`, which yields
 *                                   paths relative to the document.
 * @param {Object} [options.moduleConfig] Value {@link moduleConfig} returns. `null` is treated as
 *                                        "none", not as the value — callers index straight into
 *                                        the result.
 * @param {Function} [options.resolveModule] `(id) => Promise<module>`, backing
 *                                           {@link loadModule}.
 * @param {String|Function} [options.urlArgs] Cache-busting suffix appended by {@link toUrl}, as
 *                                            RequireJS's `urlArgs` does. Either a literal string
 *                                            (`"v=14.0.0"`) or `(resourcePath, url) => String`.
 * @param {Function} [options.resolveUrl] `(resourcePath) => String`, replacing {@link toUrl}'s
 *                                        own resolution entirely. For a consumer whose asset
 *                                        URLs come from a bundler manifest rather than from a
 *                                        base and a suffix.
 * @returns {void}
 */
export function configure (options) {
    if (!options) { return; }
    if (options.baseUrl !== undefined) { settings.baseUrl = options.baseUrl; }
    if (options.moduleConfig !== undefined) { settings.moduleConfig = options.moduleConfig; }
    if (options.resolveModule !== undefined) { settings.resolveModule = options.resolveModule; }
    if (options.urlArgs !== undefined) { settings.urlArgs = options.urlArgs; }
    if (options.resolveUrl !== undefined) { settings.resolveUrl = options.resolveUrl; }
}

/**
 * The ES module stand-in for `require.toUrl`.
 *
 * `urlArgs` is not padding. Both call sites this replaces — `util/UIUtils`' template fetch and
 * `main/i18nManager`'s i18next `resGetPath` — resolve URLs that the deployed application
 * cache-busts today, because RequireJS's own `toUrl` appends the configured `urlArgs` and the
 * product sets it to the build version. A seam that could only prefix a `baseUrl` would have
 * left an ESM consumer no way to reproduce that, and would have forced design decision D4's
 * `resolveAssetUrl` to route around this module rather than through it.
 *
 * @param {String} resourcePath Path relative to the application root, e.g.
 *                              `"templates/common/404.html"`.
 * @returns {String} `resourcePath` resolved against the configured `baseUrl`, with `urlArgs`
 *                   appended when one is configured.
 */
export function toUrl (resourcePath) {
    if (settings.resolveUrl) { return settings.resolveUrl(resourcePath); }

    var url = String(resourcePath);

    if (settings.baseUrl) {
        var base = settings.baseUrl.charAt(settings.baseUrl.length - 1) === "/"
            ? settings.baseUrl
            : settings.baseUrl + "/";

        url = base + url.replace(/^\//, "");
    }

    if (settings.urlArgs) {
        var args = typeof settings.urlArgs === "function"
            ? settings.urlArgs(resourcePath, url)
            : settings.urlArgs;

        if (args) { url += (url.indexOf("?") === -1 ? "?" : "&") + args; }
    }

    return url;
}

/**
 * The ES module stand-in for AMD's `module.config()`.
 *
 * @returns {Object} The configured module config; `{}` when none was supplied. Never `null` —
 *                   `main/i18nManager` reads `.i18nLoad` straight off the result.
 */
export function moduleConfig () {
    return settings.moduleConfig || {};
}

/**
 * Whether a resolved value is a module record rather than the module's own value.
 *
 * There are two shapes and only one of them is what most people reach for. `__esModule` is a
 * marker Babel and webpack stamp on transpiled CommonJS interop objects — the AMD build relies
 * on it, which is why `main/ViewManager` tests for it directly and why it is easy to assume it
 * is the whole answer. A **native** ES module namespace, which is what `import()` and
 * `import.meta.glob` hand back, does not carry it: it is identified by
 * `Symbol.toStringTag === "Module"`. Testing only `__esModule` here silently returned the
 * namespace object to all 20 `ModuleLoader.load` call sites, so every view lookup got an object
 * with no `render` and no callable form.
 *
 * @param {*} value The resolver's result.
 * @returns {Boolean} `true` for either module-record shape.
 */
function isNamespace (value) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) {
        return false;
    }
    return Boolean(value.__esModule) || value[Symbol.toStringTag] === "Module";
}

/**
 * Reduces whatever a dynamic import produced to the value the AMD callback would have received.
 *
 * Exported because {@link loadModule} is not the only place that has to do this: `main/ViewManager`
 * lazily imports `main/ReactAdapterView` by literal id, which needs no resolution help but does
 * need the same unwrap. Writing it out a second time there is what let the `__esModule`-only test
 * survive — two spellings of one decision, and only one of them got fixed. Keep it one function.
 *
 * @param {*} value A module namespace, an interop object, or a plain value.
 * @returns {*} The default export when `value` is a module record carrying one, else `value`.
 */
export function unwrapModule (value) {
    return isNamespace(value) && value.default !== undefined ? value.default : value;
}

/**
 * The ES module stand-in for `require([id], callback)` where `id` is only known at run time.
 *
 * @param {String} id Module id, e.g. `"org/forgerock/commons/ui/common/main/Router"`.
 * @returns {Promise} Resolving to the module's default export when it has one, otherwise to the
 *                    module namespace. Rejects, naming `id`, when no resolver has been configured
 *                    or when the resolver yields nothing for it.
 */
export function loadModule (id) {
    if (!settings.resolveModule) {
        return Promise.reject(new Error(
            "[LoaderRuntime] Cannot load \"" + id + "\": no resolveModule was configured. The ES " +
            "module build cannot resolve a module id known only at run time on its own — the " +
            "consuming application must supply a resolver via " +
            "LoaderRuntime.configure({ resolveModule })."
        ));
    }

    // The resolver is application code and may throw synchronously — a missing entry in an
    // import.meta.glob map is a TypeError, not a rejection. Calling it inside the chain keeps
    // this function's contract: it returns a Promise, it never throws.
    return Promise.resolve().then(function () {
        return settings.resolveModule(id);
    }).then(function (module) {
        // An unknown id is the failure this whole module exists to make legible, and it is the
        // likeliest one: a consumer's registry covers the ids it was globbed over, and commons
        // asks for three that no glob of the source tree matches ("bootstrap" twice,
        // "bootstrap-dialog"). A resolver that returns undefined rather than throwing would
        // otherwise resolve this promise with undefined, and the id would be gone by the time
        // anything noticed — ModuleLoader hands the value straight to callers such as
        // ViewManager.changeView, which fails on a property of undefined with nothing in the
        // message to say which module was missing.
        if (module === null || module === undefined) {
            throw new Error(
                "[LoaderRuntime] The configured resolveModule returned nothing for \"" + id +
                "\". The consuming application's module registry does not cover this id. Note " +
                "that commons asks for library names as well as module paths — \"bootstrap\" and " +
                "\"bootstrap-dialog\" are not paths in this package and no glob over its source " +
                "tree will match them; see NPM-PACKAGE.md."
            );
        }

        return unwrapModule(module);
    });
}
