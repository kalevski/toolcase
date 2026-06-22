export type Edit = [unknown] | [unknown, unknown] | [unknown, 0, 0]

export type ObjectDelta = { [key: string]: unknown }

export type ArrayDelta = { _t: 'a'; _l: number; [key: string]: unknown }

export type Delta = ObjectDelta | ArrayDelta

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (a === null || b === null) return false
    if (Array.isArray(a) !== Array.isArray(b)) return false
    if (Array.isArray(a)) {
        const bArr = b as unknown[]
        if (a.length !== bArr.length) return false
        return a.every((v, i) => deepEqual(v, bArr[i]))
    }
    if (typeof a === 'object' && typeof b === 'object') {
        const aObj = a as Record<string, unknown>
        const bObj = b as Record<string, unknown>
        const keysA = Object.keys(aObj)
        const keysB = Object.keys(bObj)
        if (keysA.length !== keysB.length) return false
        return keysA.every(k => deepEqual(aObj[k], bObj[k]))
    }
    return false
}

function diffValues(a: unknown, b: unknown): Edit | Delta | null {
    if (deepEqual(a, b)) return null
    if (isPlainObject(a) && isPlainObject(b)) return diffObjects(a, b)
    if (Array.isArray(a) && Array.isArray(b)) return diffArrays(a, b)
    return [a, b] as Edit
}

function diffObjects(a: Record<string, unknown>, b: Record<string, unknown>): ObjectDelta | null {
    const delta: ObjectDelta = {}
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])

    for (const key of keys) {
        const hasA = Object.prototype.hasOwnProperty.call(a, key)
        const hasB = Object.prototype.hasOwnProperty.call(b, key)

        if (!hasA) {
            delta[key] = [b[key]]
        } else if (!hasB) {
            delta[key] = [a[key], 0, 0]
        } else {
            const child = diffValues(a[key], b[key])
            if (child !== null) delta[key] = child
        }
    }

    return Object.keys(delta).length > 0 ? delta : null
}

function diffArrays(a: unknown[], b: unknown[]): ArrayDelta | null {
    const delta: ArrayDelta = { _t: 'a', _l: b.length }
    const len = Math.max(a.length, b.length)

    for (let i = 0; i < len; i++) {
        const key = String(i)
        if (i >= a.length) {
            delta[key] = [b[i]]
        } else if (i >= b.length) {
            delta[key] = [a[i], 0, 0]
        } else {
            const child = diffValues(a[i], b[i])
            if (child !== null) delta[key] = child
        }
    }

    const hasChanges = Object.keys(delta).some(k => k !== '_t' && k !== '_l')
    return hasChanges ? delta : null
}

function diff(a: unknown, b: unknown): Delta | null {
    if (deepEqual(a, b)) return null
    if (isPlainObject(a) && isPlainObject(b)) return diffObjects(a, b)
    if (Array.isArray(a) && Array.isArray(b)) return diffArrays(a, b)
    return null
}

export default diff
