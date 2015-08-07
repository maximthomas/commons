/*
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
 * Copyright 2015 ForgeRock AS.
 */

package org.forgerock.audit;

import static java.util.Arrays.asList;
import static org.assertj.core.api.Assertions.*;
import static org.forgerock.json.JsonValue.*;
import static org.mockito.Matchers.*;
import static org.mockito.Mockito.*;

import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.forgerock.audit.events.handlers.AuditEventHandler;
import org.forgerock.audit.events.handlers.impl.PassThroughAuditEventHandler;
import org.forgerock.json.JsonValue;
import org.forgerock.json.resource.BadRequestException;
import org.forgerock.json.resource.CreateRequest;
import org.forgerock.json.resource.InternalServerErrorException;
import org.forgerock.json.resource.NotSupportedException;
import org.forgerock.json.resource.QueryRequest;
import org.forgerock.json.resource.QueryResourceHandler;
import org.forgerock.json.resource.QueryResult;
import org.forgerock.json.resource.ReadRequest;
import org.forgerock.json.resource.Requests;
import org.forgerock.json.resource.Resource;
import org.forgerock.json.resource.ResourceException;
import org.forgerock.http.context.RootContext;
import org.forgerock.http.context.ServerContext;
import org.forgerock.util.promise.Promise;
import org.forgerock.util.promise.Promises;
import org.forgerock.util.promise.ResultHandler;
import org.forgerock.util.test.assertj.AssertJPromiseAssert;

import org.mockito.ArgumentCaptor;
import org.testng.annotations.Test;

@SuppressWarnings({"javadoc", "rawtypes", "unchecked" })
public class AuditServiceTest {

    private static final String QUERY_HANDLER_NAME = "pass-through";

    @Test
    public void testRegisterInjectEventMetaData() throws Exception {
        final AuditService auditService = getAuditService(QUERY_HANDLER_NAME);
        AuditEventHandler<?> auditEventHandler = mock(AuditEventHandler.class);
        final ArgumentCaptor<Map> auditEventMetaDataCaptor = ArgumentCaptor.forClass(Map.class);

        auditService.register(auditEventHandler, "mock", Collections.singleton("access"));
        verify(auditEventHandler).setAuditEventsMetaData(auditEventMetaDataCaptor.capture());

        Map<String, JsonValue> auditEventMetaData = auditEventMetaDataCaptor.getValue();
        assertThat(auditEventMetaData).containsKey("access");
        JsonValue accessMetaData = auditEventMetaData.get("access");
        assertThat(accessMetaData.isDefined("schema")).isTrue();
    }

    @Test
    public void testExposesListOfKnownTopics() throws Exception {
        // Given
        final AuditService auditService = getAuditService(QUERY_HANDLER_NAME);

        // When
        Set<String> knownTopics = auditService.getKnownTopics();

        // Then
        assertThat(knownTopics).containsOnly("access", "activity", "authentication", "config");
    }

    @Test
    public void testRegisterInjectDependencyProvider() throws Exception {
        final AuditService auditService = getAuditService(QUERY_HANDLER_NAME);
        DependencyProvider dependencyProvider = mock(DependencyProvider.class);
        when(dependencyProvider.getDependency(Integer.class)).thenReturn(4);
        final ArgumentCaptor<DependencyProvider> dependencyProviderArgumentCaptor =
                ArgumentCaptor.forClass(DependencyProvider.class);
        AuditEventHandler<?> auditEventHandler = mock(AuditEventHandler.class);

        auditService.registerDependencyProvider(dependencyProvider);
        auditService.register(auditEventHandler, "mock", Collections.singleton("access"));

        verify(auditEventHandler).setDependencyProvider(dependencyProviderArgumentCaptor.capture());
        DependencyProvider provider = dependencyProviderArgumentCaptor.getValue();
        assertThat(provider.getDependency(Integer.class)).isEqualTo(4);
    }

    @Test(expectedExceptions = ClassNotFoundException.class)
    public void testDependencyNotFound() throws Exception {
        final AuditService auditService = getAuditService(QUERY_HANDLER_NAME);
        DependencyProvider dependencyProvider = new DependencyProviderBase();
        final ArgumentCaptor<DependencyProvider> dependencyProviderArgumentCaptor =
                ArgumentCaptor.forClass(DependencyProvider.class);
        AuditEventHandler<?> auditEventHandler = mock(AuditEventHandler.class);

        auditService.registerDependencyProvider(dependencyProvider);
        auditService.register(auditEventHandler, "mock", Collections.singleton("access"));

        verify(auditEventHandler).setDependencyProvider(dependencyProviderArgumentCaptor.capture());
        DependencyProvider provider = dependencyProviderArgumentCaptor.getValue();
        provider.getDependency(Integer.class);
    }

    @Test
    public void testCreatingAuditLogEntry() throws Exception {
        final AuditService auditService = getAuditService(QUERY_HANDLER_NAME);
        auditService.register(new PassThroughAuditEventHandler(), QUERY_HANDLER_NAME, Collections.singleton("access"));

        final CreateRequest createRequest = makeCreateRequest();

        //when
        Promise<Resource, ResourceException> promise =
                auditService.handleCreate(new ServerContext(new RootContext()), createRequest);

        //then
        assertThat(auditService.isAuditing("access")).isTrue();
        AssertJPromiseAssert.assertThat(promise).succeeded()
                .withObject()
                .isInstanceOf(Resource.class);

        // TODO-brmiller should use AssertJResourceAssert
        final Resource resource = promise.get();
        assertThat(resource).isNotNull();
        assertThat(resource.getContent().asMap()).isEqualTo(createRequest.getContent().asMap());
    }

    @Test
    public void testHandleCreateIgnoresEventsNotMappedToHandler() throws Exception {
        //given
        AuditService auditService = new AuditService();
        CreateRequest createRequest = makeCreateRequest("activity");

        //when
        Promise<Resource, ResourceException> promise =
                auditService.handleCreate(new ServerContext(new RootContext()), createRequest);

        //then
        assertThat(auditService.isAuditing("activity")).isFalse();
        AssertJPromiseAssert.assertThat(promise).succeeded()
                .withObject()
                .isInstanceOf(Resource.class);

        // TODO-brmiller should use AssertJResourceAssert
        final Resource resource = promise.get();
        assertThat(resource).isNotNull();
        assertThat(resource.getContent().asMap()).isEqualTo(createRequest.getContent().asMap());
    }

    @Test
    public void testHandleCreateReturnsNotSupportedIfEventTopicIsNotKnown() {
        //given
        AuditService auditService = new AuditService();
        CreateRequest createRequest = makeCreateRequest("unknownTopic");
        ResultHandler<Resource> resultHandler = mockResultHandler(Resource.class);

        //when
        Promise<Resource, ResourceException> promise =
                auditService.handleCreate(new ServerContext(new RootContext()), createRequest);

        //then
        assertThat(auditService.isAuditing("unknownTopic")).isFalse();
        AssertJPromiseAssert.assertThat(promise).failedWithException()
                .isInstanceOf(ResourceException.class);
    }

    @Test
    public void testReadingAuditLogEntry() throws Exception {
        //given
        final AuditService auditService = getAuditService("query-handler");

        AuditEventHandler<?> queryAuditEventHandler = mock(AuditEventHandler.class, "queryAuditEventHandler");
        auditService.register(queryAuditEventHandler, "query-handler", Collections.singleton("access"));

        AuditEventHandler<?> auditEventHandler = mock(AuditEventHandler.class, "auditEventHandler");
        auditService.register(auditEventHandler, "another-handler", Collections.singleton("access"));
        reset(auditEventHandler, queryAuditEventHandler); // So the verify assertions below can work.

        final ReadRequest readRequest = Requests.newReadRequest("access", "1234");
        ResultHandler<Resource> readResultHandler = mockResultHandler(Resource.class, "readResultHandler");
        ServerContext context = new ServerContext(new RootContext());

        //when
        Promise<Resource, ResourceException> promise =
                auditService.handleRead(context, readRequest);

        //then
        verify(queryAuditEventHandler).readInstance(same(context),
<<<<<<< HEAD
                eq("1234"),
                same(readRequest),
                same(readResultHandler));
=======
                                                    eq("1234"),
                                                    same(readRequest));
>>>>>>> CREST3-ify:
        verifyZeroInteractions(auditEventHandler);
    }

    @Test
    public void testDeleteAuditLogEntry() throws ResourceException {
        final AuditService auditService = getAuditService(QUERY_HANDLER_NAME);

        //when
        Promise<Resource, ResourceException> promise =
                auditService.handleDelete(
                        new ServerContext(new RootContext()),
                        Requests.newDeleteRequest("_id"));

        //then
        AssertJPromiseAssert.assertThat(promise).failedWithException()
                .isInstanceOf(NotSupportedException.class);
    }

    @Test
    public void testPatchAuditLogEntry() throws ResourceException {
        final AuditService auditService = getAuditService(QUERY_HANDLER_NAME);

        //when
        Promise<Resource, ResourceException> promise =
                auditService.handlePatch(
                        new ServerContext(new RootContext()),
                        Requests.newPatchRequest("_id"));

        //then
        AssertJPromiseAssert.assertThat(promise).failedWithException()
                .isInstanceOf(NotSupportedException.class);
    }

    @Test
    public void testUpdateAuditLogEntry() throws ResourceException {
        final AuditService auditService = getAuditService(QUERY_HANDLER_NAME);

        //when
        Promise<Resource, ResourceException> promise =
                auditService.handleUpdate(
                        new ServerContext(new RootContext()),
                        Requests.newUpdateRequest("_id", new JsonValue(new HashMap<String, Object>())));

        //then
        AssertJPromiseAssert.assertThat(promise).failedWithException()
                .isInstanceOf(NotSupportedException.class);
    }

    @Test
    public void testUnknownAction() throws ResourceException {
        final AuditService auditService = getAuditService(QUERY_HANDLER_NAME);

        //when
<<<<<<< HEAD
        auditService.handleAction(
                new ServerContext(new RootContext()),
                Requests.newActionRequest("", "unknownAction"),
                resultHandler
        );

        //then
        verify(resultHandler, never()).handleResult(resourceCaptor.capture());
        verify(resultHandler).handleError(resourceExceptionCaptor.capture());

        assertThat(resourceExceptionCaptor.getValue()).isInstanceOf(BadRequestException.class);
=======
        Promise<JsonValue, ResourceException> promise =
                auditService.handleAction(
                        new ServerContext(new RootContext()),
                        Requests.newActionRequest("_id", "action"));

        //then
        AssertJPromiseAssert.assertThat(promise).failedWithException()
                .isInstanceOf(NotSupportedException.class);
>>>>>>> CREST3-ify:
    }

    @Test
    public void testQueryOnAuditLogEntry() throws Exception {
        final AuditService auditService = getAuditService(QUERY_HANDLER_NAME);
        final AuditEventHandler auditEventHandler = mock(AuditEventHandler.class);
        final Promise<QueryResult, ResourceException> emptyPromise = Promises.newResultPromise(new QueryResult());
        auditService.register(auditEventHandler, QUERY_HANDLER_NAME, Collections.singleton("access"));
        when(auditEventHandler.queryCollection(
                any(ServerContext.class), any(QueryRequest.class), any(QueryResourceHandler.class)))
            .thenReturn(emptyPromise);

        //when
        Promise<QueryResult, ResourceException> promise = auditService.handleQuery(
                new ServerContext(new RootContext()),
                Requests.newQueryRequest("access"),
                mock(QueryResourceHandler.class));

        //then
        verify(auditEventHandler).queryCollection(
                any(ServerContext.class), any(QueryRequest.class), any(QueryResourceHandler.class));
        AssertJPromiseAssert.assertThat(promise).isSameAs(emptyPromise);
    }

    @Test
    public void testMandatoryFieldTransactionId() throws ResourceException {
        final AuditService auditService = getAuditService(QUERY_HANDLER_NAME);

        // No transactionId in the JSON content
        final JsonValue content = json(object(field("_id", "_id"),
                field("timestamp", "timestamp")));

        final CreateRequest createRequest = Requests.newCreateRequest("access", content);

        //when
        Promise<Resource, ResourceException> promise =
                auditService.handleCreate(new ServerContext(new RootContext()), createRequest);

        //then
        AssertJPromiseAssert.assertThat(promise).failedWithException()
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    public void testMandatoryFieldTimestamp() throws ResourceException {
        final AuditService auditService = getAuditService(QUERY_HANDLER_NAME);

        // No timestamp in the JSON content
        final JsonValue content = json(object(field("_id", "_id"),
                                              field("transactionId", "transactionId")));

        final CreateRequest createRequest = Requests.newCreateRequest("access", content);
        final ResultHandler<Resource> resultHandler = mockResultHandler(Resource.class);

        final ArgumentCaptor<ResourceException> resourceExceptionCaptor =
                ArgumentCaptor.forClass(ResourceException.class);

        //when
        Promise<Resource, ResourceException> promise =
                auditService.handleCreate(new ServerContext(new RootContext()), createRequest);

        //then
        AssertJPromiseAssert.assertThat(promise).failedWithException()
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    public void testAdditionalEventTypes() throws Exception {
        JsonValue additionalEventTypes = json(object(field("foo", "bar")));
        //given
        final AuditService auditService =
                getAuditServiceWithAdditionalEventTypes(QUERY_HANDLER_NAME, additionalEventTypes);

        PassThroughAuditEventHandler auditEventHandler = new PassThroughAuditEventHandler();
        // Only interested about the foo events.
        auditService.register(auditEventHandler, "pass-through", Collections.singleton("foo"));

        final CreateRequest createRequestAccess = makeCreateRequest("foo");

        //when
        Promise<Resource, ResourceException> promise =
                auditService.handleCreate(new ServerContext(new RootContext()), createRequestAccess);

        //then
        AssertJPromiseAssert.assertThat(promise).succeeded()
                .withObject()
                .isInstanceOf(Resource.class);

        // TODO-brmiller should use AssertJResourceAssert
        final Resource resource = promise.get();
        assertThat(resource).isNotNull();
        assertThat(resource.getContent().asMap()).isEqualTo(createRequestAccess.getContent().asMap());
    }

    private AuditService getAuditService(String queryHandlerName) throws ResourceException {
        return getAuditServiceWithAdditionalEventTypes(queryHandlerName, json(object()));
    }

    private AuditService getAuditServiceWithAdditionalEventTypes(
            String queryHandlerName, JsonValue additionalEventTypes) throws ResourceException {
        AuditServiceConfiguration config = new AuditServiceConfiguration();
        config.setHandlerForQueries(queryHandlerName);
        config.setAvailableAuditEventHandlers(asList("org.forgerock.audit.events.handlers.impl.PassThroughAuditEventHandelr"));
        AuditService auditService = new AuditService(json(object()), additionalEventTypes);
        auditService.configure(config);
        return auditService;
    }

    private CreateRequest makeCreateRequest() {
        return makeCreateRequest("access");
    }

    private CreateRequest makeCreateRequest(String event) {
        final JsonValue content = json(
                object(
                        field("_id", "_id"),
                        field("timestamp", "timestamp"),
                        field("transactionId", "transactionId"))
        );
        return Requests.newCreateRequest(event, content);
    }

    private static <T> ResultHandler<T> mockResultHandler(Class<T> type) {
        return mock(ResultHandler.class);
    }

    private static <T> ResultHandler<T> mockResultHandler(Class<T> type, String name) {
        return mock(ResultHandler.class, name);
    }
}
