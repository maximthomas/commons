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
 * ES module port of src/test/qunit/ObjectUtil.js — same tests, same names, same order, run
 * against the emitted ES module build. See vitest.config.mjs for why both files exist.
 */

import { describe, it, expect } from "vitest";
import _ from "lodash";
import ObjectUtil from "org/forgerock/commons/ui/common/util/ObjectUtil";

describe("ObjectUtil Functions", () => {
    it("toJSONPointerMap", () => {
        const jsonMap = ObjectUtil.toJSONPointerMap({ "c": 2, "a": { "b": ["x", "y", "z", true], "d": undefined } });

        /*
         * The QUnit original asserts `assert.equal(jsonMap["/c"], '2')`, which passes on the
         * string '2' only because QUnit's `equal` is `==`. The value is the number 2 — the map
         * carries values through untouched — so the port states that rather than reproducing the
         * coercion. Same behaviour asserted, one type ambiguity removed.
         */
        expect(jsonMap["/c"], "toJSONPointerMap correctly flattens complex object").toBe(2);
        expect(_.isEqual(jsonMap["/a/b"], ["x", "y", "z", true]),
            "toJSONPointerMap correctly returns a list when it encounters an array").toBe(true);
        expect(_.has(jsonMap, "/d"),
            "undefined value not included in map produced by toJSONPointerMap").toBe(false);
    });

    it("getValueFromPointer", () => {
        const testObject = {
            testSet: ["apple", "pear"],
            testMap: { "foo": "bar", "hello": "world" }
        };

        expect(ObjectUtil.getValueFromPointer(testObject, "/testMap/foo"), "/testMap/foo").toBe("bar");
        expect(_.isEqual(ObjectUtil.getValueFromPointer(testObject, "/testSet"), ["apple", "pear"]),
            "/testSet").toBe(true);
        expect(ObjectUtil.getValueFromPointer(testObject, "/test2"), "/test2").toBe(undefined);
        expect(ObjectUtil.getValueFromPointer(testObject, "/"), "/").toBe(testObject);
    });

    it("isEqualSet", () => {
        expect(ObjectUtil.isEqualSet([1], [1]), "Simple set equality").toBe(true);
        expect(ObjectUtil.isEqualSet([1], [1, 3]), "Simple set inequality").toBe(false);
        expect(ObjectUtil.isEqualSet([3, 1], [1, 3]), "Set equality regardless of order").toBe(true);
        expect(ObjectUtil.isEqualSet([3, { a: 1 }, 1], [1, 3, { a: 1 }]),
            "Set equality with complex items").toBe(true);
        expect(ObjectUtil.isEqualSet([3, { a: 1 }, 1], [1, 3, { a: 2 }]),
            "Set inequality with differing complex items").toBe(false);
        expect(ObjectUtil.isEqualSet([3, { a: 1 }, ["b", "a"], 1], [1, 3, { a: 1 }, ["a", "b"]]),
            "Set equality with complex objects, regardless of order, and with nested sets").toBe(true);
    });

    it("findItemsNotInSet", () => {
        expect(_.isEqual(ObjectUtil.findItemsNotInSet([1, 2, 3], [2, 3]), [1]),
            "Simple difference found").toBe(true);
        expect(_.isEqual(ObjectUtil.findItemsNotInSet([1, 2, 3], [2, 3, 1]), []),
            "No differences found despite order differences").toBe(true);
        expect(_.isEqual(ObjectUtil.findItemsNotInSet([1, { a: 1 }, 3], [3, 1, { a: 2 }]), [{ a: 1 }]),
            "Complex item difference recognized").toBe(true);
        expect(_.isEqual(ObjectUtil.findItemsNotInSet([1, { b: 2, a: 1 }, 3], [3, 1, { a: 1, b: 2 }]), []),
            "Complex item equality recognized, regardless of order").toBe(true);
    });

    it("walkDefinedPath", () => {
        const testObject = { test: ["apple", { "foo": "bar", "hello": "world" }] };

        expect(ObjectUtil.walkDefinedPath(testObject, "/test/0"), "/test/0").toBe("/test/0");
        expect(ObjectUtil.walkDefinedPath(testObject, "/test/3/foo"), "/test/3/foo").toBe("/test/3");
        expect(ObjectUtil.walkDefinedPath(testObject, "/missing"), "/missing").toBe("/missing");
        expect(ObjectUtil.walkDefinedPath(testObject, "/missing/bar"), "/missing/bar").toBe("/missing");
        expect(ObjectUtil.walkDefinedPath({}, "/foo"), "/foo with empty object").toBe("/foo");
        expect(ObjectUtil.walkDefinedPath({ foo: undefined }, "/foo"),
            "/foo as a property with undefined as the value").toBe("/foo");
        expect(ObjectUtil.walkDefinedPath({ foo: null }, "/foo/bar"),
            "/foo as a property with null as the value").toBe("/foo");
        expect(ObjectUtil.walkDefinedPath({ foo: { bar: null } }, "/foo/bar"),
            "/foo/bar as a property with null as the value").toBe("/foo/bar");
    });

    it("generatePatchSet", () => {
        let patchDef = ObjectUtil.generatePatchSet({ "a": 1, "b": 2 }, { "a": 1 });

        expect(patchDef.length === 1 && patchDef[0].operation === "add" &&
            patchDef[0].field === "/b" && patchDef[0].value === 2,
        "Simple field addition returned for patchDef").toBe(true);

        patchDef = ObjectUtil.generatePatchSet({ "a": 1, "b": 2 }, { "c": 1 });
        expect(patchDef.length,
            "Expected operation count for removal of one attribute and addition of two others").toBe(3);

        patchDef = ObjectUtil.generatePatchSet({
            "setItems": [{ "sub": 2 }]
        }, {
            "setItems": [{ "sub": 1 }, { "sub": 2 }]
        });
        expect(patchDef.length === 1 && patchDef[0].operation === "remove" &&
            patchDef[0].field === "/setItems" && _.isEqual(patchDef[0].value, { "sub": 1 }),
        "Removal of value from set based on value of item").toBe(true);

        /* note that the order of the items isn't relevant; only the content matters */
        patchDef = ObjectUtil.generatePatchSet({
            "setItems": [{ "sub": 4 }, { "sub": 2 }, { "sub": 3 }]
        }, {
            "setItems": [{ "sub": 3 }, { "sub": 2 }]
        });
        expect(patchDef.length === 1 && patchDef[0].operation === "add" &&
            patchDef[0].field === "/setItems/-" && _.isEqual(patchDef[0].value, { "sub": 4 }),
        "Addition of value to set").toBe(true);

        patchDef = ObjectUtil.generatePatchSet({ manager: { _ref: "a/b/c" } }, {});
        expect(patchDef.length === 1 && patchDef[0].operation === "add" &&
            patchDef[0].field === "/manager" && _.isEqual(patchDef[0].value, { _ref: "a/b/c" }),
        "Addition of whole new complex property results in full map added").toBe(true);

        patchDef = ObjectUtil.generatePatchSet({ manager: null }, { manager: { _ref: "a/b/c" } });
        expect(patchDef.length === 1 && patchDef[0].operation === "remove" &&
            patchDef[0].field === "/manager" && !patchDef[0].value,
        "Setting a complex property to null results in a remove operation on the whole object").toBe(true);

        patchDef = ObjectUtil.generatePatchSet({ manager: { _ref: "a/b/c" } }, { manager: null });
        expect(patchDef.length === 1 && patchDef[0].operation === "replace" &&
            patchDef[0].field === "/manager" && _.isEqual(patchDef[0].value, { _ref: "a/b/c" }),
        "Replacement of null value with whole new complex property results in full map added").toBe(true);

        patchDef = ObjectUtil.generatePatchSet({ manager: { _ref: "a/b/d" } }, { manager: { _ref: "a/b/c" } });
        expect(patchDef.length === 1 && patchDef[0].operation === "replace" &&
            patchDef[0].field === "/manager/_ref" && patchDef[0].value === "a/b/d",
        "Replacement of simple value in nested map").toBe(true);
    });
});
