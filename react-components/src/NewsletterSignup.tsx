import React, { useId, useState } from 'react'
import { Icon } from './Icon'

export interface NewsletterSignupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSubmit' | 'title'> {
	onSubmit: (email: string) => Promise<void> | void
	placeholder?: string
	ctaLabel?: string
	successMessage?: string
	privacyHref?: string
	title?: React.ReactNode
	description?: React.ReactNode
}

type Status = 'idle' | 'submitting' | 'success' | 'error'

export const NewsletterSignup: React.FC<NewsletterSignupProps> = ({
	onSubmit,
	placeholder = 'you@example.com',
	ctaLabel = 'Subscribe',
	successMessage = 'Thanks! Check your inbox to confirm.',
	privacyHref,
	title,
	description,
	className = '',
	...rest
}) => {
	const inputId = useId()
	const [email, setEmail] = useState('')
	const [status, setStatus] = useState<Status>('idle')
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		// Enter in the input bypasses the disabled CTA — apply the same guard here.
		if (!email.trim() || status === 'submitting') return
		setStatus('submitting')
		setError(null)
		try {
			await onSubmit(email.trim())
			setStatus('success')
			setEmail('')
		} catch (err) {
			setStatus('error')
			setError(err instanceof Error ? err.message : 'Something went wrong')
		}
	}

	const rootClass = `component component-newsletter-signup ${className}`.trim()

	return (
		<div className={rootClass} {...rest}>
			{title ? <h3 className="component-newsletter-signup__title">{title}</h3> : null}
			{description ? (
				<p className="component-newsletter-signup__description">{description}</p>
			) : null}
			{status === 'success' ? (
				<div className="component-newsletter-signup__success" role="status">
					<Icon name="check-circle-fill" aria-hidden={true} />
					{successMessage}
					<button
						type="button"
						className="component-newsletter-signup__reset"
						onClick={() => setStatus('idle')}
					>
						Subscribe another email
					</button>
				</div>
			) : (
				<form className="component-newsletter-signup__form" onSubmit={handleSubmit} noValidate>
					<label htmlFor={inputId} className="component-newsletter-signup__label">
						Email address
					</label>
					<div className="component-newsletter-signup__row">
						<input
							id={inputId}
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder={placeholder}
							disabled={status === 'submitting'}
							className="component-newsletter-signup__input"
						/>
						<button
							type="submit"
							className="component-newsletter-signup__cta"
							disabled={status === 'submitting' || !email}
						>
							{status === 'submitting' ? '…' : ctaLabel}
						</button>
					</div>
					{privacyHref ? (
						<p className="component-newsletter-signup__privacy">
							We respect your privacy.{' '}
							<a href={privacyHref} target="_blank" rel="noopener noreferrer">
								Read our privacy policy
							</a>
							.
						</p>
					) : null}
					{error ? (
						<p className="component-newsletter-signup__error" role="alert">{error}</p>
					) : null}
				</form>
			)}
		</div>
	)
}

export default NewsletterSignup
