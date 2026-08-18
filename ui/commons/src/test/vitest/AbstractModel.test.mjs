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
 * ES module port of src/test/qunit/AbstractModel.js — same tests, same names, same order, run
 * against the emitted ES module build. See vitest.config.mjs for why both files exist.
 *
 * `_` is imported here. The QUnit original uses it without declaring it, relying on lodash being
 * on `window` from the AMD composition; that global does not exist for an ES module consumer.
 */

import { describe, it, expect } from "vitest";
import $ from "jquery";
import _ from "lodash";
import sinon from "sinon";
import AbstractModel from "org/forgerock/commons/ui/common/main/AbstractModel";
import ServiceInvoker from "org/forgerock/commons/ui/common/main/ServiceInvoker";

describe("AbstractModel Functions", () => {
    it("create with server-assigned id", () => {
        const testModel = new AbstractModel();
        const newRecord = {
            "foo": "bar",
            "hello": "world"
        };
        let restCallArg;

        testModel.url = "/crestResource";

        sinon.stub(ServiceInvoker, "restCall").callsFake((opts) => $.Deferred().resolve(_.extend(JSON.parse(opts.data), {
            "_id": 1,
            "_rev": 1
        })));

        return testModel.save(newRecord).then(() => {
            restCallArg = ServiceInvoker.restCall.args[0][0]; // first invocation, first argument
            expect(testModel.id, "Newly-created model has id from backend").toBe(1);
            expect(restCallArg.url, "correct url used to create model").toBe("/crestResource?_action=create&");
            expect(restCallArg.type, "correct method used to create model").toBe("POST");
            ServiceInvoker.restCall.restore();
        });
    });

    it("create with client-supplied id", () => {
        const testModel = new AbstractModel();
        const newRecord = {
            "foo": "bar",
            "hello": "world"
        };
        let restCallArg;

        testModel.url = "/crestResource";
        testModel.id = "myCustomId";

        sinon.stub(ServiceInvoker, "restCall").callsFake((opts) => $.Deferred().resolve(_.extend(JSON.parse(opts.data), {
            "_rev": 1
        })));

        return testModel.save(newRecord).then(() => {
            restCallArg = ServiceInvoker.restCall.args[0][0]; // first invocation, first argument
            expect(testModel.get("_rev"), "Model has new rev from backend").toBe(1);
            expect(restCallArg.url, "correct url used to create model").toBe("/crestResource/myCustomId?");
            expect(restCallArg.headers["If-None-Match"], "correct revision header provided").toBe("*");
            expect(restCallArg.type, "correct method used to create model").toBe("PUT");

            ServiceInvoker.restCall.restore();
        });
    });

    it("read operation", () => {
        const testModel = new AbstractModel();
        let restCallArg;

        testModel.url = "/crestResource";
        testModel.id = 1;

        sinon.stub(ServiceInvoker, "restCall").callsFake(() => $.Deferred().resolve({
            "_id": 1,
            "_rev": 1,
            "name": "foo"
        }));

        return testModel.fetch().then(() => {
            restCallArg = ServiceInvoker.restCall.args[0][0]; // first invocation, first argument
            expect(testModel.get("name"), "example data populated from fetch call").toBe("foo");
            expect(testModel.get("_rev"), "revision populated from fetch call").toBe(1);
            expect(restCallArg.url, "correct url used to read model").toBe("/crestResource/1?");
            expect(restCallArg.type, "correct method used to read model").toBe("GET");
        }).then(() => {
            testModel.additionalParameters = {
                "_fields": "name"
            };
            return testModel.fetch();
        }).then(() => {
            restCallArg = ServiceInvoker.restCall.args[1][0]; // second invocation, first argument
            expect(restCallArg.url, "url includes additionalParameters").toBe("/crestResource/1?_fields=name");
        }).then(() => {
            testModel.parse = (response) => _.extend({ "addedByParseFunction": true }, response);
            return testModel.fetch();
        }).then(() => {
            expect(testModel.get("addedByParseFunction"),
                "parse function successfully modified model content").toBe(true);
            ServiceInvoker.restCall.restore();
        });
    });

    it("update operations", () => {
        const testModel = new AbstractModel({
            "_id": 1,
            "_rev": 1,
            "foo": "bar",
            "hello": "world"
        });
        let restCallArg;

        testModel.url = "/crestResource";

        sinon.stub(ServiceInvoker, "restCall").callsFake((opts) => $.Deferred().resolve(_.extend(JSON.parse(opts.data), {
            "_rev": 2
        })));

        return testModel.save().then(() => {
            restCallArg = ServiceInvoker.restCall.args[0][0]; // first invocation, first argument
            expect(testModel.get("_rev"), "Model has new rev from backend").toBe(2);
            expect(restCallArg.url, "correct url used to update model").toBe("/crestResource/1?");
            expect(restCallArg.headers["If-Match"], "correct revision header provided").toBe(1);
            expect(restCallArg.type, "correct method used to update model").toBe("PUT");

            ServiceInvoker.restCall.restore();
        });
    });

    it("delete operations", () => {
        const testModel = new AbstractModel({
            "_id": 1,
            "_rev": 1,
            "foo": "bar",
            "hello": "world"
        });
        let restCallArg;

        testModel.url = "/crestResource";

        sinon.stub(ServiceInvoker, "restCall").callsFake(() => $.Deferred().resolve());

        return testModel.destroy().then(() => {
            restCallArg = ServiceInvoker.restCall.args[0][0]; // first invocation, first argument
            expect(restCallArg.url, "correct url used to delete model").toBe("/crestResource/1?");
            expect(restCallArg.type, "correct method used to DELETE model").toBe("DELETE");

            ServiceInvoker.restCall.restore();
        });
    });

    it("patch operations", () => {
        const testModel = new AbstractModel({
            "_id": 1,
            "_rev": 1,
            "foo": "bar",
            "hello": "world"
        });
        let restCallArg;

        testModel.url = "/crestResource";

        sinon.stub(ServiceInvoker, "restCall").callsFake(() => $.Deferred().resolve());

        return testModel.save({ "foo": "baz" }, { patch: true }).then(() => {
            restCallArg = ServiceInvoker.restCall.args[0][0]; // first invocation, first argument

            expect(restCallArg.url, "correct url used to patch model").toBe("/crestResource/1?");
            expect(restCallArg.type, "correct method used to patch model").toBe("PATCH");
            expect(restCallArg.data, "correct patch content provided")
                .toBe('[{"operation":"replace","field":"/foo","value":"baz"}]');

            ServiceInvoker.restCall.restore();
        });
    });

    it("custom get method to support JSONPointer", () => {
        const testModel = new AbstractModel({
            "_id": 1,
            "_rev": 1,
            "simpleKey": "simpleValue",
            "foo": {
                "hello": "world"
            }
        });

        expect(testModel.get("simpleKey"), "basic get behavior used to get simple value").toBe("simpleValue");
        expect(testModel.get("/simpleKey"), "jsonpointer used to get simple value").toBe("simpleValue");
        expect(testModel.get("/foo/hello"), "jsonpointer used to get deeply-nested value").toBe("world");
    });
});
