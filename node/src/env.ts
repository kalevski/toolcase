type ENVType = 'string' | 'number' | 'boolean'

function env(key: string): string | null
function env(key: string, defaultValue: string, type?: 'string'): string
function env(key: string, defaultValue: number, type: 'number'): number
function env(key: string, defaultValue: boolean, type: 'boolean'): boolean
function env(key: string, defaultValue: null, type: 'number'): number | null
function env(key: string, defaultValue: null, type: 'boolean'): boolean | null
function env(
    key: string,
    defaultValue: string | number | boolean | null = null,
    type: ENVType = 'string',
): string | number | boolean | null {
    if (typeof (globalThis as { process?: { env: Record<string, string | undefined> } }).process === 'undefined') {
        throw new Error('env works only with NodeJS')
    }
    const value = (globalThis as { process: { env: Record<string, string | undefined> } }).process.env[key]
    if (type === 'number') {
        if (value === undefined) return defaultValue as number | null
        const numberValue = parseInt(value, 10)
        return numberValue.toString() === value ? numberValue : (defaultValue as number | null)
    }
    if (type === 'boolean') {
        const boolValue = (value + '').toLowerCase()
        if (boolValue === 'true') return true
        if (boolValue === 'false') return false
        return defaultValue as boolean | null
    }
    return value !== undefined ? value : (defaultValue as string | null)
}

export default env
