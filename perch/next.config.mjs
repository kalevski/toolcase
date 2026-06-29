/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    // @toolcase/base ships ESM + CJS; let Next transpile it so the SSR build
    // resolves its named exports cleanly.
    transpilePackages: ['@toolcase/base'],
    eslint: {
        ignoreDuringBuilds: true,
    },
}

export default nextConfig
