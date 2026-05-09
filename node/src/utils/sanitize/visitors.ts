import { Visitor } from './types'

export const removePrivate: Visitor = ({ rule }, { remove }) => {
	if (rule?.private) remove()
}

export const removeWriteOnly: Visitor = ({ rule }, { remove }) => {
	if (rule?.writeOnly) remove()
}

export const removeReadonly: Visitor = ({ rule }, { remove }) => {
	if (rule?.readonly) remove()
}

export const removeUnknown: Visitor = ({ rule }, { remove }) => {
	if (!rule) remove()
}

const matchesPath = (target: string, key: string, path: string): boolean => {
	if (target === key) return true
	if (target === path) return true
	return false
}

export const removeRestricted = (restricted: readonly string[]): Visitor => {
	const set = new Set(restricted)
	return ({ key, path }, { remove }) => {
		if (set.has(key) || set.has(path)) remove()
	}
}

export const allowOnly = (allowed: readonly string[]): Visitor => {
	const set = new Set(allowed)
	return ({ key, path }, { remove }) => {
		if (!set.has(key) && !set.has(path)) remove()
	}
}

export const coerceNumber: Visitor = ({ value }, { set }) => {
	if (typeof value === 'string' && value.length > 0) {
		const n = Number(value)
		if (Number.isFinite(n)) set(n)
	}
}

export const coerceBoolean: Visitor = ({ value }, { set }) => {
	if (typeof value === 'string') {
		if (value === 'true') set(true)
		else if (value === 'false') set(false)
	}
}

export const coerceDate: Visitor = ({ value }, { set }) => {
	if (typeof value === 'string' && value.length > 0) {
		const d = new Date(value)
		if (!Number.isNaN(d.getTime())) set(d)
	}
}

export const trimStrings: Visitor = ({ value }, { set }) => {
	if (typeof value === 'string') set(value.trim())
}

export const lowercaseStrings: Visitor = ({ value }, { set }) => {
	if (typeof value === 'string') set(value.toLowerCase())
}
