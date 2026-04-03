import React, { JSX, JSXElementConstructor, useEffect, useId, useState } from 'react'
import { Button } from './Button'

export interface CoolNavItem {
	key?: string
	label: React.ReactNode
	href?: string
	onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
	active?: boolean
	target?: string
	rel?: string
}

export interface CoolNavProps {
	brand?: React.ReactNode
	items?: CoolNavItem[]
	loginLabel?: string
	loginHref?: string
	loginTarget?: string
	onLoginClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
	loginVariant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	className?: string
	containerClassName?: string
	scrollOffset?: number
	expandBreakpoint?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
	theme?: 'light' | 'dark'
	backgroundClassName?: string
	sticky?: boolean
	style?: React.CSSProperties
	rightEl?: React.ReactNode
}

export const CoolNav: React.FC<CoolNavProps> = ({
	brand,
	items = [],
	loginLabel = 'Login & Register',
	loginHref,
	loginTarget,
	onLoginClick,
	loginVariant = 'primary',
	className,
	containerClassName = 'container-fluid',
	scrollOffset = 24,
	expandBreakpoint = 'lg',
	theme = 'light',
	backgroundClassName = 'component-cool-nav--default-bg',
	sticky = true,
	style,
	rightEl,
}) => {
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [isScrolled, setIsScrolled] = useState(false)
	const reactId = useId()
	const collapseId = `cool-nav-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`

	useEffect(() => {
		if (typeof window === 'undefined') {
			return
		}

		const handleScroll = () => {
			setIsScrolled(window.scrollY > scrollOffset)
		}

		handleScroll()
		window.addEventListener('scroll', handleScroll, { passive: true })

		return () => {
			window.removeEventListener('scroll', handleScroll)
		}
	}, [scrollOffset])

	const expandClass = expandBreakpoint ? `navbar-expand-${expandBreakpoint}` : ''
	const themeClass = theme === 'dark' ? 'navbar-dark' : 'navbar-light'

	const navClassName = [
		'component component-cool-nav',
		'navbar',
		expandClass,
		themeClass,
		backgroundClassName,
		sticky ? 'component-cool-nav--sticky' : '',
		isScrolled ? 'component-cool-nav--scrolled' : '',
		className || '',
	]
		.filter(Boolean)
		.join(' ')

	const menuClassName = ['collapse navbar-collapse', isMenuOpen ? 'show' : ''].filter(Boolean).join(' ')

	const handleToggle = () => {
		setIsMenuOpen((current) => !current)
	}

	const closeMenu = () => setIsMenuOpen(false)

	const renderLoginAction = () => {
		if (rightEl) {
			if (React.isValidElement<React.ComponentPropsWithoutRef<any>>(rightEl)) {
				const originalOnClick = rightEl.props.onClick as
					| ((event: React.MouseEvent<HTMLElement>) => void)
					| undefined
				const existingClassName = rightEl.props.className as string | undefined
				const mergedClassName = [existingClassName, 'component-cool-nav__login-action'].filter(Boolean).join(' ')

				return React.cloneElement(rightEl, {
					className: mergedClassName,
					onClick: (event: React.MouseEvent<HTMLElement>) => {
						if (originalOnClick) {
							originalOnClick(event)
						}
						if (onLoginClick) {
							onLoginClick(event as React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>)
						}
						if (!event.defaultPrevented) {
							closeMenu()
						}
					},
				})
			}

			return rightEl
		}

		if (loginHref) {
			return (
				<a
					className={`btn btn-${loginVariant} component-cool-nav__login-action`}
					href={loginHref}
					target={loginTarget}
					rel={loginTarget === '_blank' ? 'noopener noreferrer' : undefined}
					onClick={(event) => {
						if (onLoginClick) {
							onLoginClick(event)
						}
						if (!event.defaultPrevented) {
							closeMenu()
						}
					}}
				>
					{loginLabel}
				</a>
			)
		}

		return (
			<Button
				className="component-cool-nav__login-action"
				variant={loginVariant}
				onClick={(event) => {
					if (onLoginClick) {
						onLoginClick(event)
					}
					if (!event.defaultPrevented) {
						closeMenu()
					}
				}}
			>
				{loginLabel}
			</Button>
		)
	}

	return (
		<nav className={navClassName} style={style}>
			<div className={containerClassName}>
				<div className="component-cool-nav__brand">{brand}</div>

				<button
					className="navbar-toggler"
					type="button"
					aria-controls={collapseId}
					aria-expanded={isMenuOpen}
					aria-label="Toggle navigation"
					onClick={handleToggle}
				>
					<span className="navbar-toggler-icon" />
				</button>

				<div className={menuClassName} id={collapseId}>
					<ul className="navbar-nav mx-auto component-cool-nav__items">
						{items.map((item, index) => {
							const key = item.key || `cool-nav-item-${index}`

							return (
								<li key={key} className="nav-item">
									<a
										className={['nav-link', item.active ? 'active' : ''].filter(Boolean).join(' ')}
										href={item.href || '#'}
										target={item.target}
										rel={item.rel}
										onClick={(event) => {
											if (item.onClick) {
												item.onClick(event)
											}
											if (!event.defaultPrevented) {
												closeMenu()
											}
										}}
									>
										{item.label}
									</a>
								</li>
							)
						})}
					</ul>

					<div className="d-flex component-cool-nav__actions">{renderLoginAction()}</div>
				</div>
			</div>
		</nav>
	)
}
