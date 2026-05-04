import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/main.ts', 'src/node.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    outDir: 'lib',
    outExtension({ format }) {
        return {
            js: format === 'esm' ? '.module.js' : '.main.js',
        }
    },
})
