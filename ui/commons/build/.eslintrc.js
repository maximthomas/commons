/*
 * Lint settings for the build scripts, which run in Node rather than in a browser or an AMD
 * loader. Style and error rules are inherited from the root config.
 *
 * Only the CommonJS *.js files here are linted. The *.mjs verification harness uses top-level
 * await, which the pinned eslint 4.18.2 parser cannot read at any ecmaVersion; moving the lint
 * toolchain forward belongs with task 3.5, which owns the CI job. Until then those files are
 * excluded by the glob in Gruntfile.js rather than by a disable comment, so the gap is visible
 * in one place instead of scattered through the files it affects.
 */

module.exports = {
    env: {
        amd: false,
        browser: false,
        node: true,
        es6: true
    },
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: "script"
    }
};
