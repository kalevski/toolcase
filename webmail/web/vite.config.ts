import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const wcRoot = resolve(here, '../../web-components')

// Default (Docker / release build): the published @toolcase/web-components from
// node_modules. WEBMAIL_WC_SRC=1 or LOCAL_WC=1 resolves the monorepo source
// instead, the same way examples/vite.config.ts does, so unreleased component
// changes can be tried without publishing. The stylesheet still comes from the
// workspace's built lib/index.css (run `npm -w @toolcase/web-components run build:css`).
const useLocal =
    (process.env.WEBMAIL_WC_SRC === '1' || process.env.LOCAL_WC === '1') &&
    existsSync(resolve(wcRoot, 'src/index.ts'))

export default defineConfig({
    plugins: [react()],
    base: '/',
    resolve: {
        alias: useLocal
            ? [
                  {
                      find: '@toolcase/web-components/style.css',
                      replacement: resolve(wcRoot, 'lib/index.css'),
                  },
                  {
                      find: '@toolcase/web-components/react',
                      replacement: resolve(wcRoot, 'src/react.ts'),
                  },
                  {
                      find: /^@toolcase\/web-components$/,
                      replacement: resolve(wcRoot, 'src/index.ts'),
                  },
              ]
            : [],
    },
    build: {
        outDir: '../internal/web/dist',
        emptyOutDir: true,
        sourcemap: false,
        chunkSizeWarningLimit: 4000,
    },
    server: {
        port: 5180,
        proxy: {
            '/api': { target: 'http://127.0.0.1:8080', changeOrigin: false },
        },
    },
})
