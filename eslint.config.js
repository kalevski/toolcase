import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig,
    {
        ignores: ['**/lib/', '**/dist/', '**/.next/', '**/node_modules/', 'examples/'],
    },
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'no-control-regex': 'off',
            'no-useless-escape': 'off',
            'preserve-caught-error': 'off',
        },
    },
    {
        files: ['**/test/**', '**/examples/**'],
        languageOptions: {
            globals: {
                console: 'readonly',
                process: 'readonly',
                window: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
            },
        },
    },
    {
        files: ['**/scripts/**'],
        languageOptions: {
            globals: {
                console: 'readonly',
                process: 'readonly',
            },
        },
    },
    {
        // Generated JSX typings: module/global augmentation of React.JSX requires
        // `namespace` and empty `interface … extends …` — both unavoidable here.
        files: ['**/react-types.ts'],
        rules: {
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
        },
    },
)
