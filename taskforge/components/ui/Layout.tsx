'use client'

import React, { useEffect, useRef, useId } from 'react'
import type { FC, HTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'
import { Badge } from './Display'
import { Avatar } from './Display'
import { IconButton } from './Button'

// ── DashboardLayout ──────────────────────────────────────────────────────────

export interface DashboardLayoutProps {
    children: React.ReactNode
    navbarLeftComponent?: React.ReactNode
    navbarRightComponent?: React.ReactNode
    brandComponent?: React.ReactNode
    sidebarMenuComponent?: React.ReactNode
    sidebarPanelComponent?: React.ReactNode
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
    children,
    brandComponent,
    navbarLeftComponent,
    navbarRightComponent,
    sidebarMenuComponent,
    sidebarPanelComponent,
}) => {
    const [sidebarOpen, setSidebarOpen] = React.useState(false)
    const middle = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && sidebarOpen) setSidebarOpen(false)
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [sidebarOpen])

    const toggleSidebar = () => setSidebarOpen((v) => !v)

    return (
        <div className="layout layout--dashboard layout--dashboard__light">
            <div className={`layout--dashboard__wrapper ${sidebarOpen ? 'sidebar__open' : ''}`}>
                <nav className="layout--dashboard__navbar">
                    <div className="navbar--section navbar--section__start">
                        <div className="navbar--toggle" onClick={toggleSidebar}>
                            ☰
                        </div>
                    </div>
                    <div ref={middle} className="navbar--section">
                        {navbarLeftComponent}
                    </div>
                    <div className="navbar--section">{navbarRightComponent}</div>
                </nav>
                <div className="layout--dashboard__overlay" onClick={toggleSidebar}></div>
                <div className="layout--dashboard__sidebar">
                    <div className="sidebar--section sidebar--section__branding">{brandComponent}</div>
                    <div className="sidebar--section sidebar--section__menu">{sidebarMenuComponent}</div>
                    <div className="sidebar--section sidebar--section__panel">{sidebarPanelComponent}</div>
                </div>
                <main className="layout--dashboard__content">{children}</main>
            </div>
        </div>
    )
}

// ── Brand ─────────────────────────────────────────────────────────────────────

export interface BrandProps extends HTMLAttributes<HTMLDivElement> {
    primaryText?: ReactNode
    secondaryText?: ReactNode
    label?: ReactNode
    color?: string
    xlarge?: boolean
}

export const Brand: FC<BrandProps> = ({
    primaryText,
    secondaryText,
    label,
    color,
    xlarge,
    className,
    onClick = undefined,
    ...rest
}) => {
    const clickable = typeof onClick === 'function'
    const classList = ['component component-brand', className]
    if (clickable) classList.push('component-brand--clickable')
    if (xlarge) classList.push('component-brand--xlarge')
    const rootClass = classList.filter(Boolean).join(' ')

    const underlineStyle = color
        ? { textDecoration: 'underline', textDecorationColor: color }
        : { textDecoration: 'underline' }

    return (
        <div className={rootClass} onClick={onClick} {...rest}>
            <span style={underlineStyle} className="component-brand__text-group">
                {primaryText && <span className="component-brand--primaryText">{primaryText}</span>}
                {secondaryText && <span className="component-brand--secondaryText">{secondaryText}</span>}
            </span>
            {label && (
                <div className="component-brand--label">
                    <Badge>{label}</Badge>
                </div>
            )}
        </div>
    )
}

// ── SideNav ─────────────────────────────────────────────────────────────────

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
    loading?: boolean
    loadingCount?: number
}

export const SideNav: React.FC<SideNavProps> = ({ sections = [], onItemClick, className, ...rest }) => {
    const reactId = useId()

    const navClassName = ['component component-side-nav', className || ''].filter(Boolean).join(' ')

    return (
        <nav className={navClassName} {...rest}>
            {sections.map((section, sIndex) => {
                const sectionKey = section.key || `side-nav-section-${reactId}-${sIndex}`
                return (
                    <div key={sectionKey} className="component-side-nav__section">
                        {section.title && <div className="component-side-nav__section-title">{section.title}</div>}
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
                                            href={item.disabled ? undefined : item.href || '#'}
                                            target={item.target}
                                            title={typeof item.label === 'string' ? item.label : undefined}
                                            rel={item.rel}
                                            aria-disabled={item.disabled || undefined}
                                            onClick={(event) => {
                                                if (item.disabled) {
                                                    event.preventDefault()
                                                    return
                                                }
                                                if (onItemClick) onItemClick(event, item)
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
                                                    {typeof item.badge === 'string' ||
                                                    typeof item.badge === 'number' ? (
                                                        <Badge variant="primary" pill>
                                                            {item.badge}
                                                        </Badge>
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

// ── UserPanel ─────────────────────────────────────────────────────────────────

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
    ...props
}) => {
    const [direction, setDirection] = React.useState<'up' | 'down'>('up')
    const [open, setOpen] = React.useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

    const hasMenu = menuItems && menuItems.length > 0

    useEffect(() => {
        if (!open) return
        const onDocClick = (e: globalThis.MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onDocClick)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDocClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const toggleMenu = () => {
        if (!hasMenu) return
        if (!open && rootRef.current) {
            const rect = rootRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom
            const spaceAbove = rect.top
            setDirection(spaceBelow < 200 && spaceAbove > spaceBelow ? 'up' : 'down')
        }
        setOpen(!open)
    }

    const onTriggerKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleMenu()
        }
    }

    return (
        <div {...props} ref={rootRef} className={`${props.className || ''} component component-user-panel`.trim()}>
            <Avatar src={avatarSrc} name={initials ?? username} size="small" />
            <div
                className="component-user-panel__info"
                role="button"
                tabIndex={0}
                aria-haspopup={hasMenu ? true : undefined}
                aria-expanded={hasMenu ? open : undefined}
                onClick={toggleMenu}
                onKeyDown={onTriggerKeyDown}
            >
                <span className="component-user-panel__username">{username}</span>
                <span className="component-user-panel__plan">{plan}</span>
            </div>
            <IconButton
                icon={icon}
                variant="secondary"
                size="small"
                className={`component-user-panel__settings${iconHighlighted ? ' text-danger' : ''}`}
                onClick={onIconClick}
                label="Settings"
            />

            {open && hasMenu && (
                <div
                    className={`component-user-panel__menu component-user-panel__menu--${direction}`}
                    role="menu"
                >
                    {menuItems!.map((item, i) => (
                        <button
                            key={i}
                            role="menuitem"
                            className="component-user-panel__menu-item"
                            onClick={(e) => {
                                onMenuClick?.(e, item.key)
                                setOpen(false)
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

// ── Login ─────────────────────────────────────────────────────────────────────

export interface LoginConnectOption {
    id: string
    label: string
    color?: string
    icon?: ReactNode
    className?: string
    style?: React.CSSProperties
    disabled?: boolean
}

export interface LoginProps extends HTMLAttributes<HTMLElement> {
    logo?: ReactNode
    title?: string
    description?: string
    backgroundPatternSrc?: string
    backgroundPatternAlt?: string
    backgroundPattern?: ReactNode
    connect: LoginConnectOption[]
    onConnect?: (e: React.MouseEvent<HTMLButtonElement, globalThis.MouseEvent>, key: string) => void
    loading?: boolean
}

export const Login: FC<LoginProps> = ({
    logo,
    title = 'Sign in',
    description,
    backgroundPatternSrc,
    backgroundPatternAlt,
    backgroundPattern,
    connect,
    className,
    onConnect,
    ...rest
}) => {
    const rootClassName = ['component component-login', className].filter(Boolean).join(' ')
    const patternAlt = backgroundPatternAlt ?? ''
    const shouldHidePattern = !backgroundPattern && (!patternAlt || patternAlt.length === 0)

    const patternElement =
        backgroundPattern ??
        (backgroundPatternSrc ? (
            <img
                src={backgroundPatternSrc}
                alt={patternAlt}
                className="component-login__background-pattern"
                loading="lazy"
                aria-hidden={shouldHidePattern ? true : undefined}
            />
        ) : null)

    return (
        <section className={rootClassName} {...rest}>
            <div className="component-login__left">
                {patternElement && (
                    <div className="component-login__background" aria-hidden={shouldHidePattern ? true : undefined}>
                        {patternElement}
                    </div>
                )}
                {logo && <div className="component-login__logo">{logo}</div>}
            </div>

            <div className="component-login__right">
                <div className="component-login__form">
                    <h1 className="component-login__title">{title}</h1>
                    {description && <p className="component-login__description">{description}</p>}

                    <div className="component-login__connect">
                        {connect.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                disabled={option.disabled}
                                className={['component-login__connect-btn', option.className]
                                    .filter(Boolean)
                                    .join(' ')}
                                style={{ ...option.style, '--login-btn-color': option.color } as React.CSSProperties}
                                onClick={(e) => onConnect?.(e, option.id)}
                            >
                                {option.icon && (
                                    <span className="component-login__connect-btn-icon">{option.icon}</span>
                                )}
                                <span className="component-login__connect-btn-label">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
