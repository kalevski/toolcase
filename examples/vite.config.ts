import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    plugins: [react()],
    base: '/',
    resolve: {
        alias: {
            '@toolcase/phaser-plus': resolve(__dirname, '../phaser-plus/src/index.ts'),
        },
    },
    build: {
        outDir: 'dist',
    },
})
