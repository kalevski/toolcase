/**
 * 
 * @param {number} length 
 * @returns {string}
 */
 const generateId = (length = 8) => {
    const multiplier = parseInt(`0x1${'0'.repeat(length)}`)
    const seed = 1 + Math.random()
    return Math.floor(seed * multiplier).toString(16).substring(1)

}

export default generateId