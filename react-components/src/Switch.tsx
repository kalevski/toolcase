import React from 'react'

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
	label?: string
	size?: 'small' | 'default' | 'large'
}

export const Switch: React.FC<SwitchProps> = ({
	label,
	size = 'default',
	className = '',
	id,
	...props
}) => {
	const rootClass = [
		'component component-switch',
		`component-switch--${size}`,
		props.disabled ? 'component-switch--disabled' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<label className={rootClass} htmlFor={id}>
			<input {...props} type="checkbox" id={id} className="component-switch__input" />
			<span className="component-switch__track">
				<span className="component-switch__knob" />
			</span>
			{label && <span className="component-switch__label">{label}</span>}
		</label>
	)
}
