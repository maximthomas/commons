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
 * Portions copyright 2025 3A Systems LLC.
 * Portions copyright 2026 3A Systems, LLC.
 */

/*
 * ES module port of src/test/qunit/OAuth.js — same tests, same names, same order, run against
 * the emitted ES module build. See vitest.config.mjs for why both files exist.
 *
 * The QUnit original hangs its URIUtils stubs off QUnit.moduleStart/moduleDone; beforeAll and
 * afterAll are the same lifecycle. What matters either way is that the stub lands on the object
 * OAuth.js holds a reference to, and it does: the generator emits `export default obj` for every
 * one of these modules, so the default export is a plain mutable object and not a frozen module
 * namespace. That is the property this port relies on, and it is worth knowing it is a property
 * of the emitted shape rather than of ES modules in general.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import sinon from "sinon";
import OAuth from "org/forgerock/commons/ui/common/util/OAuth";
import URIUtils from "org/forgerock/commons/ui/common/util/URIUtils";

describe("OAuth Functions", () => {
    beforeAll(() => {
        sinon.stub(URIUtils, "getCurrentOrigin").callsFake(() => "http://rp.com");
        sinon.stub(URIUtils, "getCurrentPathName").callsFake(() => "/app/index.html");
    });

    afterAll(() => {
        URIUtils.getCurrentOrigin.restore();
        URIUtils.getCurrentPathName.restore();
    });

    it("oAuth redirect uri", () => {
        expect(OAuth.getRedirectURI(), "default oAuth redirect_uri matches")
            .toBe("http://rp.com/app/oauthReturn.html");
        expect(OAuth.getRedirectURI("customOAuthReturn.html"), "custom oAuth redirect_uri matches")
            .toBe("http://rp.com/app/customOAuthReturn.html");
    });

    it("oAuth request url", () => {
        sinon.stub(OAuth, "generateNonce").callsFake(() => "nonceValue");

        expect(OAuth.getRequestURL(
            "http://idp.com/request",
            "myClientId",
            "openid profile email",
            "MyState1234"
        ), "generated oAuth request url matches expected value").toBe(
            "http://idp.com/request?response_type=code&scope=openid%20profile%20email&" +
            "redirect_uri=http://rp.com/app/oauthReturn.html&state=MyState1234" +
            "&nonce=nonceValue&client_id=myClientId"
        );

        OAuth.generateNonce.restore();
    });
});
