const getNumberInRange = (value: string | number, defaultValue: number = 0, min: number = Number.MIN_SAFE_INTEGER, max: number = Number.MAX_SAFE_INTEGER): number => {

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
