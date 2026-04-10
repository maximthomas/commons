import { defineConfig } from "eslint/config";
import globals from "globals";

export default defineConfig([{
    languageOptions: {
        globals: {
            ...globals.amd,
            ...globals.browser,
            ...globals.qunit,
        },
    },

    rules: {
        "array-bracket-spacing": [2, "never"],

        indent: [1, 4, {
            SwitchCase: 1,
            VariableDeclarator: 1,
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
        "no-unused-vars": 1,
        "no-void": 2,

        "new-cap": [1, {
            capIsNew: false,
        }],

        "no-multi-spaces": 1,
        "no-eval": 1,
    },
}]);