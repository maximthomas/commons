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
 */

module.exports = function (grunt) {
    grunt.loadNpmTasks("grunt-eslint");

    grunt.initConfig({
        eslint: {
            /**
             * Check the JavaScript source code for common mistakes and style issues.
             */
            lint: {
                src: [
                    "src/main/js/**/*.js",
                    // The emit configuration. It was outside every lint target until task 3.3;
                    // it carries its own .eslintrc for parser and env and inherits the style
                    // rules from the root config. build/*.js only — the *.mjs harness and stubs
                    // use ES module syntax and top-level await, which eslint 4.18.2 cannot parse.
                    // See build/.eslintrc.js.
                    "build/*.js",
                    // The shared emitter, which lives outside both Maven modules and so inherits
                    // neither module's config — it carries its own root .eslintrc.js. Both
                    // modules lint it, and because eslint resolves config from the linted file's
                    // directory both runs agree, so whichever is built first catches drift.
                    "../build/*.js"
                    //"src/test/js/**/*.js"
                ],
                options: {
                    format: require.resolve("eslint-formatter-warning-summary")
                }
            }
        }
    });

    /**
     * Emit the dual-build npm package into target/npm.
     *
     * The AMD sources under src/main/js stay the single source of truth; the ES module tree is
     * generated from them by the emitter shared with ui/commons. Everything is written under
     * target/, never beside the sources, so the Maven www zip is untouched — it assembles
     * target/classes, which Maven fills from the two <resource> directories (src/main/js,
     * src/main/resources) and nothing else.
     *
     * This runs inside the `build` task, which frontend-maven-plugin binds to the `compile`
     * phase (commons/ui/pom.xml). maven-resources-plugin, maven-dependency-plugin and
     * maven-assembly-plugin all bind to `package`, so the emit is already ordered ahead of them
     * and needs no phase juggling.
     */
    grunt.registerTask("npm-package", "Emit the ESM and AMD builds into target/npm", function () {
        var done = this.async();

        grunt.util.spawn({
            cmd: process.execPath,
            args: [require.resolve("./build/npm-package.js")],
            opts: { cwd: __dirname, stdio: "inherit" }
        }, function (error, result, code) {
            done(code === 0);
        });
    });

    /**
     * Import the emitted ES module tree and check the contract with the ui-commons peer.
     *
     * This runs because the emit script cannot catch what it is for. Everything npm-package.js
     * asserts is textual — counts, paths, no surviving loader API — and all of it passes on a
     * tree that cannot resolve a single commons id, which is what 9 of these 14 modules need.
     *
     * It needs the sibling module built: the peer is unresolvable from any registry until task
     * 3.11, so the harness resolves it from node_modules if present and from
     * ../commons/target/npm/esm otherwise. It also needs Node >= 20.6 for `module.register`;
     * ui/pom.xml pins v20.12.2.
     *
     * Deliberately NOT in the `build` task, for the reason ui/commons records: `build` runs at
     * `compile` and the www zip is assembled at `package`, so a failure here would block the zip
     * — and design.md makes that zip phase 1's rollback channel. A rollback channel the new work
     * can break is not a rollback channel. So the ESM checks run in `verify` (and as
     * `npm run verify:esm`), which is the default task and what task 3.5's CI job invokes, while
     * Maven's `grunt build` stops at the emit.
     *
     * The cost of that split, recorded so it is not discovered later: `mvn install` alone does not
     * prove the ES module tree imports. Whoever adds the CI job owns making `verify` run on every
     * change.
     */
    grunt.registerTask("verify-esm", "Import the emitted ES module build and check it", function () {
        var done = this.async();

        grunt.util.spawn({
            cmd: process.execPath,
            args: [require.resolve("./build/verify-esm.mjs")],
            opts: { cwd: __dirname, stdio: "inherit" }
        }, function (error, result, code) {
            done(code === 0);
        });
    });

    // `build` is what frontend-maven-plugin runs at `compile`, and it is kept to the steps that
    // produce the artifacts — so the www zip cannot be held hostage by an ESM *import* failure,
    // which is the class of breakage the ESM checks exist to catch and the one most likely to need
    // a DOM, a network or a toolchain the Maven build does not have.
    //
    // It is not full insulation and should not be read as such: `npm-package` runs here too, and
    // its licence, count and payload-record assertions fail the build at `compile`, before
    // `package`. Adding a template without rerunning `npm run update:payload-record` does stop the
    // zip. That is deliberate — a payload record that can drift silently is worth nothing to task
    // 3.6 — but it is the reason this split is narrower than it looks.
    //
    // `verify` is the full check and the default, so a bare `grunt` locally still runs everything.
    /**
     * Import every module of the emitted ES module tree under a DOM.
     *
     * Task 3.5, closing what verify-esm names and declines to do. Ten of this package's fourteen
     * modules cannot be imported under bare Node — commons' util/UIUtils assigns `$.fn.emptySelect`
     * at module scope and jQuery 3 without a `window` yields a factory with no `.fn` — and
     * build/verify-esm.mjs says the fix is jsdom and belongs here rather than to a stub grown until
     * the import succeeds. src/test/vitest is that run; vitest.config.mjs has the rest.
     *
     * In `verify` and not `build`, for the same reason verify-esm is: `build` runs at Maven's
     * `compile` and the www zip is assembled at `package`, so anything in `build` can stop the zip
     * — and design.md makes that zip phase 1's rollback channel.
     */
    grunt.registerTask("test-esm", "Import the emitted ES module build under a DOM", function () {
        var done = this.async();

        grunt.util.spawn({
            cmd: process.execPath,
            args: [require.resolve("vitest/vitest.mjs"), "run"],
            opts: { cwd: __dirname, stdio: "inherit" }
        }, function (error, result, code) {
            done(code === 0);
        });
    });

    grunt.registerTask("build", ["eslint", "npm-package"]);
    grunt.registerTask("verify", ["build", "verify-esm", "test-esm"]);
    grunt.registerTask("default", "verify");
};
