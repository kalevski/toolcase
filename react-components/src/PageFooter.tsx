import type { ButtonHTMLAttributes, FC, HTMLAttributes, ReactNode } from 'react'

export interface PageFooterLink {
	label: string
	href: string
	external?: boolean
}

export interface PageFooterMenu {
	heading: string
	description?: string
	links: PageFooterLink[]
}

export interface PageFooterSocialLink extends PageFooterLink {
	icon?: ReactNode
}

export interface PageFooterCtaAction extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
	label: string
	outline?: boolean
	size?: 'small' | 'default' | 'large'
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
}

export interface PageFooterCta {
	eyebrow?: string
	title: string
	description?: string
	primaryAction?: PageFooterCtaAction
	secondaryAction?: PageFooterCtaAction
	helperText?: string
}

export interface PageFooterProps extends HTMLAttributes<HTMLElement> {
	brand?: ReactNode
	tagline?: string
	description?: string
	menus?: PageFooterMenu[]
	socialLinks?: PageFooterSocialLink[]
	legalLinks?: PageFooterLink[]
	legalText?: string
	cta?: PageFooterCta
}

const targetProps = (external?: boolean) =>
	external
		? {
				target: '_blank',
				rel: 'noreferrer noopener',
			}
		: undefined

export const PageFooter: FC<PageFooterProps> = ({
	brand: _brand,
	tagline: _tagline,
	description: _description,
	menus = [],
	socialLinks = [],
	legalLinks = [],
	legalText,
	cta: _cta,
	className,
	...rest
}) => {
	const rootClassName = ['component component-page-footer', className].filter(Boolean).join(' ')
	const hasMenus = menus.length > 0
	const hasSocial = socialLinks.length > 0
	const hasLegal = legalLinks.length > 0 || legalText

	return (
		<footer className={rootClassName} {...rest}>
			<div className="component-page-footer__inner">
				{hasMenus && (
					<div className="component-page-footer__menus" aria-label="Footer navigation">
						{menus.map((menu) => (
							<div className="component-page-footer__menu" key={menu.heading}>
								<p className="component-page-footer__menu-heading">{menu.heading}</p>
								{menu.description && (
									<p className="component-page-footer__menu-description">{menu.description}</p>
								)}
								<ul className="component-page-footer__menu-list">
									{menu.links.map((link) => (
										<li className="component-page-footer__menu-item" key={link.label}>
											<a
												className="component-page-footer__menu-link"
												href={link.href}
												{...targetProps(link.external)}
											>
												{link.label}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				)}
			</div>

			{(hasSocial || hasLegal) && (
				<div className="component-page-footer__bottom">
					{hasSocial && (
						<ul className="component-page-footer__social" aria-label="Social links">
							{socialLinks.map((link) => (
								<li className="component-page-footer__social-item" key={link.label}>
									<a
										className="component-page-footer__social-link"
										href={link.href}
										{...targetProps(link.external)}
									>
										{link.icon && (
											<span className="component-page-footer__social-icon" aria-hidden="true">
												{link.icon}
											</span>
										)}
										<span className="component-page-footer__social-label">{link.label}</span>
									</a>
								</li>
							))}
						</ul>
					)}
					{hasLegal && (
						<div className="component-page-footer__legal" aria-label="Legal navigation">
							{hasLegal && legalLinks.length > 0 && (
								<ul className="component-page-footer__legal-links">
									{legalLinks.map((link) => (
										<li className="component-page-footer__legal-item" key={link.label}>
											<a
												className="component-page-footer__legal-link"
												href={link.href}
												{...targetProps(link.external)}
											>
												{link.label}
											</a>
										</li>
									))}
								</ul>
							)}
							{legalText && <p className="component-page-footer__legal-text">{legalText}</p>}
						</div>
					)}
				</div>
			)}
		</footer>
	)
}

PageFooter.displayName = 'PageFooter'
