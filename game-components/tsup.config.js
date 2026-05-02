import { defineConfig } from 'tsup'
import { sassPlugin } from 'esbuild-sass-plugin'

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    outDir: 'lib',
    external: ['lit', 'lit/decorators.js'],
    outExtension({ format }) {
        return {
            js: format === 'esm' ? '.module.js' : '.main.js',
        }
    },
    esbuildPlugins: [
        sassPlugin({ type: 'css-text', loadPaths: ['style'] }),
    ],
})
