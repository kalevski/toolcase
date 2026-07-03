// Empty stand-in for the `server-only` marker package so the driver contract
// suite (vitest.drivers.config.ts) can import server modules under plain Node.
// The marker only exists to fail CLIENT bundles; a test runner is server context.
export {}
