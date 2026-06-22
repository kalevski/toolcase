import type { Delta, ObjectDelta, ArrayDelta, Edit } from './diff'

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function isEdit(v: unknown): v is Edit {
    return Array.isArray(v)
}

function isArrayDelta(v: Delta): v is ArrayDelta {
    return !Array.isArray(v) && (v as ArrayDelta)._t === 'a'
}

function patch(target: unknown, delta: Delta | null): unknown {
    if (delta === null) return target

    if (isArrayDelta(delta)) {
        const ad = delta
        const targetArr = Array.isArray(target) ? (target as unknown[]) : []
        const result: unknown[] = new Array(ad._l)

        for (let i = 0; i < ad._l; i++) {
            if (!(String(i) in ad)) result[i] = targetArr[i]
        }

        for (const key of Object.keys(ad)) {
            if (key === '_t' || key === '_l') continue
            const idx = parseInt(key, 10)
            if (idx >= ad._l) continue
            const change = ad[key]
            if (isEdit(change)) {
                if (change.length === 1) {
                    result[idx] = change[0]
                } else if (change.length === 2) {
                    result[idx] = change[1]
                }
            } else {
                result[idx] = patch(targetArr[idx], change as Delta)
            }
        }

        return result
    }

    const od = delta as ObjectDelta
    const obj = (isPlainObject(target) ? { ...target } : {}) as Record<string, unknown>

    for (const key of Object.keys(od)) {
        const change = od[key]
        if (isEdit(change)) {
            if (change.length === 1) {
                obj[key] = change[0]
            } else if (change.length === 3 && change[1] === 0 && change[2] === 0) {
                delete obj[key]
            } else {
                obj[key] = change[1]
            }
        } else {
            obj[key] = patch(obj[key], change as Delta)
        }
    }

    return obj
}

export default patch
