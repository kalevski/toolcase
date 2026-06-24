export const KV_KEY_SEPARATOR = ':'

export class KeyBuilder {

	constructor(
		public readonly namespace: string,
		public readonly separator: string,
	) {}

	private encodePart(p: string | number): string {
		const s = typeof p === 'string' ? p : String(p)
		if (s.includes(this.separator)) {
			return s.split(this.separator).join(encodeURIComponent(this.separator))
		}
		return s
	}

	build(part: string | number): string
	build(...parts: (string | number)[]): string
	build(first: string | number, ...rest: (string | number)[]): string {
		if (rest.length === 0) {
			const s = this.encodePart(first)
			return this.namespace.length === 0 ? s : `${this.namespace}${this.separator}${s}`
		}
		let joined = this.encodePart(first)
		for (let i = 0; i < rest.length; i++) {
			joined = `${joined}${this.separator}${this.encodePart(rest[i])}`
		}
		return this.namespace.length === 0 ? joined : `${this.namespace}${this.separator}${joined}`
	}

	scope(namespace: string): KeyBuilder {
		const encodedNamespace = this.encodePart(namespace)
		const next = this.namespace.length === 0
			? encodedNamespace
			: `${this.namespace}${this.separator}${encodedNamespace}`
		return new KeyBuilder(next, this.separator)
	}

	stripNamespace(value: string): string {
		if (this.namespace.length === 0) return value
		const prefix = `${this.namespace}${this.separator}`
		return value.startsWith(prefix) ? value.slice(prefix.length) : value
	}
}
