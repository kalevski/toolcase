// eslint-disable-next-line no-var
declare var require: ((id: string) => any) | undefined

const getCrypto = (): Crypto =>
    (globalThis.crypto ?? require?.('node:crypto')?.webcrypto) as Crypto

/**
 * Generates a random hex string of the given `length`.
 *
 * **Entropy note:** the default `length = 8` produces 4 bytes (32 bits) of entropy.
 * At that size birthday collisions become likely around ~77 000 IDs (~√(2³²/2)).
 * This is fine for short-lived or ephemeral keys, but for persistent or globally
 * unique identifiers use `length = 16` (64 bits, safe to ~4 billion IDs) or higher.
 */
const generateId = (length: number = 8): string => {
    const bytes = new Uint8Array(Math.ceil(length / 2))
    getCrypto().getRandomValues(bytes)
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, length)
}

export default generateId
