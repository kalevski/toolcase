import React from 'react'
import { Icon } from './Icon'

export interface MultiCardSelectOption {
	key: string
	title: string
	description?: string
}

export interface MultiCardSelectProps {
	options: MultiCardSelectOption[]
	value?: string[]
	onChange?: (selected: string[]) => void
	columns?: number
	className?: string
}

export const MultiCardSelect: React.FC<MultiCardSelectProps> = ({
	options,
	value = [],
	onChange,
	columns,
	className = '',
}) => {
	const style = columns
		? { gridTemplateColumns: `repeat(${columns}, 1fr)` } as React.CSSProperties
		: undefined

	const toggle = (key: string) => {
		const next = value.includes(key)
			? value.filter((k) => k !== key)
			: [...value, key]
		onChange?.(next)
	}

	return (
		<div
			className={`component component-multi-card-select${className ? ` ${className}` : ''}`}
			style={style}
		>
			{options.map((opt) => {
				const selected = value.includes(opt.key)
				return (
					<button
						key={opt.key}
						type="button"
						className={`component-multi-card-select__card${selected ? ' component-multi-card-select__card--selected' : ''}`}
						onClick={() => toggle(opt.key)}
					>
						<span className="component-multi-card-select__check">
							{selected
								? <Icon name="check-square-fill" />
								: <Icon name="square" />
							}
						</span>
						<span className="component-multi-card-select__body">
							<span className="component-multi-card-select__title">{opt.title}</span>
							{opt.description && (
								<span className="component-multi-card-select__desc">{opt.description}</span>
							)}
						</span>
					</button>
				)
			})}
		</div>
	)
}
