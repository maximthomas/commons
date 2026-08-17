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
 * Stands in for the identifiers the *consuming product* owns, for build/verify-esm.mjs only.
 *
 * Three commons modules import ids that this package deliberately does not contain and cannot:
 * `ThemeManager`, `NavigationFilter` and `config/AppConfiguration` are the product's, and binding
 * them is how a product configures commons. Under AMD they arrive through the flat composition
 * overlay; an ES module consumer supplies them by alias. NPM-PACKAGE.md lists them.
 *
 * The stub is deliberately empty. Its job is to prove that these three are the *only* things a
 * consumer must supply beyond the declared peers — if commons ever starts calling into one of
 * them at import time, this file stops being enough and the check fails, which is the signal that
 * the contract with the product has changed.
 */

export default {};
