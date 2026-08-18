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
 * ES module port of src/test/qunit/ValidatorsManager.js — same tests, same names, same order,
 * run against the emitted ES module build. See vitest.config.mjs for why both files exist.
 *
 * The container and the validator configuration are built once at module scope, exactly as in
 * the original, and the tests mutate the same two inputs in sequence. THE ORDER IS LOAD-BEARING:
 * `evaluateDependentFields` leaves both fields on "GOOD" and `evaluateAllValidatorsForField`
 * starts by setting them back to "BAD". Vitest runs `it` blocks in declaration order within a
 * file, so this holds — but do not add `concurrent` here, and do not reorder.
 *
 * `assert.async()` in the original is Vitest's returned promise; every await chain below is the
 * original's `.then` chain with the `done()` call replaced by the end of the promise.
 */

import { describe, it, expect } from "vitest";
import $ from "jquery";
import _ from "lodash";
import sinon from "sinon";
import ValidatorsManager from "org/forgerock/commons/ui/common/main/ValidatorsManager";

const container = $("<div>")
    .append("<input id='test' data-validator='testValidatorMethod' data-validation-dependents='dependent' data-validator-event='custom'>")
    .append("<input id='dependent' data-validator='testValidatorMethod'>");

ValidatorsManager.updateConfigurationCallback({
    "validators": {
        "testValidatorMethod": {
            "dependencies": [],
            "validator": function (el, input, callback) {
                const v = input.val();
                if (v === "GOOD") {
                    callback();
                } else {
                    callback(["DOES NOT PASS"]);
                }
            }
        }
    }
});

describe("ValidatorsManager Functions", () => {
    it("bindValidators", () => {
        const callbackFunction = sinon.spy();
        const extraAfterValidatorsFunction = sinon.spy();

        sinon.stub(ValidatorsManager, "bindValidatorsForField");

        ValidatorsManager.afterBindValidators.push(extraAfterValidatorsFunction);

        ValidatorsManager.bindValidators(container, callbackFunction);

        expect(ValidatorsManager.bindValidatorsForField.callCount,
            "bindValidatorsForField called once for each element in provided container")
            .toBe(container.find(":input").length);

        expect(callbackFunction.calledOnce,
            "callback function provided to bindValidators invoked once").toBe(true);

        expect(extraAfterValidatorsFunction.calledOnce &&
            extraAfterValidatorsFunction.calledWithExactly(container, callbackFunction),
        "function injected into afterBindValidators called once (with expected arguments) after bindValidators")
            .toBe(true);

        // remove the spy we pushed onto the end
        ValidatorsManager.afterBindValidators.splice(-1);

        // don't stub the internal method after test is complete
        ValidatorsManager.bindValidatorsForField.restore();
    });

    it("bindValidatorsForField", () => {
        const field = container.find("#test");

        ValidatorsManager.bindValidatorsForField(container, field);

        const eventsList = _.sortBy(_.keys($._data(field[0]).events));

        expect(_.isEqual(eventsList, ["blur", "change", "custom", "keyup", "paste", "validate"]),
            "custom and default events all bound to specified input field").toBe(true);
    });

    it("evaluateValidator", () => {
        const field = container.find("#test");

        field.val("");

        return ValidatorsManager.evaluateValidator("testValidatorMethod", field, container)
            .then((failures) => {
                expect(failures.length === 1 && failures[0] === "DOES NOT PASS").toBe(true);
            })
            .then(() => {
                field.val("GOOD");
                return ValidatorsManager.evaluateValidator("testValidatorMethod", field, container);
            })
            .then((failures) => {
                expect(!failures).toBe(true);
            });
    });

    it("evaluateDependentFields", () => {
        const primary = container.find("#test");
        const dependent = container.find("#dependent");
        let failureMessages = [];

        primary.val("GOOD");
        dependent.val("BAD");

        container
            .on("validationSuccessful", () => {
                failureMessages = [];
            })
            .on("validationFailed", (event, data) => {
                failureMessages = data.failures;
            });

        return ValidatorsManager.evaluateDependentFields(primary, container)
            .then(() => {
                expect(dependent.attr("data-validation-status")).toBe("error");
                expect(failureMessages.length === 1 && failureMessages[0] === "DOES NOT PASS").toBe(true);
            })
            .then(() => {
                dependent.val("GOOD");
                return ValidatorsManager.evaluateDependentFields(primary, container);
            })
            .then(() => {
                expect(dependent.attr("data-validation-status")).toBe("ok");
                expect(failureMessages.length).toBe(0);
            });
    });

    it("evaluateAllValidatorsForField", () => {
        const primary = container.find("#test");
        const dependent = container.find("#dependent");
        let failureMessages = [];

        primary.val("BAD");
        dependent.val("BAD");

        container
            .on("validationSuccessful", () => {
                failureMessages = [];
            })
            .on("validationFailed", (event, data) => {
                failureMessages = data.failures;
            });

        return ValidatorsManager.evaluateAllValidatorsForField(primary, container)
            .then(() => {
                expect(primary.attr("data-validation-status")).toBe("error");
                expect(dependent.attr("data-validation-status")).toBe("error");
                expect(failureMessages.length === 1 && failureMessages[0] === "DOES NOT PASS").toBe(true);
            })
            .then(() => {
                primary.val("GOOD");
                return ValidatorsManager.evaluateAllValidatorsForField(primary, container);
            })
            .then(() => {
                expect(primary.attr("data-validation-status")).toBe("ok");
                expect(dependent.attr("data-validation-status")).toBe("error");
                expect(failureMessages.length === 1 && failureMessages[0] === "DOES NOT PASS").toBe(true);
            })
            .then(() => {
                dependent.val("GOOD");
                return ValidatorsManager.evaluateAllValidatorsForField(primary, container);
            })
            .then(() => {
                expect(primary.attr("data-validation-status")).toBe("ok");
                expect(dependent.attr("data-validation-status")).toBe("ok");
                expect(failureMessages.length).toBe(0);
            });
    });
});
