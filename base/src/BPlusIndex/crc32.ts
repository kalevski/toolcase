const TABLE = ((): Uint32Array => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
        let c = i
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
        t[i] = c
    }
    return t
})()

export function crc32(data: Uint8Array, offset = 0, len = data.length - offset): number {
    let crc = 0xffffffff
    const end = offset + len
    for (let i = offset; i < end; i++) crc = TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
    return (crc ^ 0xffffffff) >>> 0
}
