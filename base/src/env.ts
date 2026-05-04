type ENVType = 'string' | 'number' | 'boolean'

const env = <T>(key: string, defaultValue: T = null as T, type: ENVType = 'string'): T => {
    if (typeof (globalThis as any).process === 'undefined') {
        throw new Error('env works only with NodeJS')
    }
   const value = (globalThis as any).process.env[key] as string | undefined
   if (type === 'number') {
       const numberValue = parseInt(value!, 10)
       return (numberValue.toString() === value ? numberValue : defaultValue) as T
   }
   if (type === 'boolean') {
       const boolValue = (value + '').toLowerCase()
       if (boolValue === 'true') return true as T
       else if (boolValue === 'false') return false as T
       else return defaultValue
   }
   return (value !== undefined ? value : defaultValue) as T
}

export default env
