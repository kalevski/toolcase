import { defineConfig } from 'tsup'

export default defineConfig({
    // `react` is an opt-in, types-only entry (React JSX augmentation for the
    // tc-* tags). Its JS output is an empty module; the value is in react.d.ts.
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
