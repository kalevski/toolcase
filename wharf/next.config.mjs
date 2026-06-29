/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    // instrumentation.ts is auto-detected in Next 16 (no experimental flag needed);
    // it boots the Agent API listener + backup ticker at server start.
    // @toolcase/base ships ESM + CJS; let Next transpile it so the SSR build
    // resolves its named exports cleanly.
    transpilePackages: ['@toolcase/base'],
}

export default nextConfig
