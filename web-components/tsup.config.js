import { defineConfig } from 'tsup'

export default defineConfig({
    // `react` is the opt-in React bridge: JSX augmentation (tc-* IntrinsicElements)
    // + runtime useTc / useTcEvents hooks. Peer-depends on react.
    entry: ['src/index.ts', 'src/react.ts', 'src/index.server.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    outDir: 'lib',
    external: ['@toolcase/base', 'react'],
    outExtension({ format }) {
        return {
            js: format === 'esm' ? '.module.js' : '.main.js',
        }
    },
})
