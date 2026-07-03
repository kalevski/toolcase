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
    // Pools merged onto their consumers' pages: upstreams live on /proxies,
    // stream-upstreams on /streams. Config-level 308s keep old bookmarks working.
    async redirects() {
        return [
            { source: '/upstreams', destination: '/proxies', permanent: true },
            { source: '/stream-upstreams', destination: '/streams', permanent: true },
        ]
    },
}

export default nextConfig
