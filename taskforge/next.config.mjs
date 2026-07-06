/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    // instrumentation.ts (DB open + B3 schedule ticker) is on by default in
    // Next 16 — no experimental.instrumentationHook opt-in. The old
    // `eslint.ignoreDuringBuilds` key is gone too (`next lint` was removed).
    // @toolcase/base ships ESM + CJS; let Next transpile it so the SSR build
    // resolves its named exports cleanly.
    transpilePackages: ['@toolcase/base'],
}

export default nextConfig
