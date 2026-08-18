/*
 * Lint settings for the build scripts shared by ui/commons and ui/user.
 *
 * This directory sits outside both Maven modules, so it inherits nothing: ui/commons/.eslintrc
 * and ui/user/.eslintrc are both "root": true, and there is no config above ui/. That is why
 * this file is self-contained rather than a two-line override like the per-module
 * commons/build/.eslintrc.js and user/build/.eslintrc.js, which do inherit their module's style
 * rules. Without it eslint exits "couldn't find a configuration file" and the shared emitter
 * goes unlinted, which is the state task 3.3 briefly created by moving it up here.
 *
 * The error rules below are the set the two module configs agree on, copied verbatim. They
 * differ on exactly three things and none of them bear on a Node build script: ui/commons adds
 * the qunit env, the two set "new-cap" at different severities, and only ui/commons sets
 * "no-eval". Rather than pick a winner arbitrarily, those three are omitted here. If a module's
 * shared style rules change, this file does not follow automatically -- that is the cost of the
 * directory belonging to neither module.
 *
 * Both Gruntfiles lint ../build/*.js. Because eslint resolves config from the linted file's
 * own directory, both runs pick up this file and therefore agree; neither module owns the
 * verdict.
 *
 * Only the CommonJS *.js files here are linted. The *.mjs resolve hooks and stubs use ES module
 * syntax and top-level await, which the pinned eslint 4.18.2 parser cannot read at any
 * ecmaVersion; moving the lint toolchain forward belongs with task 3.5, which owns the CI job.
 * Until then they are excluded by the glob in each Gruntfile rather than by disable comments,
 * so the gap stays visible in one place.
 */

module.exports = {
    root: true,
    env: {
        amd: false,
        browser: false,
        node: true,
        es6: true
    },
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: "script"
    },
    rules: {
        "array-bracket-spacing": [2, "never"],
        "indent": [2, 4, {
            "SwitchCase": 1,
            "VariableDeclarator": 1
        }],
        "max-len": [2, 120, 4],
        "new-parens": 2,
        "no-alert": 2,
        "no-catch-shadow": 2,
        "no-duplicate-case": 2,
        "no-empty-character-class": 2,
        "no-extend-native": 2,
        "no-invalid-regexp": 2,
        "no-irregular-whitespace": 2,
        "no-labels": 2,
        "no-lonely-if": 2,
        "no-mixed-spaces-and-tabs": 2,
        "no-multiple-empty-lines": 2,
        "no-multi-str": 2,
        "no-native-reassign": 2,
        "no-trailing-spaces": 2,
        "no-unused-vars": 2,
        "no-void": 2,
        "no-multi-spaces": 1
    }
};
