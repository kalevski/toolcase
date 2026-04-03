/**
 * 
 * @param {string|number} value 
 * @param {number} defaultValue 
 * @param {number} min 
 * @param {number} max 
 */
const getNumberInRange = (value, defaultValue = 0, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {

    let number = defaultValue

    if (typeof value === 'string') {
        const parsed = parseInt(value, 10)
        number = Number.isNaN(parsed) ? defaultValue : parsed
    } else if (typeof value === 'number') {
        number = Number.isNaN(value) ? defaultValue : value
    }

    return Math.min(Math.max(number, min), max) 

}

export default getNumberInRange