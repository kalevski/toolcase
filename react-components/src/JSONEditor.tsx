import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

export interface JSONEditorSchemaProperty {
	key: string
	type: 'string' | 'number' | 'boolean' | 'array' | 'object'
	defaultValue?: unknown
	itemType?: 'string' | 'number' | 'boolean'
	properties?: JSONEditorSchemaProperty[]
}

export interface JSONEditorProps {
	schema: string
	value?: Record<string, unknown>
	defaultValue?: Record<string, unknown>
	onChange?: (value: Record<string, unknown>) => void
	disabled?: boolean
	className?: string
	loading?: boolean
}

const parseSchema = (raw: string): JSONEditorSchemaProperty[] => {
	try {
		const parsed = JSON.parse(raw)
		if (Array.isArray(parsed)) {
			return parsed as JSONEditorSchemaProperty[]
		}
	} catch {
		/* ignore */
	}
	return []
}

const buildDefault = (schema: JSONEditorSchemaProperty[]): Record<string, unknown> => {
	const obj: Record<string, unknown> = {}
	for (const prop of schema) {
		if (prop.type === 'array') {
			obj[prop.key] = []
		} else if (prop.type === 'object') {
			obj[prop.key] = prop.properties ? buildDefault(prop.properties) : {}
		} else {
			obj[prop.key] = prop.defaultValue ?? getTypeDefault(prop.type)
		}
	}
	return obj
}

const getTypeDefault = (type: string): unknown => {
	switch (type) {
		case 'string': return ''
		case 'number': return 0
		case 'boolean': return false
		default: return ''
	}
}

const buildArrayItemDefault = (properties: JSONEditorSchemaProperty[]): Record<string, unknown> => {
	return buildDefault(properties)
}

export const JSONEditor: React.FC<JSONEditorProps> = ({
	schema,
	value,
	defaultValue,
	onChange,
	disabled = false,
	className = '',
	loading = false,
}) => {
	const schemaDef = parseSchema(schema)
	const isControlled = value !== undefined
	const [internalValue, setInternalValue] = useState<Record<string, unknown>>(
		() => defaultValue ?? buildDefault(schemaDef),
	)
	const data = isControlled ? value : internalValue

	const onChangeRef = useRef(onChange)
	useEffect(() => { onChangeRef.current = onChange }, [onChange])

	const emit = useCallback(
		(next: Record<string, unknown>) => {
			if (!isControlled) setInternalValue(next)
			onChangeRef.current?.(next)
		},
		[isControlled],
	)

	const setPath = (obj: Record<string, unknown>, path: (string | number)[], val: unknown): Record<string, unknown> => {
		if (path.length === 0) return obj
		const clone = Array.isArray(obj) ? [...obj] : { ...obj }
		const [head, ...rest] = path
		if (rest.length === 0) {
			;(clone as Record<string | number, unknown>)[head] = val
		} else {
			const child = (clone as Record<string | number, unknown>)[head]
			const next = child ?? (typeof rest[0] === 'number' ? [] : {})
			;(clone as Record<string | number, unknown>)[head] = setPath(
				next as Record<string, unknown>,
				rest,
				val,
			)
		}
		return clone as Record<string, unknown>
	}

	const removePath = (obj: Record<string, unknown>, path: (string | number)[], index: number): Record<string, unknown> => {
		if (path.length === 0) return obj
		const clone = Array.isArray(obj) ? [...obj] : { ...obj }
		if (path.length === 1) {
			const arr = (clone as Record<string | number, unknown>)[path[0]]
			if (Array.isArray(arr)) {
				;(clone as Record<string | number, unknown>)[path[0]] = arr.filter((_, i) => i !== index)
			}
		} else {
			const [head, ...rest] = path
			const child = (clone as Record<string | number, unknown>)[head]
			;(clone as Record<string | number, unknown>)[head] = removePath(
				(child ?? {}) as Record<string, unknown>,
				rest,
				index,
			)
		}
		return clone as Record<string, unknown>
	}

	const addArrayItem = (path: (string | number)[], itemDef: JSONEditorSchemaProperty[]) => {
		const arr = getValueAtPath(data, path)
		const items = Array.isArray(arr) ? arr : []
		const newItem = buildArrayItemDefault(itemDef)
		emit(setPath(data, [...path, items.length], newItem))
	}

	const addPrimitiveArrayItem = (path: (string | number)[], itemType: string) => {
		const arr = getValueAtPath(data, path)
		const items = Array.isArray(arr) ? arr : []
		emit(setPath(data, [...path, items.length], getTypeDefault(itemType)))
	}

	const removeArrayItem = (path: (string | number)[], index: number) => {
		emit(removePath(data, path, index))
	}

	const updateValue = (path: (string | number)[], val: unknown) => {
		emit(setPath(data, path, val))
	}

	const getValueAtPath = (obj: unknown, path: (string | number)[]): unknown => {
		let current = obj
		for (const seg of path) {
			if (current == null || typeof current !== 'object') return undefined
			current = (current as Record<string | number, unknown>)[seg]
		}
		return current
	}

	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

	const isCollapsed = (pathKey: string) => collapsed[pathKey] ?? true

	const toggleCollapse = (pathKey: string) => {
		setCollapsed((prev) => ({ ...prev, [pathKey]: !isCollapsed(pathKey) }))
	}

	const renderProperty = (prop: JSONEditorSchemaProperty, path: (string | number)[], depth: number) => {
		const currentValue = getValueAtPath(data, path)
		const pathKey = path.join('.')

		if (prop.type === 'array' && prop.properties) {
			const items = Array.isArray(currentValue) ? (currentValue as Record<string, unknown>[]) : []

			return (
				<div className="component-json-editor__group" key={pathKey} style={{ marginLeft: depth > 0 ? 16 : 0 }}>
					<div className="component-json-editor__group-header">
						<button
							type="button"
							className="component-json-editor__collapse"
							onClick={() => toggleCollapse(pathKey)}
							aria-label={isCollapsed(pathKey) ? 'Expand' : 'Collapse'}
						>
							<Icon name={isCollapsed(pathKey) ? 'chevron-right' : 'chevron-down'} />
						</button>
						<span className="component-json-editor__group-label">{prop.key}</span>
						<span className="component-json-editor__group-badge">{items.length} items</span>
						<button
							type="button"
							className="component-json-editor__add-item"
							disabled={disabled}
							onClick={() => addArrayItem(path, prop.properties!)}
							aria-label={`Add item to ${prop.key}`}
						>
							<Icon name="plus-lg" />
						</button>
					</div>

					{!isCollapsed(pathKey) && (
						<div className="component-json-editor__array-items">
							{items.map((_, itemIdx) => {
								const itemPathKey = `${pathKey}.${itemIdx}`
								return (
									<div className="component-json-editor__array-item" key={itemIdx}>
										<div className="component-json-editor__array-item-header">
											<button
												type="button"
												className="component-json-editor__collapse"
												onClick={() => toggleCollapse(itemPathKey)}
												aria-label={isCollapsed(itemPathKey) ? 'Expand' : 'Collapse'}
											>
												<Icon name={isCollapsed(itemPathKey) ? 'chevron-right' : 'chevron-down'} />
											</button>
											<span className="component-json-editor__array-item-index">{itemIdx}</span>
											<button
												type="button"
												className="component-json-editor__remove"
												disabled={disabled}
												onClick={() => removeArrayItem(path, itemIdx)}
												aria-label={`Remove item ${itemIdx}`}
											>
												<Icon name="x-lg" />
											</button>
										</div>
										{!isCollapsed(itemPathKey) && (
											<div className="component-json-editor__array-item-fields">
												{prop.properties!.map((childProp) =>
													renderProperty(childProp, [...path, itemIdx, childProp.key], depth + 1),
												)}
											</div>
										)}
									</div>
								)
							})}
							{items.length === 0 && (
								<div className="component-json-editor__empty">No items</div>
							)}
						</div>
					)}
				</div>
			)
		}

		if (prop.type === 'object' && prop.properties) {
			return (
				<div className="component-json-editor__group" key={pathKey} style={{ marginLeft: depth > 0 ? 16 : 0 }}>
					<div className="component-json-editor__group-header">
						<button
							type="button"
							className="component-json-editor__collapse"
							onClick={() => toggleCollapse(pathKey)}
							aria-label={isCollapsed(pathKey) ? 'Expand' : 'Collapse'}
						>
							<Icon name={isCollapsed(pathKey) ? 'chevron-right' : 'chevron-down'} />
						</button>
						<span className="component-json-editor__group-label">{prop.key}</span>
					</div>

					{!isCollapsed(pathKey) && (
						<div className="component-json-editor__object-fields">
							{prop.properties.map((childProp) =>
								renderProperty(childProp, [...path, childProp.key], depth + 1),
							)}
						</div>
					)}
				</div>
			)
		}

		if (prop.type === 'array' && prop.itemType) {
			const items = Array.isArray(currentValue) ? currentValue : []

			return (
				<div className="component-json-editor__group" key={pathKey} style={{ marginLeft: depth > 0 ? 16 : 0 }}>
					<div className="component-json-editor__group-header">
						<button
							type="button"
							className="component-json-editor__collapse"
							onClick={() => toggleCollapse(pathKey)}
							aria-label={isCollapsed(pathKey) ? 'Expand' : 'Collapse'}
						>
							<Icon name={isCollapsed(pathKey) ? 'chevron-right' : 'chevron-down'} />
						</button>
						<span className="component-json-editor__group-label">{prop.key}</span>
						<span className="component-json-editor__group-badge">{items.length} items</span>
						<button
							type="button"
							className="component-json-editor__add-item"
							disabled={disabled}
							onClick={() => addPrimitiveArrayItem(path, prop.itemType!)}
							aria-label={`Add item to ${prop.key}`}
						>
							<Icon name="plus-lg" />
						</button>
					</div>

					{!isCollapsed(pathKey) && (
						<div className="component-json-editor__primitive-list">
							{items.map((item, itemIdx) => (
								<div className="component-json-editor__primitive-item" key={itemIdx}>
									{prop.itemType === 'boolean' ? (
										<select
											className="component-json-editor__primitive-input component-json-editor__primitive-input--select"
											value={String(item ?? false)}
											disabled={disabled}
											onChange={(e) => updateValue([...path, itemIdx], e.target.value === 'true')}
										>
											<option value="true">true</option>
											<option value="false">false</option>
										</select>
									) : (
										<input
											type={prop.itemType === 'number' ? 'number' : 'text'}
											className="component-json-editor__primitive-input"
											value={prop.itemType === 'number' ? (item as number ?? 0) : ((item as string) ?? '')}
											disabled={disabled}
											onChange={(e) => updateValue(
												[...path, itemIdx],
												prop.itemType === 'number' ? Number(e.target.value) : e.target.value,
											)}
										/>
									)}
									<button
										type="button"
										className="component-json-editor__primitive-remove"
										disabled={disabled}
										onClick={() => removeArrayItem(path, itemIdx)}
										aria-label={`Remove item ${itemIdx}`}
									>
										<Icon name="x" />
									</button>
								</div>
							))}
							{items.length === 0 && (
								<div className="component-json-editor__empty">No items</div>
							)}
						</div>
					)}
				</div>
			)
		}

		return (
			<div className="component-json-editor__row" key={pathKey} style={{ marginLeft: depth > 0 ? 16 : 0 }}>
				<label className="component-json-editor__key">{prop.key}</label>
				{renderValueInput(prop, path, currentValue)}
			</div>
		)
	}

	const renderValueInput = (prop: JSONEditorSchemaProperty, path: (string | number)[], currentValue: unknown) => {
		switch (prop.type) {
			case 'boolean':
				return (
					<select
						className="component-json-editor__select"
						value={String(currentValue ?? false)}
						disabled={disabled}
						onChange={(e) => updateValue(path, e.target.value === 'true')}
					>
						<option value="true">true</option>
						<option value="false">false</option>
					</select>
				)
			case 'number':
				return (
					<input
						type="number"
						className="component-json-editor__input"
						value={currentValue as number ?? 0}
						disabled={disabled}
						onChange={(e) => updateValue(path, Number(e.target.value))}
					/>
				)
			default:
				return (
					<input
						type="text"
						className="component-json-editor__input"
						value={(currentValue as string) ?? ''}
						disabled={disabled}
						onChange={(e) => updateValue(path, e.target.value)}
					/>
				)
		}
	}

	if (loading) {
		return (
			<div className={`component component-json-editor${className ? ` ${className}` : ''}`}>
				<Skeleton count={5} />
			</div>
		)
	}

	return (
		<div className={`component component-json-editor${className ? ` ${className}` : ''}`}>
			{schemaDef.map((prop) => renderProperty(prop, [prop.key], 0))}
		</div>
	)
}
