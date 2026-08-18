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
 * ES module port of src/test/qunit/Base64.js — same tests, same names, same order, run against
 * the emitted ES module build. See vitest.config.mjs for why both files exist.
 */

import { describe, it, expect } from "vitest";
import Base64 from "org/forgerock/commons/ui/common/util/Base64";
import Mime from "org/forgerock/commons/ui/common/util/Mime";

describe("Base64 Functions", () => {
    it("Base64.encodeUTF8", () => {
        const input = "パスワードパスワード";

        expect(Base64.encodeUTF8(input), "Incorrect base-64 encoding")
            .toBe("44OR44K544Ov44O844OJ44OR44K544Ov44O844OJ");
    });

    it("Base64.encodeUTF8 - 2 pad chars", () => {
        const input = "パスワードパスワードx";

        expect(Base64.encodeUTF8(input), "Incorrect base-64 encoding - 2 pad char case")
            .toBe("44OR44K544Ov44O844OJ44OR44K544Ov44O844OJeA==");
    });

    it("Base64.encodeUTF8 - 1 pad char", () => {
        const input = "パスワードパスワードxx";

        expect(Base64.encodeUTF8(input), "Incorrect base-64 encoding - 1 pad char case")
            .toBe("44OR44K544Ov44O844OJ44OR44K544Ov44O844OJeHg=");
    });

    it("Base64.decodeUTF8", () => {
        const input = "44OR44K544Ov44O844OJ44OR44K544Ov44O844OJ";

        expect(Base64.decodeUTF8(input), "Incorrect base-64 decoding").toBe("パスワードパスワード");
    });

    it("Base64.decodeUTF8 - 1 pad char", () => {
        const input = "44OR44K544Ov44O844OJ44OR44K544Ov44O844OJeHg=";

        expect(Base64.decodeUTF8(input), "Incorrect base-64 decoding").toBe("パスワードパスワードxx");
    });

    it("Base64.decodeUTF8 - 2 pad chars", () => {
        const input = "44OR44K544Ov44O844OJ44OR44K544Ov44O844OJeA==";

        expect(Base64.decodeUTF8(input), "Incorrect base-64 decoding").toBe("パスワードパスワードx");
    });

    it("Base64.encodeUTF8/decodeUTF8 - various punctuation characters", () => {
        const input = "43uin 98e2 + 343_ {} 43qafdgfREER'FDj ionk/.,<>`fj iod Hdfjl";

        expect(Base64.decodeUTF8(Base64.encodeUTF8(input)),
            "Unable to round-trip Base64 special characters").toBe(input);
    });

    it("Mime.encodeHeader", () => {
        const input = "パスワードパスワード";

        expect(Mime.encodeHeader(input), "Incorrect Mime encoding in header")
            .toBe("=?UTF-8?B?44OR44K544Ov44O844OJ44OR44K544Ov44O844OJ?=");
    });
});
