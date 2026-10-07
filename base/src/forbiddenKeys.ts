const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export const isForbiddenKey = (key: string): boolean => FORBIDDEN_KEYS.has(key)

export const hasOwn = (target: object, key: string): boolean =>
    Object.prototype.hasOwnProperty.call(target, key)

export const setOwn = (target: Record<string, unknown>, key: string, value: unknown): void => {
    Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true })
}
