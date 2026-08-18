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
 * An ES module that exports nothing useful, for the build/verify-esm.mjs harnesses only.
 *
 * It stands in for every identifier a package imports but deliberately does not contain and
 * cannot. Two kinds reach it:
 *
 *   - Identifiers the *consuming product* owns. `ThemeManager`, `NavigationFilter` and
 *     `config/AppConfiguration` are ui-commons'; `KBADelegate` is ui-user's. Binding them is how
 *     a product configures these libraries. Under AMD they arrive through the flat composition
 *     overlay; an ES module consumer supplies them by alias.
 *   - Identifiers with no npm package in existence. `form2js` and `js2form` are `maxatwork/form2js`
 *     at a pinned git commit, never published (LIBS-INVENTORY.md section 6), so a consumer binds
 *     them to files the way it binds any other RequireJS `paths` entry.
 *
 * The stub is deliberately empty, and that is what it tests. Its job is to prove these are the
 * *only* things a consumer must supply beyond the declared peers — if a package ever starts
 * calling into one of them at import time, this file stops being enough and the check fails, which
 * is the signal that the contract with the consumer has changed.
 *
 * It also serves bare side-effect imports such as ui-user's `import "bootstrap";`, where the
 * import is for the library's effect on jQuery rather than for a value.
 */

export default {};
