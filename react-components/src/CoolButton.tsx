import React, { forwardRef } from 'react'
import { Button } from './Button'

export type CoolButtonBaseProps = React.ComponentPropsWithoutRef<typeof Button>

export interface CoolButtonProps extends Omit<CoolButtonBaseProps, 'children'> {
	children?: React.ReactNode
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
			className,
			...rest
		},
		ref,
	) => {
		const shouldShowSeparator = typeof showSeparator === 'boolean' ? showSeparator : Boolean(addon)
		const primaryContent = children ?? label ?? '[LABEL]'
		const rootClassName = ['component component-cool-button', className].filter(Boolean).join(' ')
		const innerClassNames = ['component-cool-button__inner', innerClassName].filter(Boolean).join(' ')
		const separatorClassNames = ['component-cool-button__separator', separatorClassName].filter(Boolean).join(' ')

		const leftAddon =
			addon && addonPosition === 'left' ? (
				<>
					<span className="component-cool-button__addon">{addon}</span>
					{shouldShowSeparator && <span className={separatorClassNames} aria-hidden="true" />}
				</>
			) : null

		const rightAddon =
			addon && addonPosition === 'right' ? (
				<>
					{shouldShowSeparator && <span className={separatorClassNames} aria-hidden="true" />}
					<span className="component-cool-button__addon">{addon}</span>
				</>
			) : null

		return (
			<Button {...rest} ref={ref} className={rootClassName} label={undefined}>
				<span className={innerClassNames}>
					{leftAddon}
					<span className="component-cool-button__label">{primaryContent}</span>
					{rightAddon}
				</span>
			</Button>
		)
	},
)

CoolButton.displayName = 'CoolButton'
