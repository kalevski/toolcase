export interface FieldRule {
	private?: boolean
	writeOnly?: boolean
	readonly?: boolean
	required?: boolean
	type?: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'object' | 'array'
	pattern?: string
	min?: number
	max?: number
	format?: string
	enum?: readonly (string | number | boolean | null)[]
	items?: FieldRule
}

export type FieldSchema<T extends object = Record<string, unknown>> = {
	[K in keyof T]?: FieldRule
}

export interface VisitorContext<T extends object = Record<string, unknown>> {
	key: string
	value: unknown
	rule: FieldRule | undefined
	schema: FieldSchema<T>
	path: string
}

export interface VisitorActions {
	remove: () => void
	set: (value: unknown) => void
}

export type Visitor<T extends object = Record<string, unknown>> = (
	ctx: VisitorContext<T>,
	actions: VisitorActions,
) => void
