import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig,
    {
        ignores: ['**/lib/', '**/dist/', '**/.next/', '**/out/', '**/node_modules/', '**/.workspace/', 'examples/'],
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
        // Standalone Node ESM scripts (e2e runners, build scripts) run under the
        // Node runtime, not bundled — expose the Node globals they use.
        files: ['**/e2e/**', '**/*.mjs'],
        languageOptions: {
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                fetch: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                URL: 'readonly',
            },
        },
    },
    {
        // React app workspaces use hooks; register the plugin so the existing
        // `react-hooks/exhaustive-deps` disable directives resolve (and the rule
        // runs as a warning, mirroring eslint-config-next).
        files: ['quaykeeper/**/*.{ts,tsx}', 'taskforge/**/*.{ts,tsx}'],
        plugins: { 'react-hooks': reactHooks },
        rules: {
            'react-hooks/exhaustive-deps': 'warn',
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
