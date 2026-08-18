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
 * ES module port of src/test/qunit/UIUtils.js — same tests, same names, same order, run against
 * the emitted ES module build. See vitest.config.mjs for why both files exist.
 *
 * Two differences from the original, both about what a module system makes explicit.
 *
 * `$` is imported here. The QUnit original reaches for it as a bare global, which works only
 * because the AMD composition leaves jQuery on `window`; nothing in the ES module build does
 * that, and relying on it would make this suite pass or fail on a side effect of the harness.
 *
 * `UIUtils` is imported for its side effect on Handlebars, which is what the test is about: the
 * `staticSelect` helper is registered on the Handlebars *instance the module imports*, so the
 * template has to be compiled with that same instance. It is, because both this file and the
 * emitted UIUtils.js resolve the bare specifier "handlebars" to the one package.
 */

import { describe, it, expect } from "vitest";
import $ from "jquery";
import Handlebars from "handlebars";
import "org/forgerock/commons/ui/common/util/UIUtils";

describe("UIUtils Functions", () => {
    it("Static Select", () => {
        const template = Handlebars.compile("<select>" +
            "{{#staticSelect testVal}}" +
            "<option value='1'>1</option>" +
            "<option value='2'>2</option>" +
            "<option value='text/html'>text/html</option>" +
            "<option value=\"tick'test\">tick'test</option>" +
            "<option value='less<test'>less&lt;test</option>" +
            "<option value='and&test'>and&amp;test</option>" +
            "<option value='false'>boolean&amp;test</option>" +
            "{{/staticSelect}}" +
        "</select>");

        let testHTML = template({ "testVal": "2" });
        expect($(testHTML).val(), "2 option selected").toBe("2");

        testHTML = template({ "testVal": "text/html" });
        expect($(testHTML).val(), "text/html option selected").toBe("text/html");

        testHTML = template({ "testVal": "tick'test" });
        expect($(testHTML).val(), "tick'test option selected").toBe("tick'test");

        testHTML = template({ "testVal": "less<test" });
        expect($(testHTML).val(), "less<test option selected").toBe("less<test");

        testHTML = template({ "testVal": "and&test" });
        expect($(testHTML).val(), "and&test option selected").toBe("and&test");

        testHTML = template({ "testVal": false });
        expect($(testHTML).val(), "boolean&amp;test option selected").toBe("false");
    });
});
