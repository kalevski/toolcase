import React, { useState, useCallback } from 'react'
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
	label?: string
	value?: string
	defaultValue?: string
	arrayRefList?: SchemaRefItem[]
	objectRefList?: SchemaRefItem[]
	onChange?: (value: string) => void
	onLabelChange?: (label: string) => void
	disabled?: boolean
	className?: string
	loading?: boolean
}

const PROPERTY_TYPES: SchemaPropertyType[] = ['string', 'number', 'boolean', 'array', 'object']

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

const parseValue = (raw: string): SchemaProperty[] => {
	try {
		const parsed = JSON.parse(raw)
		if (Array.isArray(parsed)) return parsed
	} catch {
		/* ignore */
	}
	return []
}

export const JSONSchemaDef: React.FC<JSONSchemaDefProps> = ({
	value,
	defaultValue = '[]',
	arrayRefList = [],
	objectRefList = [],
	onChange,
	disabled = false,
	className = '',
	loading = false,
}) => {
	const isControlled = value !== undefined
	const [internalValue, setInternalValue] = useState<string>(defaultValue)
	const raw = isControlled ? value : internalValue
	const properties = parseValue(raw)

	arrayRefList = [
		{ id: 'boolean', label: 'boolean' },
		{ id: 'number', label: 'number' },
		{ id: 'string', label: 'string' },
		...arrayRefList,
	]

	const propertyTypes = PROPERTY_TYPES.filter((type) => {
		if (type === 'array') {
			return arrayRefList.length > 0
		} else if (type === 'object') {
			return objectRefList.length > 0
		}
		return true
	})

	const emit = useCallback(
		(next: SchemaProperty[]) => {
			const serialized = JSON.stringify(next)
			if (!isControlled) setInternalValue(serialized)
			onChange?.(serialized)
		},
		[isControlled, onChange],
	)

	const addProperty = () => {
		const nextKey = `property${properties.length + 1}`
		emit([...properties, { key: nextKey, type: 'string' }])
	}

	const removeProperty = (index: number) => {
		emit(properties.filter((_, i) => i !== index))
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
						updated.objRef = arrayRefList[0]?.id
					} else if (patch.type === 'object') {
						updated.objRef = objectRefList[0]?.id
					} else {
						delete updated.objRef
					}
				}

				return updated
			}),
		)
	}

	const renderDefaultValueInput = (prop: SchemaProperty, index: number) => {
		switch (prop.type) {
			case 'boolean':
				return (
					<select
						className="component-json-schema-def__select"
						value={String(prop.defaultValue ?? false)}
						disabled={disabled}
						onChange={(e) => updateProperty(index, { defaultValue: e.target.value === 'true' })}
					>
						<option value="null">-</option>
						<option value="true">true</option>
						<option value="false">false</option>
					</select>
				)
			case 'number':
				return (
					<input
						type="number"
						className="component-json-schema-def__input component-json-schema-def__input--small"
						value={prop.defaultValue as number ?? 0}
						disabled={disabled}
						onChange={(e) => updateProperty(index, { defaultValue: Number(e.target.value) })}
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
						onChange={(e) => updateProperty(index, { defaultValue: e.target.value })}
					/>
				)
		}
	}

	const needsRef = (type: SchemaPropertyType) => type === 'array' || type === 'object'

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
			<div className="component-json-schema-def__properties">
				{properties.length === 0 && (
					<div className="component-json-schema-def__empty">No properties defined</div>
				)}

				{properties.map((prop, index) => (
					<div className="component-json-schema-def__row" key={index}>
						<input
							type="text"
							className="component-json-schema-def__input component-json-schema-def__input--key"
							placeholder="key"
							value={prop.key}
							disabled={disabled}
							onChange={(e) => updateProperty(index, { key: e.target.value })}
						/>

						<select
							className="component-json-schema-def__select"
							value={prop.type}
							disabled={disabled}
							onChange={(e) => updateProperty(index, { type: e.target.value as SchemaPropertyType })}
						>
							{propertyTypes.map((t) => (
								<option key={t} value={t}>{t}</option>
							))}
						</select>

						{renderDefaultValueInput(prop, index)}

						{needsRef(prop.type) && (
							<select
								className="component-json-schema-def__select component-json-schema-def__select--ref"
								value={prop.objRef ?? ''}
								disabled={disabled}
								onChange={(e) => updateProperty(index, { objRef: e.target.value || undefined })}
							>
								{(prop.type === 'array' ? arrayRefList : objectRefList).map((ref) => (
									<option key={ref.id} value={ref.id}>{ref.label}</option>
								))}
							</select>
						)}

						<button
							type="button"
							className="component-json-schema-def__remove"
							disabled={disabled}
							onClick={() => removeProperty(index)}
							aria-label={`Remove ${prop.key}`}
						>
							<Icon name="x-lg" />
						</button>
					</div>
				))}
			</div>

			<button
				type="button"
				className="component-json-schema-def__add"
				disabled={disabled}
				onClick={addProperty}
			>
				<Icon name="plus-lg" /> Add property
			</button>
		</div>
	)
}
