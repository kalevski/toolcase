// eslint-disable-next-line no-var
declare var require: ((id: string) => any) | undefined

const getCrypto = (): Crypto =>
    (globalThis.crypto ?? require?.('node:crypto')?.webcrypto) as Crypto

const generateId = (length: number = 8): string => {
    const bytes = new Uint8Array(Math.ceil(length / 2))
    getCrypto().getRandomValues(bytes)
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, length)
}

export default generateId
