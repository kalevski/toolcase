import type { ButtonHTMLAttributes, FC, HTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

export interface LoginConnectOption extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
	id: string
    label: string
	color?: string
	icon?: ReactNode
}

export interface LoginProps extends HTMLAttributes<HTMLElement> {
	logo?: ReactNode
	title?: string
	description?: string
	backgroundPatternSrc?: string
	backgroundPatternAlt?: string
	backgroundPattern?: ReactNode
	connect: LoginConnectOption[]
    onConnect?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, key: string) => void
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
	loading = false,
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
					{loading ? (
						<>
							<Skeleton width="40%" height="2rem" />
							<Skeleton width="70%" />
							<div className="component-login__connect">
								<Skeleton count={3} height="2.5rem" />
							</div>
						</>
					) : (
						<>
							<h1 className="component-login__title">{title}</h1>
							{description && <p className="component-login__description">{description}</p>}

							<div className="component-login__connect">
								{connect.map((option) => (
									<button
										key={option.id}
										className={['component-login__connect-btn', option.className].filter(Boolean).join(' ')}
										style={{ ...option.style, '--login-btn-color': option.color } as React.CSSProperties}
										onClick={(e) => onConnect?.(e, option.id)}
										{...option}

									>
										{option.icon && <span className="component-login__connect-btn-icon">
                                    <Icon name={option.icon as string} />
                                </span>}
										<span className="component-login__connect-btn-label">{option.label}</span>
									</button>
								))}
							</div>
						</>
					)}
				</div>
			</div>
		</section>
	)
}
