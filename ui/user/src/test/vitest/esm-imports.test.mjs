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
 * Every module in the emitted ES module build, imported under a DOM.
 *
 * This is the ten modules build/verify-esm.mjs cannot import under bare Node, plus the four it
 * can — all fourteen, so the boundary between them stops being a thing anyone has to track. See
 * vitest.config.mjs for why this file is an import check and not a behavioural suite, and why
 * writing a behavioural suite for ui-user is nobody's task yet.
 *
 * WHAT AN IMPORT ACTUALLY PROVES HERE, which is more than it sounds. These modules do their work
 * at module scope: they extend commons' AbstractView, register Handlebars partials, read
 * Configuration, touch `$.fn`. A tree that resolves cleanly and throws on evaluation is the exact
 * failure the emitter's own textual checks cannot see — task 3.2 shipped one, and its record is
 * in the header of ui/commons/build/verify-esm.mjs.
 *
 * THE LIST IS DISCOVERED, NOT WRITTEN DOWN. Walking target/npm/esm means a module added to
 * src/main/js is covered the day it appears, with nobody remembering to add it here. The count
 * assertion below is the other half of that: a walk that finds nothing would otherwise pass
 * silently, which is how a suite quietly stops testing anything.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const ESM_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "target", "npm", "esm");

const walk = (dir, prefix = "") =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
            ? walk(path.join(dir, entry.name), prefix + entry.name + "/")
            : entry.name.endsWith(".js") ? [prefix + entry.name.replace(/\.js$/, "")] : []
    );

const IDS = walk(ESM_ROOT).sort();

describe("ui-user ES module build", () => {
    it("has modules to import", () => {
        expect(IDS.length, "target/npm/esm holds no modules; the emit cannot have run")
            .toBeGreaterThan(0);
    });

    /*
     * A test per module rather than one loop, so a failure names the module in the report instead
     * of stopping the run at the first one. `/* @vite-ignore *\/` because the specifier is
     * computed: Vite would otherwise try to analyse it at transform time and warn.
     */
    it.each(IDS)("imports %s", async (id) => {
        const loaded = await import(/* @vite-ignore */ path.join(ESM_ROOT, id + ".js"));

        expect(loaded, id + " imported as nothing").toBeTypeOf("object");
    });
});
