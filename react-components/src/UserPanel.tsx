import React from 'react'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { IconButton } from './IconButton'
import { Skeleton } from './Skeleton'
import { usePopup } from './hooks/usePopup'

export interface UserPanelMenuItem {
	key: string
	label: string
	icon?: string
}

export interface UserPanelProps extends React.HTMLAttributes<HTMLDivElement> {
	avatarSrc?: string
	username: string
	initials?: string
	plan?: string
	onIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
	icon?: string
	iconHighlighted?: boolean
	menuItems?: UserPanelMenuItem[]
	onMenuClick?: (e: React.MouseEvent<HTMLButtonElement>, key: string) => void
	loading?: boolean
}

export const UserPanel: React.FC<UserPanelProps> = ({
	avatarSrc,
	username,
	initials,
	plan = 'Free',
	onIconClick,
	icon = 'gear',
	iconHighlighted = false,
	menuItems,
	onMenuClick,
	loading = false,
	...props
}) => {
	const [direction, setDirection] = React.useState<'up' | 'down'>('up')
	const popup = usePopup<HTMLDivElement, HTMLDivElement>({ arrowNav: true })

	const hasMenu = menuItems && menuItems.length > 0

	const toggleMenu = () => {
		if (!hasMenu) return
		if (!popup.open && popup.rootRef.current) {
			const rect = popup.rootRef.current.getBoundingClientRect()
			const spaceBelow = window.innerHeight - rect.bottom
			const spaceAbove = rect.top
			setDirection(spaceBelow < 200 && spaceAbove > spaceBelow ? 'up' : 'down')
		}
		popup.setOpen(!popup.open)
	}

	const onTriggerKeyDown = (e: React.KeyboardEvent) => {
		// role="button" div — Enter/Space must activate like a real button
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			toggleMenu()
			return
		}
		popup.triggerProps.onKeyDown(e)
	}

	return (
		<div {...props} ref={popup.rootRef} className={`${props.className || ''} component component-user-panel`.trim()}>
			{loading ? (
				<>
					<Skeleton variant="circle" width="2rem" height="2rem" />
					<div className="component-user-panel__info">
						<Skeleton width="80%" />
						<Skeleton width="40%" />
					</div>
				</>
			) : (
				<>
					<Avatar src={avatarSrc} name={initials ?? username} size="small" />
					<div
						className="component-user-panel__info"
						role="button"
						tabIndex={0}
						ref={popup.triggerProps.ref}
						aria-haspopup={hasMenu ? true : undefined}
						aria-expanded={hasMenu ? popup.open : undefined}
						onClick={toggleMenu}
						onKeyDown={onTriggerKeyDown}
					>
						<span className="component-user-panel__username">{username}</span>
						<span className="component-user-panel__plan">{plan}</span>
					</div>
					<IconButton icon={icon} variant="secondary" size="small" className={`component-user-panel__settings${iconHighlighted ? ' text-danger' : ''}`} onClick={onIconClick} label="Settings" />
				</>

			)}

			{!loading && popup.open && hasMenu && (
				<div className={`component-user-panel__menu component-user-panel__menu--${direction}`} role="menu" {...popup.popupProps}>
					{menuItems.map((item, i) => (
						<button
							key={i}
							role="menuitem"
							className="component-user-panel__menu-item"
							onClick={e => {
								onMenuClick?.(e, item.key)
								popup.close()
							}}
						>
							{item.icon && <Icon name={item.icon} />}
							<span className="component-user-panel__menu-label">{item.label}</span>
						</button>
					))}
				</div>
			)}
		</div>
	)
}