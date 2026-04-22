import React, { forwardRef } from 'react'

export type CoolButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
export type CoolButtonSize = 'small' | 'default' | 'large'

export interface CoolButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
	children?: React.ReactNode
	label?: React.ReactNode
	variant?: CoolButtonVariant
	size?: CoolButtonSize
	outline?: boolean
	loading?: boolean
	addon?: React.ReactNode
	addonPosition?: 'left' | 'right'
	showSeparator?: boolean
	separatorClassName?: string
	innerClassName?: string
}

export const CoolButton = forwardRef<HTMLButtonElement, CoolButtonProps>(
	(
		{
			addon,
			addonPosition = 'right',
			showSeparator,
			separatorClassName,
			innerClassName,
			children,
			label,
			variant = 'primary',
			size = 'default',
			outline = false,
			loading = false,
			disabled,
			className,
			type = 'button',
			...rest
		},
		ref,
	) => {
		const shouldShowSeparator = typeof showSeparator === 'boolean' ? showSeparator : Boolean(addon)
		const primaryContent = children ?? label ?? '[LABEL]'

		const rootClassName = [
			'component',
			'component-cool-button',
			`component-cool-button--${variant}`,
			`component-cool-button--${size}`,
			outline && 'component-cool-button--outline',
			loading && 'component-cool-button--loading',
			className,
		]
			.filter(Boolean)
			.join(' ')

		const innerClassNames = ['component-cool-button__inner', innerClassName].filter(Boolean).join(' ')
		const separatorClassNames = ['component-cool-button__separator', separatorClassName].filter(Boolean).join(' ')

		const addonNode = addon ? <span className="component-cool-button__addon" aria-hidden="true">{addon}</span> : null

		return (
			<button
				{...rest}
				ref={ref}
				type={type}
				disabled={disabled || loading}
				className={rootClassName}
			>
				<span className={innerClassNames}>
					{addon && addonPosition === 'left' && (
						<>
							{addonNode}
							{shouldShowSeparator && <span className={separatorClassNames} aria-hidden="true" />}
						</>
					)}
					<span className="component-cool-button__label">{primaryContent}</span>
					{addon && addonPosition === 'right' && (
						<>
							{shouldShowSeparator && <span className={separatorClassNames} aria-hidden="true" />}
							{addonNode}
						</>
					)}
				</span>
			</button>
		)
	},
)

CoolButton.displayName = 'CoolButton'
