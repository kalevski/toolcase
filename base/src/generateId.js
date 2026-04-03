/**
 * 
 * @param {number} length 
 * @returns {string}
 */
const generateId = (length = 8) => {
    const bytes = new Uint8Array(Math.ceil(length / 2))
    globalThis.crypto.getRandomValues(bytes)
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, length)
}

export default generateId