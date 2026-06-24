/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    experimental: {
        // instrumentation.ts boots the B3 schedule ticker at server start.
        instrumentationHook: true,
    },
    // @toolcase/base ships ESM + CJS; let Next transpile it so the SSR build
    // resolves its named exports cleanly.
    transpilePackages: ['@toolcase/base'],
    eslint: {
        ignoreDuringBuilds: true,
    },
}

export default nextConfig
