import type { FC, HTMLAttributes, ReactNode } from 'react'

export type ConfigPreviewValue = string | number | boolean

export interface ConfigPreviewEntry {
	key: string
	value: ConfigPreviewValue
	live?: boolean
}

export interface ConfigPreviewProps extends HTMLAttributes<HTMLDivElement> {
	entries?: ConfigPreviewEntry[]
	liveLabel?: ReactNode
}

const formatValue = (value: ConfigPreviewValue) => {
	if (typeof value === 'string') return { className: 'component-config-preview__str', text: `"${value}"` }
	if (typeof value === 'number') return { className: 'component-config-preview__num', text: String(value) }
	return { className: 'component-config-preview__bool', text: value ? 'true' : 'false' }
}

export const ConfigPreview: FC<ConfigPreviewProps> = ({
	entries = [],
	liveLabel = 'live',
	className,
	children,
	...rest
}) => {
	const rootClassName = ['component', 'component-config-preview', className].filter(Boolean).join(' ')
	const total = entries.length

	return (
		<div className={rootClassName} {...rest}>
			{children ?? (
				<>
					<div>
						<span className="component-config-preview__punct">{'{'}</span>
					</div>
					{entries.map((entry, index) => {
						const { className: valueClass, text } = formatValue(entry.value)
						const isLast = index === total - 1
						return (
							<div key={entry.key} className="component-config-preview__line">
								<span className="component-config-preview__indent">&nbsp;&nbsp;</span>
								<span className="component-config-preview__key">&quot;{entry.key}&quot;</span>
								<span className="component-config-preview__punct">:</span>{' '}
								<span className={valueClass}>{text}</span>
								{!isLast && <span className="component-config-preview__punct">,</span>}
								{entry.live && (
									<span className="component-config-preview__tweak">
										<span className="component-config-preview__tweak-dot" aria-hidden="true" />
										{liveLabel}
									</span>
								)}
							</div>
						)
					})}
					<div>
						<span className="component-config-preview__punct">{'}'}</span>
					</div>
				</>
			)}
		</div>
	)
}

ConfigPreview.displayName = 'ConfigPreview'
