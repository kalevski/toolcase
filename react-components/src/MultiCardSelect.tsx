import React from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

export interface MultiCardSelectOption {
	key: string
	title: string
	description?: string
}

export interface MultiCardSelectProps {
	options: MultiCardSelectOption[]
	value?: string[]
	onChange?: (selected: string[]) => void
	/** Submit each selected key in native <form> posts via hidden inputs. */
	name?: string
	columns?: number
	className?: string
	loading?: boolean
	loadingCount?: number
}

export const MultiCardSelect: React.FC<MultiCardSelectProps> = ({
	options,
	value = [],
	onChange,
	name,
	columns,
	className = '',
	loading = false,
	loadingCount = 4,
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

	if (loading) {
		return (
			<div
				className={`component component-multi-card-select${className ? ` ${className}` : ''}`}
				style={style}
			>
				{Array.from({ length: loadingCount }, (_, i) => (
					<div key={i} className="component-multi-card-select__card" style={{ padding: '1rem' }}>
						<Skeleton width="60%" />
						<Skeleton width="80%" />
					</div>
				))}
			</div>
		)
	}

	return (
		<div
			className={`component component-multi-card-select${className ? ` ${className}` : ''}`}
			style={style}
		>
			{name && value.map((key) => <input key={key} type="hidden" name={name} value={key} />)}
			{options.map((opt) => {
				const selected = value.includes(opt.key)
				return (
					<button
						key={opt.key}
						type="button"
						className={`component-multi-card-select__card${selected ? ' component-multi-card-select__card--selected' : ''}`}
						aria-pressed={selected}
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
