package org.forgerock.doc.maven.utils;

import org.apache.commons.io.FileUtils;
import org.junit.Test;

import java.io.File;
import java.nio.charset.StandardCharsets;

public class ConvertToMarkdownTest {
    @Test
    public void doTest() throws Exception {
        File testFile = new File(getClass().getResource("/unit/utils/html2md/source.html").toURI());

        String html = FileUtils.readFileToString(testFile, StandardCharsets.UTF_8);

        HtmlToMarkdownConverter converter = new HtmlToMarkdownConverter("/img/openam/admin-guide");

        String markdown = converter.htmlToMarkdown(html);

        System.err.println(markdown);

    }
}
