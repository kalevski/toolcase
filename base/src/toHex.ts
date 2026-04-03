const toHex = (value: number, digits: number = 4): string => {
    return ('0'.repeat(digits - 1) + value.toString(16)).slice(-digits)
}

export default toHex
