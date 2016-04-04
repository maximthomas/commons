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
 * Copyright 2016 ForgeRock AS.
 */

package com.forgerock.api.annotations;

import org.forgerock.services.context.AbstractContext;

import com.forgerock.api.enums.Stability;

/**
 * The common details of an operation.
 */
public @interface Operation {
    /** The list of supported locales for the operation. */
    String[] locales() default {};
    /** The list of supported Context classes supported by the operation. */
    Class<? extends AbstractContext>[] contexts() default {};
    /** The list of possible errors for the operation. */
    Error[] errors() default {};
    /** The lis of additional parameters for the operation. */
    Parameter[] parameters() default {};
    /** The stability state for the operation. Defaults to {@code STABLE}. */
    Stability stability() default Stability.STABLE;
    /** A description of the operation */
    String description() default "";
}
