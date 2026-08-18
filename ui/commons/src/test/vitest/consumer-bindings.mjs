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
 * What an ES module consumer must do before importing commons. Loaded by vitest.config.mjs as a
 * setupFile, so it runs before any test module is evaluated.
 * ============================================================================================
 *
 * This is NOT test scaffolding, and it must not grow into any. Everything in this file is an
 * obligation a real consumer has too — the ESM equivalent of what the AMD composition arranges
 * by accident of load order. Each entry is a binding openam-ui-ria (or whoever consumes the ES
 * module build) has to make for itself. If something here starts looking like a fixture, it is
 * in the wrong file.
 *
 * --------------------------------------------------------------------------------------------
 * Backbone.$
 * --------------------------------------------------------------------------------------------
 * FOUND BY THIS SUITE, in task 3.5, and it is the first thing the ESM build needed that the AMD
 * build does not. Without the line below, importing anything that reaches a Backbone view —
 * AbstractCollection does, through components/Messages, which constructs one at import time —
 * fails with:
 *
 *     TypeError: Right-hand side of 'instanceof' is not an object
 *       at child.setElement (backbone/backbone.js:1046)   this.$el = element instanceof Backbone.$ ...
 *
 * The cause is in Backbone 1.1.2's own UMD header, and it is deliberate on Backbone's part. Its
 * AMD branch declares jQuery as a dependency and passes it to the factory:
 *
 *     define(['underscore', 'jquery', 'exports'], function (_, $, exports) { ... factory(root, exports, _, $) })
 *
 * while the branch every non-AMD loader takes is commented "jQuery may not be needed as a
 * module" and calls `factory(root, exports, _)` with no `$` at all, leaving `Backbone.$`
 * undefined. So RequireJS hands Backbone its jQuery and an ES module loader does not. The AMD
 * build gets this for free and can never notice it missing; the ES module build cannot.
 *
 * It is a CONSUMER obligation rather than something commons should do in its own sources, for
 * the same reason `jquery` is a peerDependency and not a dependency: which jQuery instance
 * Backbone gets is the composing application's decision, and a library that assigns it has
 * quietly chosen for everyone. Backbone documents `Backbone.$ = $` as the supported way to say
 * it.
 *
 * NOT YET WRITTEN DOWN WHERE CONSUMERS READ IT. NPM-PACKAGE.md lists the ids a consumer must
 * alias — `underscore`, `ThemeManager`, `NavigationFilter`, `config/AppConfiguration` — but says
 * nothing about this, because nothing had loaded a view through the ES module build until now.
 * That file is task 3.2/3.3's and this is a CI task, so the addition is flagged rather than
 * made here.
 */

import $ from "jquery";
import Backbone from "backbone";

Backbone.$ = $;
