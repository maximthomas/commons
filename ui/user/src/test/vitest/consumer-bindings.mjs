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
 * What an ES module consumer must do before importing ui-user. The same file, and the same one
 * entry, as ../../../../commons/src/test/vitest/consumer-bindings.mjs — read that one for the
 * full account of why `Backbone.$` is a consumer obligation, what Backbone 1.1.2's UMD header
 * does differently for AMD, and why it is not yet in NPM-PACKAGE.md.
 *
 * It is repeated rather than shared because it is a statement about what a consumer of THIS
 * package has to do, and ui-user is installable without ui-commons' test tree. Both files are
 * short and both are contracts; a shared helper would make the obligation look like tooling.
 *
 * ui-user reaches Backbone through commons' AbstractView, so every one of the twelve modules
 * under org/ inherits the requirement.
 */

import $ from "jquery";
import Backbone from "backbone";

Backbone.$ = $;
