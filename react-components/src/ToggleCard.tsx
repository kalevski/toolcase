import React from 'react'
import { Icon } from './Icon'

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

	return (
		<label className={rootClass} onClick={handleClick}>
			{badge && <span className="component-toggle-card__badge">{badge}</span>}

			{icon && (
				<span className="component-toggle-card__icon">
					<Icon name={icon.replace('bi-', '')} />
				</span>
			)}

			<span className="component-toggle-card__switch">
				<span className="component-toggle-card__knob" />
			</span>

			<span className="component-toggle-card__text">
				<span className="component-toggle-card__label">{label}</span>
				{hint && <span className="component-toggle-card__hint">{hint}</span>}
			</span>
		</label>
	)
}
