import React from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'
import { Switch } from './Switch'

export interface ToggleCardProps {
	/** Whether the toggle is on */
	checked?: boolean
	/** Called when the user clicks the card */
	onChange?: (checked: boolean) => void
	/** Primary label text */
	label: string
	/** Optional secondary description text */
	hint?: string
	/** Optional icon class (e.g. "bi-rocket-takeoff") */
	icon?: string
	/** Show a badge in the top-right corner */
	badge?: React.ReactNode
	/** Disable interaction */
	disabled?: boolean
	/** Additional class names */
	className?: string
	/** Show skeleton loading state */
	loading?: boolean
}

export const ToggleCard: React.FC<ToggleCardProps> = ({
	checked = false,
	onChange,
	label,
	hint,
	icon,
	badge,
	disabled = false,
	className = '',
	loading = false,
}) => {
	const handleClick = () => {
		if (!disabled) {
			onChange?.(!checked)
		}
	}

	const rootClass = [
		'component component-toggle-card',
		checked && 'component-toggle-card--on',
		disabled && 'component-toggle-card--disabled',
		className,
	]
		.filter(Boolean)
		.join(' ')

	if (loading) {
		return (
			<div className={rootClass}>
				<Skeleton variant="rect" width="2rem" height="2rem" />
				<span className="component-toggle-card__text">
					<Skeleton width="60%" />
					<Skeleton width="80%" />
				</span>
			</div>
		)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (disabled) return
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault()
			handleClick()
		}
	}

	return (
		<div
			className={rootClass}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			role="switch"
			aria-checked={checked}
			aria-disabled={disabled || undefined}
			aria-label={label}
			tabIndex={disabled ? -1 : 0}
		>
			{badge && <span className="component-toggle-card__badge">{badge}</span>}

			{icon && (
				<span className="component-toggle-card__icon">
					<Icon name={icon.replace('bi-', '')} />
				</span>
			)}

			<span className="component-toggle-card__switch-wrap" aria-hidden="true">
				<Switch checked={checked} disabled={disabled} tabIndex={-1} readOnly />
			</span>

			<span className="component-toggle-card__text">
				<span className="component-toggle-card__label">{label}</span>
				{hint && <span className="component-toggle-card__hint">{hint}</span>}
			</span>
		</div>
	)
}
