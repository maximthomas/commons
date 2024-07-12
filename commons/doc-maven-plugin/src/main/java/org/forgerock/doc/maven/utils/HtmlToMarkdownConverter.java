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
 * Copyright 2024 3A Systems LLC.
 */

package org.forgerock.doc.maven.utils;

import com.vladsch.flexmark.html2md.converter.FlexmarkHtmlConverter;
import com.vladsch.flexmark.parser.Parser;
import com.vladsch.flexmark.util.data.MutableDataSet;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.TextNode;
import org.jsoup.select.Elements;

import java.util.Collections;

public class HtmlToMarkdownConverter {
    String imagePrefix;
    public HtmlToMarkdownConverter(String imagePrefix) {
        this.imagePrefix = imagePrefix;
    }

    public String htmlToMarkdown(String html) {
        Document doc = Jsoup.parse(html);

        convertFootNotes(doc);
        removeAnchors(doc);
        fixImagesPath(doc);

        String content = doc.toString();
        MutableDataSet options = new MutableDataSet()
                .set(Parser.EXTENSIONS, Collections.emptySet())
                .set(FlexmarkHtmlConverter.PRE_CODE_PRESERVE_EMPHASIS, true)
                .set(FlexmarkHtmlConverter.SKIP_CHAR_ESCAPE, true)
                .set(FlexmarkHtmlConverter.EXTRACT_AUTO_LINKS, false);
        return FlexmarkHtmlConverter.builder(options).build().convert(content);
    }


    private void convertFootNotes(Document doc) {
        Elements footnotes = doc.select("a.footnote");
        footnotes.forEach( fn -> {
            String txt = fn.text();
            String newText = txt.replace("[","[^");
            TextNode node = new TextNode(newText);
            fn.replaceWith(node);
        });
        footnotes = doc.select("div.footnote");
        footnotes.forEach( fn -> {
            String txt = fn.text();
            String newText = txt.replace("[","[^")
                    .replace("]", "]:");
            Element p = new Element("p");
            p.text(newText);
            fn.replaceWith(p);
        });
    }

    private void removeAnchors(Document doc) {
        Elements elements = doc.select("a[name]");
        elements.remove();
    }

    private void fixImagesPath(Document doc) {
        Elements images = doc.select("img[src^='images/']");
        images.forEach(img -> {
            String src = img.attr("src");
            src = src.replace("images", imagePrefix);
            img.attr("src", src);
        });
    }
}