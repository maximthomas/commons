<?xml version="1.0" encoding="UTF-8"?>
<!--
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
 * Copyright 2012-2014 ForgeRock AS
 * Portions copyright 2024 3A Systems LLC.
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
 xmlns:d="http://docbook.org/ns/docbook" exclude-result-prefixes="d">
 <xsl:import href="urn:docbkx:stylesheet" />
 <xsl:preserve-space
 elements="d:computeroutput d:programlisting d:screen d:userinput"/>

 <xsl:template match="d:programlisting">
  <xsl:choose>
   <xsl:when test="@language='aci'">
    <pre><code class="language-aci"><xsl:value-of select="." /></code></pre>
   </xsl:when>
   <xsl:when test="@language='csv'">
    <pre><code class="language-csv"><xsl:value-of select="." /></code></pre>
   </xsl:when>
   <xsl:when test="@language='html'">
    <pre><code class="language-html"><xsl:value-of select="." /></code></pre>
   </xsl:when>
   <xsl:when test="@language='http'">
    <pre><code class="language-http"><xsl:value-of select="." /></code></pre>
   </xsl:when>
   <xsl:when test="@language='ini'">
    <pre><code class="language-ini"><xsl:value-of select="." /></code></pre>
   </xsl:when>
   <xsl:when test="@language='java'">
    <pre><code class="language-java"><xsl:value-of select="." /></code></pre>
   </xsl:when>
   <xsl:when test="@language='javascript'">
    <pre><code class="language-java"><xsl:value-of select="." /></code></pre>
   </xsl:when>
   <xsl:when test="@language='ldif'">
    <pre><code class="language-ldif"><xsl:value-of select="." /></code></pre>
   </xsl:when>
   <xsl:when test="@language='shell'">
    <pre><code class="language-shell"><xsl:value-of select="." /></code></pre>
   </xsl:when>
   <xsl:when test="@language='xml'">
    <pre><code class="language-xml"><xsl:value-of select="." /></code></pre>
   </xsl:when>
   <xsl:otherwise>
    <pre><xsl:value-of select="." /></pre>
   </xsl:otherwise>
  </xsl:choose>
 </xsl:template>

 <xsl:template match="d:screen">
  <div class="screen">
     <pre>
      <xsl:apply-templates mode="screen"/>
     </pre>
  </div>
 </xsl:template>

 <xsl:template match="*" mode="screen"><xsl:value-of select="."/></xsl:template>

 <xsl:template match="d:replaceable" mode="screen">
  <em><strong><xsl:apply-templates mode="screen"/></strong></em>
 </xsl:template>

 <xsl:template match="d:userinput" mode="screen">
  <strong><xsl:apply-templates mode="screen"/></strong>
 </xsl:template>

 <xsl:template match="d:computeroutput" mode="screen">
  <em><xsl:apply-templates mode="screen"/></em>
 </xsl:template>

 <xsl:template name="nongraphical.admonition">
  <div>
   <xsl:call-template name="common.html.attributes">
    <xsl:with-param name="inherit" select="1"/>
   </xsl:call-template>
   <xsl:call-template name="id.attribute"/>
   <xsl:if test="$admon.style != '' and $make.clean.html = 0">
    <xsl:attribute name="style">
     <xsl:value-of select="$admon.style"/>
    </xsl:attribute>
   </xsl:if>

   <xsl:if test="$admon.textlabel != 0 or title or info/title">
    <h4 class="title">
     <xsl:call-template name="anchor"/>
     <xsl:apply-templates select="." mode="object.title.markup"/>
    </h4>
   </xsl:if>

   <xsl:apply-templates/>
  </div>
 </xsl:template>

 <xsl:param name="make.clean.html" select="1" />
 <xsl:param name="docbook.css.link" select="0" />
 <xsl:param name="docbook.css.source" select="0" />
 <xsl:param name="custom.css.source">coredoc.css.xml</xsl:param>

 <xsl:param name="admon.style">
  <xsl:value-of select="string('font-style: italic;')" />
 </xsl:param>
 <xsl:param name="default.table.frame">none</xsl:param>
 <xsl:param name="default.table.rules">none</xsl:param>
 <xsl:param name="table.cell.border.thickness">0pt</xsl:param>

 <xsl:param name="chunk.section.depth" select="0" />
 <xsl:param name="chunker.output.encoding">UTF-8</xsl:param>
 <xsl:param name="generate.legalnotice.link" select="1" />
 <xsl:param name="root.filename">index</xsl:param>
 <xsl:param name="use.id.as.filename" select="0" />
 <xsl:param name="html.longdesc" select="0"></xsl:param>
 <xsl:param name="autotoc.label.in.hyperlink" select="0"></xsl:param>

 <xsl:param name="generate.toc">
  appendix  nop
  article/appendix  nop
  article   nop
  book      toc
  chapter   nop
  part      nop
  preface   nop
  qandadiv  nop
  qandaset  nop
  reference nop
  sect1     nop
  sect2     nop
  sect3     nop
  sect4     nop
  sect5     nop
  section   nop
  set       nop
 </xsl:param>
 <xsl:param name="generate.section.toc.level" select="1" />
 <xsl:param name="toc.section.depth" select="2" />
 <xsl:param name="toc.max.depth" select="1" />
 <xsl:param name="generate.meta.abstract" select="1" />
 <xsl:param name="suppress.navigation" select="1"></xsl:param>
 <xsl:param name="index.links.to.section" select="0"></xsl:param>
 <xsl:param name="use.extensions" select="1" />
 <xsl:param name="make.graphic.viewport" select="0"></xsl:param>
 <xsl:param name="generate.index" select="0"></xsl:param>


</xsl:stylesheet>
