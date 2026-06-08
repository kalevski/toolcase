/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    // @toolcase/react-components ships ESM + CJS; let Next transpile it so the
    // SSR build resolves its named exports cleanly.
    transpilePackages: ['@toolcase/react-components', '@toolcase/base'],
    eslint: {
        ignoreDuringBuilds: true,
    },
}

export default nextConfig
