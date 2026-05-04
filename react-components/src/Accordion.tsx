import React, { useId, useState } from 'react'
import { Icon } from './Icon'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AccordionItem {
	key: string
	title: React.ReactNode
	content: React.ReactNode
	disabled?: boolean
}

export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
	items: AccordionItem[]
	/**
	 * Allow multiple panels to be open simultaneously.
	 * Default: false (single-open mode).
	 */
	multiple?: boolean
	/** Keys of initially-open panels (uncontrolled). */
	defaultOpen?: string[]
	/** Controlled open keys. Requires `onOpenChange`. */
	open?: string[]
	onOpenChange?: (keys: string[]) => void
	variant?: 'bordered' | 'borderless'
	className?: string
}

export const Accordion: React.FC<AccordionProps> = ({
	items,
	multiple = false,
	defaultOpen = [],
	open: openProp,
	onOpenChange,
	variant = 'bordered',
	className = '',
	...rest
}) => {
	const isControlled = openProp !== undefined
	const [internalOpen, setInternalOpen] = useState<string[]>(defaultOpen)
	const openKeys = isControlled ? openProp! : internalOpen
	const baseId = useId()

	const toggle = (key: string) => {
		let next: string[]
		if (openKeys.includes(key)) {
			next = openKeys.filter((k) => k !== key)
		} else {
			next = multiple ? [...openKeys, key] : [key]
		}
		if (!isControlled) setInternalOpen(next)
		onOpenChange?.(next)
	}

	const rootClass = [
		'component component-accordion',
		`component-accordion--${variant}`,
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass} {...rest}>
			{items.map((item) => {
				const isOpen = openKeys.includes(item.key)
				const headingId = `${baseId}-heading-${item.key}`
				const panelId = `${baseId}-panel-${item.key}`

				return (
					<div
						key={item.key}
						className={[
							'component-accordion__item',
							isOpen ? 'component-accordion__item--open' : '',
							item.disabled ? 'component-accordion__item--disabled' : '',
						].filter(Boolean).join(' ')}
					>
						<h3 className="component-accordion__heading" id={headingId}>
							<button
								type="button"
								className="component-accordion__trigger"
								aria-expanded={isOpen}
								aria-controls={panelId}
								aria-disabled={item.disabled || undefined}
								disabled={item.disabled}
								onClick={() => !item.disabled && toggle(item.key)}
							>
								<span className="component-accordion__trigger-label">{item.title}</span>
								<span className="component-accordion__chevron" aria-hidden="true">
									<Icon name="chevron-down" />
								</span>
							</button>
						</h3>
						<div
							id={panelId}
							role="region"
							aria-labelledby={headingId}
							className="component-accordion__panel"
							aria-hidden={!isOpen ? true : undefined}
						>
							<div className="component-accordion__content">
								{item.content}
							</div>
						</div>
					</div>
				)
			})}
		</div>
	)
}

// expose a helper ref for programmatic control
export type AccordionRef = {
	openAll: () => void
	closeAll: () => void
}
