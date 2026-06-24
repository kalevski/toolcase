// eslint-disable-next-line no-var
declare var require: ((id: string) => any) | undefined

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const getCrypto = (): Crypto =>
    (globalThis.crypto ?? require?.('node:crypto')?.webcrypto) as Crypto

let lastMs = -1
let lastRand: number[] = []

function encodeTime(ms: number): string {
    let str = ''
    let n = ms
    for (let i = 9; i >= 0; i--) {
        str = ENCODING[n % 32] + str
        n = Math.floor(n / 32)
    }
    return str
}

function randomParts(): number[] {
    const bytes = new Uint8Array(10)
    getCrypto().getRandomValues(bytes)
    const parts: number[] = []
    let acc = 0
    let bits = 0
    for (let i = 0; i < 10; i++) {
        acc = (acc << 8) | bytes[i]
        bits += 8
        while (bits >= 5) {
            bits -= 5
            parts.push((acc >>> bits) & 31)
        }
    }
    return parts
}

function incrementParts(parts: number[]): number[] {
    const next = [...parts]
    for (let i = next.length - 1; i >= 0; i--) {
        if (next[i] < 31) {
            next[i]++
            return next
        }
        next[i] = 0
    }
    throw new Error('ulid overflow: too many ids within the same millisecond')
}

function ulid(): string {
    const ms = Date.now()
    if (ms === lastMs) {
        lastRand = incrementParts(lastRand)
    } else {
        lastMs = ms
        lastRand = randomParts()
    }
    return encodeTime(ms) + lastRand.map(v => ENCODING[v]).join('')
}

export default ulid
