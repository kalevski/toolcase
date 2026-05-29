import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

export type SchemaPropertyType = 'string' | 'number' | 'boolean' | 'array' | 'object'

export interface SchemaProperty {
	key: string
	type: SchemaPropertyType
	defaultValue?: unknown
	objRef?: string
}

export interface SchemaRefItem {
	id: string
	label: string
}

export interface JSONSchemaDefProps {
	/** Optional schema name. Renders an editable name field when defined. */
	label?: string
	value?: string
	defaultValue?: string
	/** Unified reference list used for both `array` and `object` properties. */
	refList?: SchemaRefItem[]
	/** Overrides `refList` for `array` properties only. */
	arrayRefList?: SchemaRefItem[]
	/** Overrides `refList` for `object` properties only. */
	objectRefList?: SchemaRefItem[]
	onChange?: (value: string) => void
	onLabelChange?: (label: string) => void
	disabled?: boolean
	className?: string
	loading?: boolean
	/** Base id used to associate the name field with its label. */
	id?: string
}

const PROPERTY_TYPES: SchemaPropertyType[] = ['string', 'number', 'boolean', 'array', 'object']

// Arrays may reference primitive item types in addition to custom refs.
const PRIMITIVE_ARRAY_REFS: SchemaRefItem[] = [
	{ id: 'boolean', label: 'boolean' },
	{ id: 'number', label: 'number' },
	{ id: 'string', label: 'string' },
]

const getDefaultForType = (type: SchemaPropertyType): unknown => {
	switch (type) {
		case 'string':
			return ''
		case 'number':
			return 0
		case 'boolean':
			return false
		case 'array':
		case 'object':
			return undefined
	}
}

interface ParseResult {
	properties: SchemaProperty[]
	error: boolean
}

const parseValue = (raw: string): ParseResult => {
	if (!raw || raw.trim() === '') {
		return { properties: [], error: false }
	}
	try {
		const parsed = JSON.parse(raw)
		if (Array.isArray(parsed)) {
			return { properties: parsed, error: false }
		}
		return { properties: [], error: true }
	} catch {
		return { properties: [], error: true }
	}
}

const needsRef = (type: SchemaPropertyType) => type === 'array' || type === 'object'

export const JSONSchemaDef: React.FC<JSONSchemaDefProps> = ({
	label,
	value,
	defaultValue = '[]',
	refList = [],
	arrayRefList,
	objectRefList,
	onChange,
	onLabelChange,
	disabled = false,
	className = '',
	loading = false,
	id,
}) => {
	const isControlled = value !== undefined
	const [internalValue, setInternalValue] = useState<string>(defaultValue)
	const raw = isControlled ? value : internalValue

	const { properties, error: parseError } = useMemo(() => parseValue(raw), [raw])

	// Resolve ref lists: explicit per-type list wins, else fall back to refList.
	const arrayRefs = useMemo(
		() => [...PRIMITIVE_ARRAY_REFS, ...(arrayRefList ?? refList)],
		[arrayRefList, refList],
	)
	const objectRefs = useMemo(() => objectRefList ?? refList, [objectRefList, refList])

	const propertyTypes = useMemo(
		() =>
			PROPERTY_TYPES.filter((type) => {
				if (type === 'array') return arrayRefs.length > 0
				if (type === 'object') return objectRefs.length > 0
				return true
			}),
		[arrayRefs, objectRefs],
	)

	// Stable row ids so editing/removing/reordering doesn't lose focus or
	// reconcile against the wrong row (avoids the key={index} anti-pattern).
	const idCounter = useRef(0)
	const idsRef = useRef<string[]>([])
	// Row id whose key input should grab focus on next render (after add).
	const pendingFocusId = useRef<string | null>(null)
	if (idsRef.current.length !== properties.length) {
		const next = idsRef.current.slice(0, properties.length)
		while (next.length < properties.length) {
			next.push(`p${idCounter.current++}`)
		}
		idsRef.current = next
	}
	const rowIds = idsRef.current

	const emit = useCallback(
		(next: SchemaProperty[], nextIds: string[]) => {
			idsRef.current = nextIds
			const serialized = JSON.stringify(next)
			if (!isControlled) setInternalValue(serialized)
			onChange?.(serialized)
		},
		[isControlled, onChange],
	)

	const addProperty = () => {
		// Pick the next free `propertyN` name to avoid collisions.
		const existing = new Set(properties.map((p) => p.key))
		let n = properties.length + 1
		while (existing.has(`property${n}`)) n++
		const newId = `p${idCounter.current++}`
		pendingFocusId.current = newId
		emit([...properties, { key: `property${n}`, type: 'string', defaultValue: '' }], [...rowIds, newId])
	}

	const removeProperty = (index: number) => {
		emit(
			properties.filter((_, i) => i !== index),
			rowIds.filter((_, i) => i !== index),
		)
	}

	const moveProperty = (index: number, dir: -1 | 1) => {
		const target = index + dir
		if (target < 0 || target >= properties.length) return
		const nextProps = [...properties]
		const nextIds = [...rowIds]
		;[nextProps[index], nextProps[target]] = [nextProps[target], nextProps[index]]
		;[nextIds[index], nextIds[target]] = [nextIds[target], nextIds[index]]
		emit(nextProps, nextIds)
	}

	const updateProperty = (index: number, patch: Partial<SchemaProperty>) => {
		emit(
			properties.map((prop, i) => {
				if (i !== index) return prop
				const updated = { ...prop, ...patch }

				if (patch.type && patch.type !== prop.type) {
					const def = getDefaultForType(patch.type)
					if (def !== undefined) {
						updated.defaultValue = def
					} else {
						delete updated.defaultValue
					}
					if (patch.type === 'array') {
						updated.objRef = arrayRefs[0]?.id
					} else if (patch.type === 'object') {
						updated.objRef = objectRefs[0]?.id
					} else {
						delete updated.objRef
					}
				}

				return updated
			}),
			rowIds,
		)
	}

	// Validation: blank keys and duplicates produce an invalid schema.
	const duplicateKeys = useMemo(() => {
		const seen = new Map<string, number>()
		const dups = new Set<string>()
		for (const prop of properties) {
			const k = prop.key.trim()
			if (!k) continue
			seen.set(k, (seen.get(k) ?? 0) + 1)
			if ((seen.get(k) ?? 0) > 1) dups.add(k)
		}
		return dups
	}, [properties])

	const keyError = (key: string) => key.trim() === '' || duplicateKeys.has(key.trim())

	const labelFieldId = id ? `${id}-name` : undefined

	const renderDefaultValueInput = (prop: SchemaProperty, index: number) => {
		switch (prop.type) {
			case 'boolean': {
				const current = prop.defaultValue === undefined ? 'null' : String(prop.defaultValue)
				return (
					<select
						className="component-json-schema-def__select"
						value={current}
						disabled={disabled}
						aria-label={`Default value for ${prop.key || `property ${index + 1}`}`}
						onChange={(e) => {
							const v = e.target.value
							updateProperty(index, {
								defaultValue: v === 'null' ? undefined : v === 'true',
							})
						}}
					>
						<option value="null">-</option>
						<option value="true">true</option>
						<option value="false">false</option>
					</select>
				)
			}
			case 'number':
				return (
					<input
						type="number"
						className="component-json-schema-def__input component-json-schema-def__input--small"
						value={prop.defaultValue === undefined ? '' : (prop.defaultValue as number)}
						disabled={disabled}
						placeholder="default"
						aria-label={`Default value for ${prop.key || `property ${index + 1}`}`}
						onChange={(e) => {
							const v = e.target.value
							if (v === '') {
								updateProperty(index, { defaultValue: undefined })
								return
							}
							const n = Number(v)
							if (!Number.isNaN(n)) updateProperty(index, { defaultValue: n })
						}}
					/>
				)
			case 'array':
			case 'object':
				return null
			default:
				return (
					<input
						type="text"
						className="component-json-schema-def__input component-json-schema-def__input--small"
						value={(prop.defaultValue as string) ?? ''}
						disabled={disabled}
						placeholder="default"
						aria-label={`Default value for ${prop.key || `property ${index + 1}`}`}
						onChange={(e) => updateProperty(index, { defaultValue: e.target.value })}
					/>
				)
		}
	}

	if (loading) {
		return (
			<div className={`component component-json-schema-def${className ? ` ${className}` : ''}`}>
				<div className="component-json-schema-def__properties">
					<Skeleton count={4} />
				</div>
			</div>
		)
	}

	return (
		<div className={`component component-json-schema-def${className ? ` ${className}` : ''}`}>
			{label !== undefined && (
				<div className="component-json-schema-def__header">
					<label className="component-json-schema-def__label" htmlFor={labelFieldId}>
						Schema name
					</label>
					<input
						id={labelFieldId}
						type="text"
						className="component-json-schema-def__input component-json-schema-def__label-input"
						placeholder="Schema name"
						value={label}
						disabled={disabled || !onLabelChange}
						onChange={(e) => onLabelChange?.(e.target.value)}
					/>
				</div>
			)}

			{parseError && (
				<div className="component-json-schema-def__error" role="alert">
					<Icon name="exclamation-triangle" decorative /> Invalid schema JSON — showing an empty list.
				</div>
			)}

			<div className="component-json-schema-def__properties" role="list">
				{properties.length === 0 && (
					<div className="component-json-schema-def__empty">No properties defined</div>
				)}

				{properties.map((prop, index) => {
					const invalid = keyError(prop.key)
					const propLabel = prop.key || `property ${index + 1}`
					return (
						<div className="component-json-schema-def__row" role="listitem" key={rowIds[index]}>
							<input
								type="text"
								className="component-json-schema-def__input component-json-schema-def__input--key"
								placeholder="key"
								value={prop.key}
								disabled={disabled}
								ref={(el) => {
									if (el && pendingFocusId.current === rowIds[index]) {
										pendingFocusId.current = null
										el.focus()
										el.select()
									}
								}}
								aria-label={`Name for ${propLabel}`}
								aria-invalid={invalid || undefined}
								title={
									invalid
										? prop.key.trim() === ''
											? 'Property name is required'
											: 'Duplicate property name'
										: undefined
								}
								onChange={(e) => updateProperty(index, { key: e.target.value })}
							/>

							<select
								className="component-json-schema-def__select"
								value={prop.type}
								disabled={disabled}
								aria-label={`Type for ${propLabel}`}
								onChange={(e) => updateProperty(index, { type: e.target.value as SchemaPropertyType })}
							>
								{propertyTypes.map((t) => (
									<option key={t} value={t}>
										{t}
									</option>
								))}
							</select>

							{renderDefaultValueInput(prop, index)}

							{needsRef(prop.type) && (
								<select
									className="component-json-schema-def__select component-json-schema-def__select--ref"
									value={prop.objRef ?? ''}
									disabled={disabled}
									aria-label={`${prop.type === 'array' ? 'Item' : 'Reference'} type for ${propLabel}`}
									onChange={(e) => updateProperty(index, { objRef: e.target.value || undefined })}
								>
									{(prop.type === 'array' ? arrayRefs : objectRefs).map((ref) => (
										<option key={ref.id} value={ref.id}>
											{ref.label}
										</option>
									))}
								</select>
							)}

							<div className="component-json-schema-def__row-actions">
								<button
									type="button"
									className="component-json-schema-def__move"
									disabled={disabled || index === 0}
									onClick={() => moveProperty(index, -1)}
									aria-label={`Move ${propLabel} up`}
								>
									<Icon name="chevron-up" decorative />
								</button>
								<button
									type="button"
									className="component-json-schema-def__move"
									disabled={disabled || index === properties.length - 1}
									onClick={() => moveProperty(index, 1)}
									aria-label={`Move ${propLabel} down`}
								>
									<Icon name="chevron-down" decorative />
								</button>
								<button
									type="button"
									className="component-json-schema-def__remove"
									disabled={disabled}
									onClick={() => removeProperty(index)}
									aria-label={`Remove ${propLabel}`}
								>
									<Icon name="x-lg" decorative />
								</button>
							</div>
						</div>
					)
				})}
			</div>

			<button
				type="button"
				className="component-json-schema-def__add"
				disabled={disabled}
				onClick={addProperty}
			>
				<Icon name="plus-lg" decorative /> Add property
			</button>
		</div>
	)
}
