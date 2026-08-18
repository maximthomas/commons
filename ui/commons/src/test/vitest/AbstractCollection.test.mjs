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
 * ES module port of src/test/qunit/AbstractCollection.js — same tests, same names, same order,
 * run against the emitted ES module build. See vitest.config.mjs for why both files exist.
 */

import { describe, it, expect } from "vitest";
import $ from "jquery";
import sinon from "sinon";
import AbstractCollection from "org/forgerock/commons/ui/common/main/AbstractCollection";
import ServiceInvoker from "org/forgerock/commons/ui/common/main/ServiceInvoker";

describe("AbstractCollection Functions", () => {
    it("query operations", () => {
        const testCollection = new AbstractCollection();
        let restCallArg;

        testCollection.url = "/crestResource?_queryFilter=true";

        sinon.stub(ServiceInvoker, "restCall").callsFake((options) => {
            const response = {
                "result": [{
                    "_id": 1,
                    "givenName": "Boaty",
                    "sn": "McBoatface"
                }, {
                    "_id": 2,
                    "givenName": "Testy",
                    "sn": "Testerton"
                }],
                "resultCount": 2,
                "pagedResultsCookie": "2",
                "totalPagedResultsPolicy": "EXACT",
                "totalPagedResults": 5
            };
            // backbone uses the success handler associated with the fetch request to invoke the parse method
            if (options.success) {
                options.success(response);
            }
            return $.Deferred().resolve(response);
        });

        testCollection.setPageSize(2, { fetch: false });
        testCollection.setSorting("givenName");
        testCollection.setPagingType("cookie");
        testCollection.setTotalPagedResultsPolicy("EXACT");

        return testCollection.getFirstPage().then(() => {
            expect(ServiceInvoker.restCall.callCount, "Only one REST call produced").toBe(1);
            restCallArg = ServiceInvoker.restCall.args[0][0]; // first invocation, first argument
            expect(testCollection.length, "collection contains two records from the backend").toBe(2);
            expect(testCollection.where({ givenName: "Boaty" }).length,
                "able to find expected model content in collection").toBe(1);
            expect(testCollection.hasNext(), "response with cookie indicates that hasNext is true").toBe(true);
            expect(testCollection.state.totalRecords,
                "Total records correctly populated in collection state").toBe(5);
            expect(testCollection.state.totalPages,
                "Total pages correctly populated in collection state").toBe(3);
            expect(restCallArg.url, "correct url used to query backend").toBe("/crestResource");
            expect(restCallArg.data, "correct data submitted to backend for first page")
                .toBe("_queryFilter=true&_pageSize=2&_sortKeys=givenName&_totalPagedResultsPolicy=EXACT");
        }).then(() => {
            testCollection.setSorting("givenName", 1);
            return testCollection.getFirstPage();
        }).then(() => {
            restCallArg = ServiceInvoker.restCall.args[1][0]; // second invocation, first argument
            expect(restCallArg.data, "correct data submitted to backend for descending sortKey")
                .toBe("_queryFilter=true&_pageSize=2&_sortKeys=-givenName&_totalPagedResultsPolicy=EXACT");
        }).then(() => testCollection.getNextPage()).then(() => {
            restCallArg = ServiceInvoker.restCall.args[2][0]; // third invocation, first argument
            expect(restCallArg.data, "correct data submitted to backend for next page")
                .toBe("_queryFilter=true&_pageSize=2&_sortKeys=-givenName" +
                    "&_totalPagedResultsPolicy=EXACT&_pagedResultsCookie=2");
        }).then(() => {
            ServiceInvoker.restCall.restore();
        });
    });
});
