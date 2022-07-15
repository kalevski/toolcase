const getNumberInRange = (value, defaultValue = 0, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {

    if (typeof value === 'string') {
        value = parseInt(value, 10)
        if (Number.isNaN(value)) {
            value = defaultValue
        }
    }

    if (typeof value !== 'number') {
        value = defaultValue
    }

    return Math.min(Math.max(value, min), max) 

}

export default getNumberInRange