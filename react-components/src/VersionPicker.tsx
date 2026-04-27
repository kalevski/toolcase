import React from 'react'
import { Icon } from './Icon'

export interface VersionOption {
	label: string
	value: string
	latest?: boolean
	lts?: boolean
	deprecated?: boolean
}

export interface VersionPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
	versions: VersionOption[]
	value: string
	onChange: (value: string) => void
	variant?: 'segmented' | 'dropdown'
}

export const VersionPicker: React.FC<VersionPickerProps> = ({
	versions,
	value,
	onChange,
	variant = 'segmented',
	className = '',
	...rest
}) => {
	const rootClass = `component component-version-picker component-version-picker--${variant} ${className}`.trim()
	const current = versions.find((v) => v.value === value) ?? versions[0]

	if (variant === 'dropdown') {
		return (
			<div className={rootClass} {...rest}>
				<label className="component-version-picker__label">
					<Icon name="tag" aria-hidden={true} />
					<span className="component-version-picker__label-text">Version</span>
					<select
						className="component-version-picker__select"
						value={value}
						onChange={(e) => onChange(e.target.value)}
					>
						{versions.map((v) => (
							<option key={v.value} value={v.value}>
								{v.label}
								{v.latest ? ' (latest)' : ''}
								{v.lts ? ' (LTS)' : ''}
								{v.deprecated ? ' (deprecated)' : ''}
							</option>
						))}
					</select>
				</label>
			</div>
		)
	}

	return (
		<div className={rootClass} role="radiogroup" aria-label="Version" {...rest}>
			{versions.map((v) => {
				const isActive = v.value === current.value
				return (
					<button
						key={v.value}
						type="button"
						role="radio"
						aria-checked={isActive}
						className={`component-version-picker__option ${isActive ? 'component-version-picker__option--active' : ''} ${v.deprecated ? 'component-version-picker__option--deprecated' : ''}`}
						onClick={() => onChange(v.value)}
					>
						<span className="component-version-picker__option-label">{v.label}</span>
						{v.latest ? <span className="component-version-picker__tag">latest</span> : null}
						{v.lts ? <span className="component-version-picker__tag component-version-picker__tag--lts">LTS</span> : null}
						{v.deprecated ? <span className="component-version-picker__tag component-version-picker__tag--deprecated">old</span> : null}
					</button>
				)
			})}
		</div>
	)
}

export default VersionPicker
