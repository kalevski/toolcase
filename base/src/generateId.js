/**
 * 
 * @param {number} length 
 * @returns {string}
 */

const MODULE_LENGTH = 5
const MODULE_SEPARATOR = ''

const generateId = (length = 8, separator = MODULE_SEPARATOR, moduleLength = MODULE_LENGTH) => {
    
    let modules = []
    for (let i = 0; i < Math.floor(length / moduleLength); i++) {
        modules.push(moduleLength)
    }
    if (length % moduleLength !== 0) {
        modules.push(length % moduleLength)
    }
    
    return modules.map(length => {
        const multiplier = parseInt(`0x1${'0'.repeat(length)}`)
        const seed = 1 + Math.random()
        return Math.floor(seed * multiplier).toString(16).substring(1)
    }).join(separator)
}

export default generateId