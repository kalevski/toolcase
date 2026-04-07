import React from 'react'
import { Skeleton } from './Skeleton'

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
	loading?: boolean
	loadingCount?: number
}

export const SingleCardSelect: React.FC<SingleCardSelectProps> = ({
	options,
	value = null,
	onChange,
	columns,
	className = '',
	loading = false,
	loadingCount = 4,
}) => {
	const style = columns
		? { gridTemplateColumns: `repeat(${columns}, 1fr)` } as React.CSSProperties
		: undefined

	if (loading) {
		return (
			<div
				className={`component component-single-card-select${className ? ` ${className}` : ''}`}
				style={style}
			>
				{Array.from({ length: loadingCount }, (_, i) => (
					<div key={i} className="component-single-card-select__card" style={{ padding: '1rem' }}>
						<Skeleton width="60%" />
						<Skeleton width="80%" />
					</div>
				))}
			</div>
		)
	}

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
