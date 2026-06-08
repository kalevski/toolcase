import { defineConfig } from 'tsup'

export default defineConfig({
    entry: {
        main: 'src/main.ts',
        env: 'src/env.ts',
    },
    format: ['cjs', 'esm'],
    dts: false,
    clean: true,
    outDir: 'lib',
    target: 'node18',
    platform: 'node',
    external: [
        '@toolcase/base',
        '@toolcase/serializer',
        'fastify',
        '@fastify/cors',
        'jose',
        'redis',
        'sharp',
    ],
    outExtension({ format }) {
        return {
            js: format === 'esm' ? '.module.js' : '.main.js',
        }
    },
})
