const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        ignores: ['node_modules/**'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                window: 'readonly',
            },
        },
    },
    {
        files: ['web/**/*.js'],
        languageOptions: {
            sourceType: 'script',
            globals: globals.browser,
        },
    },
];
