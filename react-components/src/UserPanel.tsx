import React from 'react'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { IconButton } from './IconButton'
import { Skeleton } from './Skeleton'

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
	const [menuOpen, setMenuOpen] = React.useState(false)
	const [direction, setDirection] = React.useState<'up' | 'down'>('up')
	const panelRef = React.useRef<HTMLDivElement>(null)

	const hasMenu = menuItems && menuItems.length > 0

	const toggleMenu = () => {
		if (!hasMenu) return
		if (!menuOpen && panelRef.current) {
			const rect = panelRef.current.getBoundingClientRect()
			const spaceBelow = window.innerHeight - rect.bottom
			const spaceAbove = rect.top
			setDirection(spaceBelow < 200 && spaceAbove > spaceBelow ? 'up' : 'down')
		}
		setMenuOpen((prev) => !prev)
	}

	React.useEffect(() => {
		if (!menuOpen) return
		const handleClick = (e: MouseEvent) => {
			if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
				setMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClick)
		return () => document.removeEventListener('mousedown', handleClick)
	}, [menuOpen])

	return (
		<div {...props} ref={panelRef} className={`${props.className || ''} component component-user-panel`.trim()}>
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
					<div className="component-user-panel__info" onClick={toggleMenu} role="button" tabIndex={0}>
						<span className="component-user-panel__username">{username}</span>
						<span className="component-user-panel__plan">{plan}</span>
					</div>
					<IconButton icon={icon} variant="secondary" size="small" className={`component-user-panel__settings${iconHighlighted ? ' text-danger' : ''}`} onClick={onIconClick} label="Settings" />
				</>

			)}

			{!loading && menuOpen && hasMenu && (
				<div className={`component-user-panel__menu component-user-panel__menu--${direction}`}>
					{menuItems.map((item, i) => (
						<button
							key={i}
							className="component-user-panel__menu-item"
							onClick={e => {
								onMenuClick?.(e, item.key)
								setMenuOpen(false)
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