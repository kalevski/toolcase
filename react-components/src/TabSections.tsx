import React, { useState } from 'react'
import { Skeleton } from './Skeleton'

export interface TabSectionItem {
	key: string
	label: React.ReactNode
	content: React.ReactNode
	disabled?: boolean
}

export interface TabSectionsProps {
	items: TabSectionItem[]
	defaultActiveKey?: string
	activeKey?: string
	onChange?: (key: string) => void
	className?: string
	loading?: boolean
}

export const TabSections: React.FC<TabSectionsProps> = ({
	items,
	defaultActiveKey,
	activeKey: controlledKey,
	onChange,
	className = '',
	loading = false,
}) => {
	const [internalKey, setInternalKey] = useState(defaultActiveKey || items[0]?.key || '')

	const isControlled = controlledKey !== undefined
	const activeKey = isControlled ? controlledKey : internalKey

	const handleSelect = (key: string) => {
		if (!isControlled) setInternalKey(key)
		onChange?.(key)
	}

	const activeItem = items.find((item) => item.key === activeKey)

	return (
		<div className={`component component-tab-sections${className ? ` ${className}` : ''}`}>
			<div className="component-tab-sections__header">
				<div className="component-tab-sections__tabs">
					{items.map((item) => (
						<button
							key={item.key}
							className={`component-tab-sections__tab${item.key === activeKey ? ' component-tab-sections__tab--active' : ''}${item.disabled ? ' component-tab-sections__tab--disabled' : ''}`}
							onClick={() => handleSelect(item.key)}
							disabled={item.disabled}
							type="button"
						>
							<span className="component-tab-sections__tab-label">{item.label}</span>
						</button>
					))}
				</div>
			</div>
			<div className="component-tab-sections__body">
				{loading ? <Skeleton count={3} /> : activeItem?.content}
			</div>
		</div>
	)
}
