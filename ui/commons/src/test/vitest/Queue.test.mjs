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
 * ES module port of src/test/qunit/Queue.js — same tests, same names, same order, run against
 * the emitted ES module build. See vitest.config.mjs for why both files exist.
 */

import { describe, it, expect } from "vitest";
import Queue from "org/forgerock/commons/ui/common/util/Queue";

describe("Queue Functions", () => {
    it("core operations", () => {
        const q = new Queue(["a", "b"]);

        expect(q.peek()).toBe("a");
        expect(q.remove()).toBe("a");
        expect(q.remove()).toBe("b");
        q.add("c");
        expect(q.remove()).toBe("c");
        expect(q.peek()).toBe(undefined);
        expect(q.remove()).toBe(undefined);
    });
});
