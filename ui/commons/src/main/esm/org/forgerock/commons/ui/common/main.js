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
 * Copyright 2015-2016 ForgeRock AS.
 * Portions copyright 2026 3A Systems, LLC.
 */

/**
 * ES module counterpart of `src/main/js/org/forgerock/commons/ui/common/main.js`.
 *
 * This is one of only two hand-written files in the ES module build; everything else is
 * generated from the AMD source. It is hand-written because the generator
 * (`@buxlabs/amd-to-es6`) throws on the AMD original: that file is a *named* define
 * (`define("org/forgerock/commons/ui/common/main", [...])`) carrying a dependency array with no
 * factory function at all, which the generator does not model.
 *
 * The AMD original is described by its own comment as "merely a useful construct for identifying
 * top-level modules which would be likely to need to embed within a single minified package".
 * It declares twelve dependencies, has no factory and exports nothing, so the faithful ES module
 * translation is twelve side-effect imports and no export.
 *
 * The twelve ids below must stay in step with the AMD original's dependency array; `npm run
 * build:npm` fails the build if they diverge. The AMD file writes them `./`-relative; they are
 * spelled in full here to match every other module in the ES build, all of which use the same
 * absolute ids the AMD build uses.
 */

import "org/forgerock/commons/ui/common/main/AbstractView";
import "org/forgerock/commons/ui/common/components/BootstrapDialogView";
import "org/forgerock/commons/ui/common/main/ErrorsHandler";
import "org/forgerock/commons/ui/common/components/Footer";
import "org/forgerock/commons/ui/common/main/i18nManager";
import "org/forgerock/commons/ui/common/components/Messages";
import "org/forgerock/commons/ui/common/components/Navigation";
import "org/forgerock/commons/ui/common/main/ProcessConfiguration";
import "org/forgerock/commons/ui/common/main/Router";
import "org/forgerock/commons/ui/common/main/SessionManager";
import "org/forgerock/commons/ui/common/main/SpinnerManager";
import "org/forgerock/commons/ui/common/SiteConfigurator";
