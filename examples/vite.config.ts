import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    plugins: [react()],
    base: '/',
    resolve: {
        alias: [
            { find: '@toolcase/web-components/style.css', replacement: resolve(__dirname, '../web-components/lib/index.css') },
            { find: '@toolcase/web-components/react', replacement: resolve(__dirname, '../web-components/src/react.ts') },
            { find: '@toolcase/web-components', replacement: resolve(__dirname, '../web-components/src/index.ts') },
            { find: '@toolcase/phaser-plus', replacement: resolve(__dirname, '../phaser-plus/src/index.ts') },
            { find: /^@toolcase\/node$/, replacement: resolve(__dirname, '../node/src/main.iso.ts') },
        ],
    },
    build: {
        outDir: 'dist',
    },
})
