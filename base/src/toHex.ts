const toHex = (value: number, digits: number = 4): string => {
    const hex = (value >>> 0).toString(16)
    return hex.padStart(Math.max(0, digits), '0').slice(-Math.max(1, digits))
}

export default toHex
