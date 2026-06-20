const hexToBuffer = (hexNumber: string): Uint8Array => {
    if (hexNumber.length === 0) return new Uint8Array(0)
    if (hexNumber.length % 2 !== 0) throw new Error('hex string must have even length')
    if (!/^[0-9a-fA-F]+$/.test(hexNumber)) throw new Error('hex string contains non-hex characters')
    const array = hexNumber.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    return new Uint8Array(array)
}

export default hexToBuffer
