/*
 * Lint settings for the hand-written ES module sources.
 *
 * The root .eslintrc describes the AMD tree — env amd, ES5 parser — and rejects `import` and
 * `export` as syntax errors, which is why this tree went unlinted until task 3.2's review. Only
 * the parser and the environment are overridden here; every style and error rule is inherited
 * from the root config unchanged, so both trees are held to the same standard.
 *
 * A .js config rather than a plain .eslintrc so this comment can exist: eslint 4 validates the
 * config schema strictly and rejects an unknown top-level key, so the "//" note convention used
 * in package.json is a hard error here. It fails by refusing to lint, not by warning.
 */

module.exports = {
    env: {
        amd: false,
        browser: true,
        es6: true
    },
    parserOptions: {
        ecmaVersion: 6,
        sourceType: "module"
    }
};
