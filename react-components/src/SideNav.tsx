import React, { useId } from 'react'
import { Icon } from './Icon'
import { Badge } from './Badge'

export interface SideNavItem {
	key?: string
	label: React.ReactNode
	icon?: string
	href?: string
	active?: boolean
	badge?: React.ReactNode
	target?: string
	rel?: string
	disabled?: boolean
}

export interface SideNavSection {
	key?: string
	title?: string
	items: SideNavItem[]
}

export interface SideNavProps extends React.HTMLAttributes<HTMLElement> {
	sections?: SideNavSection[]
	onItemClick?: (event: React.MouseEvent<HTMLAnchorElement>, item: SideNavItem) => void
}

export const SideNav: React.FC<SideNavProps> = ({
	sections = [],
	onItemClick,
	className,
	...rest
}) => {
	const reactId = useId()

	const navClassName = ['component component-side-nav', className || '']
		.filter(Boolean)
		.join(' ')

	return (
		<nav className={navClassName} {...rest}>
			{sections.map((section, sIndex) => {
				const sectionKey = section.key || `side-nav-section-${reactId}-${sIndex}`
				return (
					<div key={sectionKey} className="component-side-nav__section">
						{section.title && (
							<div className="component-side-nav__section-title">{section.title}</div>
						)}
						<ul className="component-side-nav__list">
							{section.items.map((item, iIndex) => {
									const itemKey = item.key || `side-nav-item-${reactId}-${sIndex}-${iIndex}`
									const itemClassName = [
										'component-side-nav__item',
										item.active ? 'component-side-nav__item--active' : '',
										item.disabled ? 'component-side-nav__item--disabled' : '',
								]
									.filter(Boolean)
									.join(' ')

								return (
									<li key={itemKey} className={itemClassName}>
										<a
											className="component-side-nav__link"
											href={item.disabled ? undefined : (item.href || '#')}
											target={item.target}
											rel={item.rel}
											aria-disabled={item.disabled || undefined}
											onClick={(event) => {
												if (item.disabled) {
													event.preventDefault()
													return
												}
												if (onItemClick) {
													if (item.disabled) {
														event.preventDefault()
														return
													}
													onItemClick(event, item)
												}
											}}
										>
											{item.icon && (
													<span className="component-side-nav__item-icon">
													<Icon name={item.icon} size={18} />
												</span>
											)}
												<span className="component-side-nav__item-label">{item.label}</span>
											{item.badge && (
													<span className="component-side-nav__item-badge">
													{typeof item.badge === 'string' || typeof item.badge === 'number' ? (
														<Badge variant="primary" pill>{item.badge}</Badge>
													) : (
														item.badge
													)}
												</span>
											)}
										</a>
									</li>
								)
							})}
						</ul>
					</div>
				)
			})}
		</nav>
	)
}
