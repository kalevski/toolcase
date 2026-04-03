import React from 'react'

export interface SingleCardSelectOption {
	key: string
	title: string
	description?: string
}

export interface SingleCardSelectProps {
	options: SingleCardSelectOption[]
	value?: string | null
	onChange?: (selected: string) => void
	columns?: number
	className?: string
}

export const SingleCardSelect: React.FC<SingleCardSelectProps> = ({
	options,
	value = null,
	onChange,
	columns,
	className = '',
}) => {
	const style = columns
		? { gridTemplateColumns: `repeat(${columns}, 1fr)` } as React.CSSProperties
		: undefined

	return (
		<div
			className={`component component-single-card-select${className ? ` ${className}` : ''}`}
			style={style}
		>
			{options.map((opt) => {
				const selected = value === opt.key
				return (
					<button
						key={opt.key}
						type="button"
						className={`component-single-card-select__card${selected ? ' component-single-card-select__card--selected' : ''}`}
						onClick={() => onChange?.(opt.key)}
					>
						<span className="component-single-card-select__body">
							<span className="component-single-card-select__title">{opt.title}</span>
							{opt.description && (
								<span className="component-single-card-select__desc">{opt.description}</span>
							)}
						</span>
					</button>
				)
			})}
		</div>
	)
}
