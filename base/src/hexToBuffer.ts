const hexToBuffer = (hexNumber: string): Uint8Array => {
    const array = hexNumber.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    return new Uint8Array(array)
}

export default hexToBuffer
