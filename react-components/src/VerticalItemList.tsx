import React, { useState } from 'react'
import { Icon } from './Icon'
import { Badge } from './Badge'
import { Skeleton } from './Skeleton'

export interface VerticalItemListItem {
	key: string
	icon?: string
	text: string
	badge?: string | number
}

export interface VerticalItemListProps {
	items: VerticalItemListItem[]
	activeKey?: string
	defaultActiveKey?: string
	onSelect?: (key: string) => void
	children?: React.ReactNode
	disabled?: boolean
	className?: string
	loading?: boolean
	loadingCount?: number
}

export const VerticalItemList: React.FC<VerticalItemListProps> = ({
	items,
	activeKey,
	defaultActiveKey,
	onSelect,
	children,
	disabled = false,
	className = '',
	loading = false,
	loadingCount = 5,
}) => {
	const isControlled = activeKey !== undefined
	const [internalKey, setInternalKey] = useState(defaultActiveKey ?? '')
	const selected = isControlled ? activeKey : internalKey

	const handleSelect = (key: string) => {
		if (disabled) return
		if (!isControlled) setInternalKey(key)
		onSelect?.(key)
	}

	return (
		<div className={`component component-vertical-item-list${className ? ` ${className}` : ''}`}>
			<nav className="component-vertical-item-list__nav">
				{loading ? (
					Array.from({ length: loadingCount }, (_, i) => (
						<div key={i} className="component-vertical-item-list__item" style={{ padding: '0.625rem 1rem' }}>
							<Skeleton />
						</div>
					))
				) : items.map((item) => (
					<button
						key={item.key}
						type="button"
						className={`component-vertical-item-list__item${selected === item.key ? ' component-vertical-item-list__item--active' : ''}`}
						disabled={disabled}
						onClick={() => handleSelect(item.key)}
					>
						{item.icon && <Icon name={item.icon} className="component-vertical-item-list__icon" />}
						<span className="component-vertical-item-list__text">{item.text}</span>
						{item.badge !== undefined && (
							<Badge variant="primary" pill>{item.badge}</Badge>
						)}
					</button>
				))}
			</nav>
			<div className="component-vertical-item-list__content">
				{children}
			</div>
		</div>
	)
}
