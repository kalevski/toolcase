import React from 'react'
import { Icon } from './Icon'

export interface CardOption {
	key: string
	icon?: string
	imgSrc?: string
	title: string
	description: string
}

export interface CardOptionsProps {
	options: CardOption[]
	value?: string | null
	onChange?: (key: string) => void
	columns?: number
	className?: string
}

export const CardOptions: React.FC<CardOptionsProps> = ({
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
			className={`component component-card-options${className ? ` ${className}` : ''}`}
			style={style}
		>
			{options.map((opt) => {
				const selected = value === opt.key
				return (
					<button
						key={opt.key}
						type="button"
						className={`component-card-options__card${selected ? ' component-card-options__card--selected' : ''}`}
						onClick={() => onChange?.(opt.key)}
					>
						<div className="component-card-options__visual">
							{opt.imgSrc ? (
								<img src={opt.imgSrc} alt={opt.title} className="component-card-options__img" />
							) : (
								<Icon name={opt.icon || 'box'} className="component-card-options__icon" />
							)}
						</div>
						<span className="component-card-options__title">{opt.title}</span>
						<span className="component-card-options__desc">{opt.description}</span>
						{selected && (
							<span className="component-card-options__check">
							<Icon name="check-circle-fill" />
							</span>
						)}
					</button>
				)
			})}
		</div>
	)
}
