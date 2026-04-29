import React from 'react'

export interface ChipGroupItem {
	id: string
	label: React.ReactNode
	active?: boolean
	disabled?: boolean
	count?: number | string
}

export interface ChipGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'onToggle'> {
	title?: React.ReactNode
	subtitle?: React.ReactNode
	items: ChipGroupItem[]
	onToggle?: (id: string) => void
	border?: boolean
}

export const ChipGroup: React.FC<ChipGroupProps> = ({
	title,
	subtitle,
	items,
	onToggle,
	border = false,
	className = '',
	...rest
}) => {
	const rootClass = [
		'component component-chip-group',
		border ? 'component-chip-group--bordered' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass} {...rest}>
			{title && <h4 className="component-chip-group__title">{title}</h4>}
			{subtitle && <div className="component-chip-group__sub">{subtitle}</div>}
			<div className="component-chip-group__chips" role="group">
				{items.map((it) => {
					const cls = [
						'component-chip-group__chip',
						it.active ? 'component-chip-group__chip--on' : '',
						it.disabled ? 'component-chip-group__chip--off' : '',
					].filter(Boolean).join(' ')
					const interactive = !!onToggle && !it.disabled
					return (
						<button
							key={it.id}
							type="button"
							className={cls}
							onClick={interactive ? () => onToggle!(it.id) : undefined}
							disabled={it.disabled}
							aria-pressed={it.active ?? false}
						>
							<span className="component-chip-group__chip-label">{it.label}</span>
							{it.count !== undefined && (
								<span className="component-chip-group__chip-count">×{it.count}</span>
							)}
						</button>
					)
				})}
			</div>
		</div>
	)
}
