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
 * Stands in for the product's `config/AppConfiguration`, for build/verify-esm.mjs only.
 *
 * The empty stub the other bound ids use is not enough for this one, and the reason is a trap
 * worth stating rather than working around silently. ui-commons' `main/Configuration` reads
 * `appConfiguration.loggerLevel` at *module scope* and, unless it is exactly "debug", replaces
 * `console.log`, `.debug`, `.info`, `.error` and `.warn` with no-ops — globally, for the rest of
 * the process. Anything importing a module that reaches Configuration therefore silences a
 * harness written with console.log part-way through its run, with no error raised and exit
 * code 0. It reads as a hang or a crash and is neither.
 *
 * So: "debug", to keep the console intact. verify-esm.mjs writes through process.stdout.write in
 * any case, which is the second, independent guard — one of the two would do, and having both
 * means neither has to be remembered.
 *
 * `moduleDefinition` is an empty array because Configuration's own methods iterate it. Nothing
 * here pretends to be a real product configuration; a check needing one is a check that belongs
 * with task 3.5's environment rather than with this stub.
 */

export default {
    loggerLevel: "debug",
    moduleDefinition: []
};
