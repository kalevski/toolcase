import React, { useState } from 'react'
import { Icon } from './Icon'

export interface EarlySignupFormProps {
	title?: string
	subtitle?: string
	eyebrow?: string
	benefits: string[]
	helperText?: string
	ctaLabel?: string
	placeholder?: string
	successTitle?: string
	successMessage?: string
	variant?: 'dark' | 'light'
	onSubmit?: (email: string, event: React.FormEvent<HTMLFormElement>) => void
	className?: string
	loading?: boolean
}

export const EarlySignupForm: React.FC<EarlySignupFormProps> = ({
	title = 'Get early access',
	subtitle,
	eyebrow = 'Early access',
	benefits,
	helperText = 'One email when we launch. No spam, ever.',
	ctaLabel = 'Join the waitlist',
	placeholder = 'you@example.com',
	successTitle = "You're on the list.",
	successMessage,
	variant = 'dark',
	onSubmit,
	className = '',
	loading = false,
}) => {
	const [email, setEmail] = useState('')
	const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
	const [error, setError] = useState('')

	const rootClassName = [
		'component',
		'component-early-signup-form',
		`component-early-signup-form--${variant}`,
		className,
	]
		.filter(Boolean)
		.join(' ')

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError('')
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			setError('Please enter a valid email.')
			return
		}
		setStatus('submitting')
		if (onSubmit) {
			onSubmit(email, event)
		}
		setStatus('done')
	}

	return (
		<section className={rootClassName}>
			<div className="component-early-signup-form__inner">
				<div className="component-early-signup-form__intro">
					{eyebrow && <span className="component-early-signup-form__eyebrow">{eyebrow}</span>}
					<h2 className="component-early-signup-form__title">{title}</h2>
					{subtitle && <p className="component-early-signup-form__subtitle">{subtitle}</p>}
					<ul className="component-early-signup-form__benefits">
						{benefits.map((benefit, index) => (
							<li key={index} className="component-early-signup-form__benefit">
								<span className="component-early-signup-form__benefit-icon" aria-hidden="true">
									<Icon name="check-circle-fill" decorative />
								</span>
								<span className="component-early-signup-form__benefit-text">{benefit}</span>
							</li>
						))}
					</ul>
				</div>

				<form className="component-early-signup-form__form" onSubmit={handleSubmit} noValidate>
					{status === 'done' ? (
						<div className="component-early-signup-form__success" role="status">
							<span className="component-early-signup-form__success-icon" aria-hidden="true">
								<Icon name="check-circle-fill" decorative />
							</span>
							<strong className="component-early-signup-form__success-title">{successTitle}</strong>
							<span className="component-early-signup-form__success-message">
								{successMessage ?? (
									<>
										We'll email <code>{email}</code> when access opens up.
									</>
								)}
							</span>
						</div>
					) : (
						<>
							<label className="component-early-signup-form__label" htmlFor="early-signup-email">
								Your email address
							</label>
							<input
								id="early-signup-email"
								name="email"
								type="email"
								className="component-early-signup-form__input"
								placeholder={placeholder}
								value={email}
								onChange={(e) => {
									setEmail(e.target.value)
									setError('')
								}}
								disabled={loading || status === 'submitting'}
								autoComplete="email"
								required
							/>
							{error && (
								<p className="component-early-signup-form__error" role="alert">
									<Icon name="exclamation-circle" decorative /> {error}
								</p>
							)}
							<button
								type="submit"
								className="component-early-signup-form__submit"
								disabled={loading || status === 'submitting'}
							>
								{status === 'submitting' ? (
									<>
										<Icon name="arrow-repeat" decorative /> Joining…
									</>
								) : (
									<>
										{ctaLabel} <Icon name="arrow-right" decorative />
									</>
								)}
							</button>
							{helperText && <p className="component-early-signup-form__helper">{helperText}</p>}
						</>
					)}
				</form>
			</div>
		</section>
	)
}
