/**
 * @typedef ENVType
 * @type {('string'|'number'|'boolean')}
 */

/**
 * @template T
 * @param {string} key 
 * @param {T} defaultValue 
 * @param {ENVType} type
 * @returns {T}
 */
 const env = (key, defaultValue = null, type = 'string') => {
    if (typeof globalThis.process === 'undefined') {
        throw new Error('env works only with NodeJS')
    }
   let value = globalThis.process.env[key]
   if (type === 'number') {
       let numberValue = parseInt(value, 10)
       return numberValue.toString() === value ? numberValue : defaultValue
   }
   if (type === 'boolean') {
       let boolValue = (value + '').toLowerCase()
       if (boolValue === 'true') return true
       else if (boolValue === 'false') return false
       else return defaultValue
   }
   return value !== undefined ? value : defaultValue
}

export default env