/**
 * 
 * @param {string|number} value 
 * @param {number} defaultValue 
 * @param {number} min 
 * @param {number} max 
 */
const getNumberInRange = (value, defaultValue = 0, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {

    let number = null

    if (typeof value === 'string') {
        value = parseInt(value, 10)
        if (Number.isNaN(value)) {
            number = defaultValue
        }
    } else if (typeof value !== 'number') {
        number = defaultValue
    } else {
        throw new Error(`not supported value type "${typeof value}"`)
    }

    return Math.min(Math.max(number, min), max) 

}

export default getNumberInRange