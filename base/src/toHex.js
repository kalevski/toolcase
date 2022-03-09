/**
 * 
 * @param {number} value 
 * @param {number} [digits=4] 
 */
 const toHex = (value, digits = 4) => {
    return ('0'.repeat(digits - 1) + value.toString(16)).slice(-digits)
}

export default toHex