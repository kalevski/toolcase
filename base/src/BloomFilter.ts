class BloomFilter {

    private readonly bits: Uint8Array
    private readonly hashCount: number
    readonly bitSize: number

    constructor(bitSize: number, hashCount: number) {
        if (!Number.isInteger(bitSize) || bitSize < 1) {
            throw new Error('bitSize must be a positive integer')
        }
        if (!Number.isInteger(hashCount) || hashCount < 1) {
            throw new Error('hashCount must be a positive integer')
        }
        this.bitSize = bitSize
        this.hashCount = hashCount
        this.bits = new Uint8Array(Math.ceil(bitSize / 8))
    }

    private h1(str: string): number {
        let h = 5381
        for (let i = 0; i < str.length; i++) {
            h = ((h << 5) + h) ^ str.charCodeAt(i)
            h >>>= 0
        }
        return h
    }

    private h2(str: string): number {
        let h = 0
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i)
            h = (c + (h << 6) + (h << 16) - h) >>> 0
        }
        return h || 1
    }

    add(item: string): this {
        const a = this.h1(item)
        const b = this.h2(item)
        for (let i = 0; i < this.hashCount; i++) {
            const pos = ((a + i * b) >>> 0) % this.bitSize
            this.bits[pos >>> 3] |= 1 << (pos & 7)
        }
        return this
    }

    has(item: string): boolean {
        const a = this.h1(item)
        const b = this.h2(item)
        for (let i = 0; i < this.hashCount; i++) {
            const pos = ((a + i * b) >>> 0) % this.bitSize
            if ((this.bits[pos >>> 3] & (1 << (pos & 7))) === 0) {
                return false
            }
        }
        return true
    }

}

export default BloomFilter
