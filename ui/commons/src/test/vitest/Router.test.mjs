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
 * Copyright 2016 ForgeRock AS.
 * Portions copyright 2026 3A Systems, LLC.
 */

/*
 * ES module port of src/test/qunit/Router.js — same tests, same names, same order, run against
 * the emitted ES module build. See vitest.config.mjs for why both files exist.
 */

import { describe, it, expect } from "vitest";
import Router from "org/forgerock/commons/ui/common/main/Router";

describe("Router Functions", () => {
    it("getLink", () => {
        const fakeRoute = {
            url: /fake-(.+)\-(.+)/,
            pattern: "fake-?-?"
        };

        expect(Router.getLink(fakeRoute, ["simple", "value"])).toBe("fake-simple-value");
        expect(Router.getLink(fakeRoute, ["comp?lex", "value"])).toBe("fake-comp?lex-value");
        expect(Router.getLink(fakeRoute, ["part?ial"])).toBe("fake-part?ial-");
        expect(Router.getLink(fakeRoute, [])).toBe("fake--");
    });
});
