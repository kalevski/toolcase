import type { FC, HTMLAttributes, ReactNode } from 'react'

export interface BundleBarChip {
	label: string
	active?: boolean
	icon?: ReactNode
}

export interface BundleBarProps extends HTMLAttributes<HTMLDivElement> {
	chips?: BundleBarChip[]
	segments?: number
	filledSegments?: number
	name?: ReactNode
	meta?: ReactNode
}

export const BundleBar: FC<BundleBarProps> = ({
	chips = [],
	segments = 12,
	filledSegments = Math.floor(segments / 2),
	name,
	meta,
	className,
	...rest
}) => {
	const rootClassName = ['component', 'component-bundle-bar', className].filter(Boolean).join(' ')
	const totalSegments = Math.max(0, segments)
	const filled = Math.max(0, Math.min(totalSegments, filledSegments))

	return (
		<div className={rootClassName} {...rest}>
			{chips.length > 0 && (
				<div className="component-bundle-bar__chips">
					{chips.map((chip) => (
						<span
							key={chip.label}
							className={[
								'component-bundle-bar__chip',
								chip.active && 'component-bundle-bar__chip--active',
							]
								.filter(Boolean)
								.join(' ')}
						>
							{chip.icon && <span className="component-bundle-bar__chip-icon" aria-hidden="true">{chip.icon}</span>}
							{chip.label}
						</span>
					))}
				</div>
			)}
			{totalSegments > 0 && (
				<div
					className="component-bundle-bar__bar"
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={totalSegments}
					aria-valuenow={filled}
				>
					{Array.from({ length: totalSegments }).map((_, index) => (
						<span
							key={index}
							className={[
								'component-bundle-bar__segment',
								index < filled && 'component-bundle-bar__segment--filled',
							]
								.filter(Boolean)
								.join(' ')}
						/>
					))}
				</div>
			)}
			{(name || meta) && (
				<div className="component-bundle-bar__meta">
					{name && <span className="component-bundle-bar__name">{name}</span>}
					{meta && <span className="component-bundle-bar__detail">{meta}</span>}
				</div>
			)}
		</div>
	)
}

BundleBar.displayName = 'BundleBar'
