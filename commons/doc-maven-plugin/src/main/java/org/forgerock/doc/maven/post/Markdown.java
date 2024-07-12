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

package org.forgerock.doc.maven.post;

import org.apache.commons.io.FileUtils;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.filefilter.FileFilterUtils;
import org.apache.maven.plugin.MojoExecutionException;
import org.forgerock.doc.maven.AbstractDocbkxMojo;
import org.forgerock.doc.maven.utils.HtmlToMarkdownConverter;

import java.io.File;
import java.io.FileFilter;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class Markdown {
    /**
     * The Mojo that holds configuration and related methods.
     */
    private AbstractDocbkxMojo m;

    /**
     * Constructor setting the Mojo that holds the configuration.
     *
     * @param mojo The Mojo that holds the configuration.
     */
    public Markdown(final AbstractDocbkxMojo mojo) {
        m = mojo;
    }

    /**
     * Post-processes Bootstrap formats.
     *
     * @throws MojoExecutionException Failed to post-process Bootstrap format.
     */
    public void execute() throws MojoExecutionException {


        final File mdDir = new File(m.getDocbkxOutputDirectory(), "markdown");
        final String chunkDirName = FilenameUtils.getBaseName(m.getDocumentSrcName());
        for (final String docName : m.getDocNames()) {

            final File docDir = new File(mdDir, docName);
            toMarkdown(docDir);
        }
    }

    void toMarkdown(File docDir) throws MojoExecutionException {
        FileFilter htmlFilter = FileFilterUtils.suffixFileFilter(".html");
        File[] files = docDir.listFiles(htmlFilter);

        if(files == null) {
            return;
        }

        for(File file : files) {
            if(skipFile(file)) {
                continue;
            }

            final String html;
            try {
                html = FileUtils.readFileToString(file, StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new MojoExecutionException("Failed to read file " + file.getAbsolutePath(), e);
            }
            String imagePrefix = "/img/".concat(m.getProjectName())
                    .concat("/")
                    .concat(docDir.getName()).toLowerCase();
            HtmlToMarkdownConverter converter = new HtmlToMarkdownConverter(imagePrefix);
            String markDown = converter.htmlToMarkdown(html);
            File markDownFile = new File(docDir.getPath().concat(File.separator).concat(file.getName()).replace(".html", ".md"));
            try(FileWriter writer = new FileWriter(markDownFile)) {
                writer.write(markDown);
            } catch (IOException e) {
                throw new MojoExecutionException("Failed to create markdown file:" + markDownFile.getAbsolutePath(), e);
            }
            file.delete();
        }
    }

    private boolean skipFile(File file) {
        if(file.getName().startsWith("index")) {
            return true;
        } else if(file.getName().startsWith("ln-")) {
            return true;
        }
        else if(file.getName().startsWith("ln-")) {
            return true;
        }
        return false;
    }

}
