export const KV_KEY_SEPARATOR = ':'

export class KeyBuilder {

	constructor(
		public readonly namespace: string,
		public readonly separator: string,
	) {}

	build(part: string | number): string
	build(...parts: (string | number)[]): string
	build(first: string | number, ...rest: (string | number)[]): string {
		if (rest.length === 0) {
			const s = typeof first === 'string' ? first : String(first)
			return this.namespace.length === 0 ? s : `${this.namespace}${this.separator}${s}`
		}
		let joined = typeof first === 'string' ? first : String(first)
		for (let i = 0; i < rest.length; i++) {
			const p = rest[i]
			joined = `${joined}${this.separator}${typeof p === 'string' ? p : String(p)}`
		}
		return this.namespace.length === 0 ? joined : `${this.namespace}${this.separator}${joined}`
	}

	scope(namespace: string): KeyBuilder {
		const next = this.namespace.length === 0
			? namespace
			: `${this.namespace}${this.separator}${namespace}`
		return new KeyBuilder(next, this.separator)
	}

	stripNamespace(value: string): string {
		if (this.namespace.length === 0) return value
		const prefix = `${this.namespace}${this.separator}`
		return value.startsWith(prefix) ? value.slice(prefix.length) : value
	}
}
