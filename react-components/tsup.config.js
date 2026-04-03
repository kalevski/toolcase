import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    outDir: 'lib',
    external: ['react', 'react-dom', 'react/jsx-runtime', '@toolcase/base', 'dropzone'],
    outExtension({ format }) {
        return {
            js: format === 'esm' ? '.module.js' : '.main.js',
        }
    },
})
