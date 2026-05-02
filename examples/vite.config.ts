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
            { find: '@toolcase/game-components/style.css', replacement: resolve(__dirname, '../game-components/lib/index.css') },
            { find: '@toolcase/game-components', replacement: resolve(__dirname, '../game-components/src/index.ts') },
            { find: '@toolcase/phaser-plus', replacement: resolve(__dirname, '../phaser-plus/src/index.ts') },
        ],
    },
    build: {
        outDir: 'dist',
    },
})
